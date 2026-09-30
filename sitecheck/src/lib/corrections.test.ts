import { describe, expect, it } from "vitest";
import {
  applyCorrections,
  CorrectionBodyZod,
  correctionValueZod,
  editableFields,
  fieldKind,
  fieldOptions,
  latestCorrections,
  type CorrectionInput,
} from "./corrections";
import { planSteps } from "./plan";
import { evaluate, type RulesInput } from "./rules";
import type { PhotoAnalysis } from "./schema";
import { STEP_IDS } from "./steps";
import { GOOD_ANALYSIS } from "./testing";
import type { FinishedPhotoStatus, SetupType } from "./types";

type Photo = { id: string; step: string; status: FinishedPhotoStatus; analysis: PhotoAnalysis };

function homePhotos(
  setupType: SetupType,
  overrides: Record<string, Partial<PhotoAnalysis>> = {},
  statuses: Record<string, FinishedPhotoStatus> = {},
): Photo[] {
  return planSteps({ setup_type: setupType, panel_same_wall_answer: "not_asked" }, []).map((step) => ({
    id: `photo-${step}`,
    step,
    status: statuses[step] ?? "accepted",
    analysis: { ...GOOD_ANALYSIS, ...overrides[step] },
  }));
}

function rules(setupType: SetupType, photos: Photo[], input: Partial<RulesInput> = {}) {
  return evaluate({
    inAustin: false,
    hasSolar: false,
    panelSameWallAnswer: "not_asked",
    setupType,
    siteCheckStatus: "done",
    photos,
    ...input,
  });
}

const correction = (photo_id: string, field: string, corrected_value: unknown, created_at = "2026-09-30T10:00:00Z"): CorrectionInput => ({
  photo_id,
  field,
  corrected_value,
  created_at,
});

describe("applyCorrections with the rules", () => {
  it("a 125A reading in Austin corrected to 200A turns FAIL into PASS", () => {
    const photos = homePhotos("combo_meter_main_unit", { main_disconnect_closeup: { amp_rating: 125 } });
    const before = rules("combo_meter_main_unit", applyCorrections(photos, []), { inAustin: true });
    expect(before.verdict).toBe("FAIL");
    expect(before.reasons.find((r) => r.code === "AMP_TOO_LOW")?.outcome).toBe("FAIL");

    const fixed = applyCorrections(photos, [correction("photo-main_disconnect_closeup", "amp_rating", 200)]);
    const after = rules("combo_meter_main_unit", fixed, { inAustin: true });
    expect(after.verdict).toBe("PASS");
    expect(after.batteryCount).toBe(2);
    expect(after.reasons.some((r) => r.code === "AMP_TOO_LOW")).toBe(false);
  });

  it("a low-confidence panel_wide photo set to closet by the surveyor ends as FAIL, not REVIEW", () => {
    const setup = "separate_meter_and_panel_outdoors";
    const photos = homePhotos(setup, { panel_wide: { confidence: 60, location: "garage" } });
    const fixed = applyCorrections(photos, [correction("photo-panel_wide", "location", "closet")]);
    const result = rules(setup, fixed);
    expect(result.verdict).toBe("FAIL");
    expect(result.reasons.find((r) => r.code === "PANEL_IN_LIVING_SPACE")?.outcome).toBe("FAIL");

    // The same value without the confirmed confidence would only reach REVIEW.
    const aiOnly = homePhotos(setup, { panel_wide: { confidence: 60, location: "closet" } });
    expect(rules(setup, aiOnly).verdict).toBe("REVIEW");
  });

  const main = "main_disconnect_closeup";
  const codesFor = (result: ReturnType<typeof rules>, step: string) =>
    result.reasons.filter((r) => r.step === step).map((r) => r.code);

  it("a kept-for-review main switch photo with the amp corrected to 200A in Austin is read by the rules", () => {
    const setup = "combo_meter_main_unit";
    const photos = homePhotos(
      setup,
      { [main]: { amp_rating: 0, amp_rating_legible: false } },
      { [main]: "accepted_after_max_attempts" },
    );
    expect(codesFor(rules(setup, applyCorrections(photos, []), { inAustin: true }), main)).toEqual(["STEP_UNCLEAR"]);

    const fixed = applyCorrections(photos, [correction(`photo-${main}`, "amp_rating", 200)]);
    const photo = fixed.find((p) => p.step === main)!;
    expect(photo.status).toBe("accepted");
    expect(photo.analysis.amp_rating_legible).toBe(true);
    const after = rules(setup, fixed, { inAustin: true });
    expect(codesFor(after, main)).not.toContain("STEP_UNCLEAR");
    expect(codesFor(after, main)).not.toContain("AMP_UNREADABLE");
    expect(codesFor(after, main)).toContain("AMP_OK");
    expect(after.verdict).toBe("PASS");
  });

  it("an amp_rating_legible correction to false after an amp_rating correction keeps it false", () => {
    const setup = "combo_meter_main_unit";
    const photos = homePhotos(setup, { [main]: { amp_rating: 0, amp_rating_legible: false } });
    const fixed = applyCorrections(photos, [
      correction(`photo-${main}`, "amp_rating", 200, "2026-09-30T10:00:00Z"),
      correction(`photo-${main}`, "amp_rating_legible", false, "2026-09-30T11:00:00Z"),
    ]);
    expect(fixed.find((p) => p.step === main)!.analysis.amp_rating_legible).toBe(false);
    expect(codesFor(rules(setup, fixed, { inAustin: true }), main)).toContain("AMP_UNREADABLE");
  });
});

describe("applyCorrections", () => {
  const photos = [
    { id: "a", analysis: { ...GOOD_ANALYSIS, confidence: 70, amp_rating: 100 } },
    { id: "b", analysis: { ...GOOD_ANALYSIS, confidence: 70 } },
    { id: "c", analysis: null },
  ];

  it("applies the latest correction per photo and field", () => {
    const [a] = applyCorrections(photos, [
      correction("a", "amp_rating", 150, "2026-09-30T10:00:00Z"),
      correction("a", "amp_rating", 200, "2026-09-30T11:00:00Z"),
      correction("a", "amp_rating", 175, "2026-09-30T09:00:00Z"),
      correction("a", "damage_visible", true),
    ]);
    expect(a.analysis?.amp_rating).toBe(200);
    expect(a.analysis?.damage_visible).toBe(true);
  });

  it("sets confidence to 100 only on corrected photos", () => {
    const [a, b] = applyCorrections(photos, [correction("a", "amp_rating", 100)]);
    expect(a.analysis?.confidence).toBe(100);
    expect(b.analysis?.confidence).toBe(70);
    expect(b).toBe(photos[1]);
  });

  it("confirming the AI value still counts as a correction", () => {
    const [a] = applyCorrections(photos, [correction("a", "amp_rating", 100)]);
    expect(a.analysis?.amp_rating).toBe(100);
    expect(a.analysis?.confidence).toBe(100);
  });

  it("leaves photos without analysis alone and does not change its input", () => {
    const out = applyCorrections(photos, [correction("c", "amp_rating", 200), correction("a", "amp_rating", 200)]);
    expect(out[2]).toBe(photos[2]);
    expect(photos[0].analysis?.amp_rating).toBe(100);
    expect(photos[0].analysis?.confidence).toBe(70);
  });

  it("a readable amp or brand correction makes its legible flag true", () => {
    const unreadable = { ...GOOD_ANALYSIS, amp_rating_legible: false, panel_label_legible: false };
    const [a] = applyCorrections(
      [{ id: "a", analysis: unreadable }],
      [correction("a", "amp_rating", 150), correction("a", "panel_brand", "other")],
    );
    expect(a.analysis?.amp_rating_legible).toBe(true);
    expect(a.analysis?.panel_label_legible).toBe(true);
  });

  it("an amp of 0 or a brand of not_visible leaves the legible flag as the AI read it", () => {
    const unreadable = { ...GOOD_ANALYSIS, amp_rating_legible: false, panel_label_legible: false };
    const [a] = applyCorrections(
      [{ id: "a", analysis: unreadable }],
      [correction("a", "amp_rating", 0), correction("a", "panel_brand", "not_visible")],
    );
    expect(a.analysis?.amp_rating_legible).toBe(false);
    expect(a.analysis?.panel_label_legible).toBe(false);
  });

  it("the surveyor's own legible correction wins, even when made before the reading correction", () => {
    const [a] = applyCorrections(
      [{ id: "a", analysis: { ...GOOD_ANALYSIS, panel_label_legible: true } }],
      [
        correction("a", "panel_label_legible", false, "2026-09-30T09:00:00Z"),
        correction("a", "panel_brand", "other", "2026-09-30T10:00:00Z"),
      ],
    );
    expect(a.analysis?.panel_label_legible).toBe(false);
  });

  it("only a corrected kept-for-review photo becomes accepted", () => {
    const withStatus = [
      { id: "kept", status: "accepted_after_max_attempts" as const, analysis: GOOD_ANALYSIS },
      { id: "kept-untouched", status: "accepted_after_max_attempts" as const, analysis: GOOD_ANALYSIS },
      { id: "failed", status: "check_failed" as const, analysis: GOOD_ANALYSIS },
      { id: "kept-no-analysis", status: "accepted_after_max_attempts" as const, analysis: null },
    ];
    const out = applyCorrections(
      withStatus,
      ["kept", "failed", "kept-no-analysis"].map((id) => correction(id, "damage_visible", true)),
    );
    expect(out.map((p) => p.status)).toEqual([
      "accepted",
      "accepted_after_max_attempts",
      "check_failed",
      "accepted_after_max_attempts",
    ]);
    expect(withStatus[0].status).toBe("accepted_after_max_attempts");
  });

  it("ignores unknown fields", () => {
    const [a] = applyCorrections(photos, [correction("a", "not_a_field", 1)]);
    expect(a).toBe(photos[0]);
    expect(latestCorrections([correction("a", "not_a_field", 1)]).size).toBe(0);
  });
});

describe("editableFields", () => {
  it("lists the readings rules.ts reads for each step", () => {
    const table = Object.fromEntries(STEP_IDS.map((s) => [s, editableFields(s)]));
    expect(table).toEqual({
      meter_area_wide: [
        "gas_meter_near",
        "window_near",
        "ac_unit_near",
        "clear_ground_space",
        "multiple_panels_visible",
        "meter_count",
      ],
      meter_closeup: ["damage_visible", "meter_count"],
      left_of_meter: ["clear_ground_space"],
      right_of_meter: ["clear_ground_space"],
      adjacent_wall: ["clear_ground_space"],
      behind_fence: ["clear_ground_space"],
      panel_wide: ["location", "multiple_panels_visible", "damage_visible"],
      panel_open: ["panel_brand", "panel_label_legible", "heavy_rust", "damage_visible", "multiple_panels_visible"],
      main_disconnect_closeup: ["amp_rating", "amp_rating_legible", "damage_visible"],
    });
    expect(editableFields("extra_1")).toEqual(["clear_ground_space"]);
    expect(editableFields("unknown_step")).toEqual([]);
  });
});

describe("field types", () => {
  it("maps fields to switch, dropdown or number", () => {
    expect(fieldKind("damage_visible")).toBe("boolean");
    expect(fieldKind("location")).toBe("choice");
    expect(fieldKind("amp_rating")).toBe("number");
    expect(fieldOptions("location")).toEqual(["outdoor", "garage", "closet", "indoor_other", "unknown"]);
    expect(fieldOptions("amp_rating")).toEqual([]);
  });

  it("accepts only values of the field's type and enum", () => {
    expect(correctionValueZod("amp_rating").safeParse(200).success).toBe(true);
    expect(correctionValueZod("amp_rating").safeParse(200.5).success).toBe(false);
    expect(correctionValueZod("amp_rating").safeParse(-5).success).toBe(false);
    expect(correctionValueZod("amp_rating").safeParse("200").success).toBe(false);
    expect(correctionValueZod("location").safeParse("closet").success).toBe(true);
    expect(correctionValueZod("location").safeParse("attic").success).toBe(false);
    expect(correctionValueZod("damage_visible").safeParse(false).success).toBe(true);
    expect(correctionValueZod("damage_visible").safeParse("no").success).toBe(false);
  });

  it("checks the body shape", () => {
    const photoId = "7b0c5b0e-8a5d-4d1c-9a57-5b2b8f7f3a11";
    expect(CorrectionBodyZod.safeParse({ photoId, field: "amp_rating", value: 200 }).success).toBe(true);
    expect(CorrectionBodyZod.safeParse({ photoId, field: "made_up", value: 1 }).success).toBe(false);
    expect(CorrectionBodyZod.safeParse({ photoId: "nope", field: "amp_rating", value: 1 }).success).toBe(false);
  });
});
