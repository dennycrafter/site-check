import { describe, expect, it } from "vitest";
import { nextStep, planSteps } from "./plan";
import { evaluate, type RulesInput, type RulesPhoto } from "./rules";
import type { PhotoAnalysis } from "./schema";
import type { FinishedPhotoStatus, Outcome } from "./types";

const GOOD: PhotoAnalysis = {
  photo_matches_request: true,
  usable: true,
  retake_reason: "none",
  retake_instruction: "",
  confidence: 95,
  setup_type: "combo_meter_main_unit",
  amp_rating: 200,
  amp_rating_legible: true,
  meter_number_legible: true,
  location: "outdoor",
  damage_visible: false,
  gas_meter_near: false,
  window_near: false,
  ac_unit_near: false,
  fence_present: false,
  clutter_blocking: false,
  clear_ground_space: "room_for_two",
  multiple_panels_visible: false,
  meter_count: 1,
  meter_can_edges_visible: true,
  ground_visible: true,
  wall_end_visible: true,
  panel_context_visible: true,
  notes: "",
};

type Case = {
  name: string;
  input?: Partial<Omit<RulesInput, "photos">>;
  /** Override applied to every photo's analysis. */
  all?: Partial<PhotoAnalysis>;
  /** Per-step analysis overrides. */
  steps?: Record<string, Partial<PhotoAnalysis>>;
  statuses?: Record<string, FinishedPhotoStatus>;
  /** Accepted photos for extra_<n> steps from the whole-site check. */
  extras?: Record<string, Partial<PhotoAnalysis>>;
  verdict: Outcome;
  batteryCount?: number;
  code?: string;
  codeOutcome?: Outcome;
};

function build(c: Case): RulesInput {
  const base = {
    inAustin: false,
    hasSolar: false,
    panelSameWallAnswer: "not_asked" as const,
    setupType: "combo_meter_main_unit" as const,
    siteCheckStatus: "done" as const,
    ...c.input,
  };
  const steps = planSteps(
    { setup_type: base.setupType, panel_same_wall_answer: base.panelSameWallAnswer },
    [],
  );
  const photos: RulesPhoto[] = steps.map((step) => {
    const status = c.statuses?.[step] ?? "accepted";
    return {
      step,
      status,
      analysis:
        status === "check_failed" ? null : { ...GOOD, ...c.all, ...c.steps?.[step] },
    };
  });
  const extras = Object.entries(c.extras ?? {});
  for (const [step, analysis] of extras) {
    photos.push({ step, status: "accepted", analysis: { ...GOOD, ...c.all, ...analysis } });
  }
  return { ...base, extraSteps: extras.map(([id]) => ({ id })), photos };
}

const SPACE_NONE = { clear_ground_space: "none" as const };

const cases: Case[] = [
  { name: "1. all good, 200A, room_for_two", verdict: "PASS", batteryCount: 2, code: "AMP_OK" },
  {
    name: "2. all good, 150A, not Austin, no solar, room_for_two",
    steps: { main_disconnect_closeup: { amp_rating: 150 } },
    verdict: "PASS",
    batteryCount: 2,
  },
  {
    name: "3. 125A in Austin",
    input: { inAustin: true },
    steps: { main_disconnect_closeup: { amp_rating: 125 } },
    verdict: "FAIL",
    batteryCount: 0,
    code: "AMP_TOO_LOW",
  },
  {
    name: "4. 125A not in Austin",
    steps: { main_disconnect_closeup: { amp_rating: 125 } },
    verdict: "PASS",
    batteryCount: 1,
  },
  {
    name: "5. solar with 150A, room_for_two",
    input: { hasSolar: true },
    steps: { main_disconnect_closeup: { amp_rating: 150 } },
    verdict: "PASS",
    batteryCount: 1,
    code: "SOLAR_LIMITS_TO_ONE",
  },
  { name: "6. solar with 200A", input: { hasSolar: true }, verdict: "PASS", batteryCount: 2 },
  {
    name: "7. 400A",
    steps: { main_disconnect_closeup: { amp_rating: 400 } },
    verdict: "REVIEW",
    code: "AMP_ABOVE_200",
  },
  {
    name: "8. amp unreadable",
    steps: { main_disconnect_closeup: { amp_rating_legible: false, amp_rating: 0 } },
    verdict: "REVIEW",
    code: "AMP_UNREADABLE",
  },
  {
    name: "9. panel in closet",
    input: { setupType: "separate_meter_and_panel_outdoors" },
    steps: { panel_wide: { location: "closet" } },
    verdict: "FAIL",
    code: "PANEL_IN_LIVING_SPACE",
    codeOutcome: "FAIL",
  },
  {
    name: "10. panel in closet, confidence 60 (low confidence downgrade)",
    input: { setupType: "separate_meter_and_panel_outdoors" },
    steps: { panel_wide: { location: "closet", confidence: 60 } },
    verdict: "REVIEW",
    code: "PANEL_IN_LIVING_SPACE",
    codeOutcome: "REVIEW",
  },
  {
    name: "11. panel_indoors, answer no",
    input: { setupType: "panel_indoors", panelSameWallAnswer: "no" },
    verdict: "REVIEW",
    code: "PANEL_NOT_SAME_WALL",
    codeOutcome: "REVIEW",
  },
  {
    name: "12. gas meter near",
    steps: { meter_area_wide: { gas_meter_near: true } },
    verdict: "REVIEW",
    batteryCount: 2,
    code: "OBSTACLE_NEAR_METER",
  },
  { name: "13. all space none", all: SPACE_NONE, verdict: "FAIL", batteryCount: 0, code: "NO_SPACE" },
  {
    name: "14. 200A with room_for_one",
    all: { clear_ground_space: "room_for_one" },
    verdict: "PASS",
    batteryCount: 1,
    code: "CAPPED_BY_SPACE",
  },
  {
    name: "15. main_disconnect_closeup check_failed",
    statuses: { main_disconnect_closeup: "check_failed" },
    verdict: "REVIEW",
    code: "CHECK_FAILED",
  },
  {
    name: "16. meter_closeup accepted_after_max_attempts",
    statuses: { meter_closeup: "accepted_after_max_attempts" },
    verdict: "REVIEW",
    code: "STEP_UNCLEAR",
  },
  {
    name: "17. space mix of none and unclear",
    all: SPACE_NONE,
    steps: {
      left_of_meter: { clear_ground_space: "unclear" },
      right_of_meter: { clear_ground_space: "unclear" },
    },
    verdict: "REVIEW",
    code: "SPACE_UNCLEAR",
  },
  {
    name: "18. whole-site check failed",
    input: { siteCheckStatus: "failed" },
    verdict: "REVIEW",
    code: "SITE_CHECK_FAILED",
  },
  {
    name: "19. extra photo has room_for_two, regular space photos none",
    all: SPACE_NONE,
    extras: { extra_1: { clear_ground_space: "room_for_two" } },
    verdict: "PASS",
    batteryCount: 2,
    code: "SPACE_OK",
  },
  {
    name: "20. panel in garage",
    input: { setupType: "separate_meter_and_panel_outdoors" },
    steps: { panel_wide: { location: "garage" } },
    verdict: "PASS",
  },
  {
    name: "21. panel indoor_other",
    input: { setupType: "separate_meter_and_panel_outdoors" },
    steps: { panel_wide: { location: "indoor_other" } },
    verdict: "FAIL",
    code: "PANEL_IN_LIVING_SPACE",
  },
  {
    name: "22. two meters on meter_closeup",
    steps: { meter_closeup: { meter_count: 2 } },
    verdict: "REVIEW",
    code: "MULTIPLE_METERS",
  },
  {
    name: "23. 125A not Austin, no solar",
    steps: { main_disconnect_closeup: { amp_rating: 125 } },
    verdict: "PASS",
    batteryCount: 1,
  },
  {
    name: "U1. location not asked, 125A",
    input: { inAustin: null },
    steps: { main_disconnect_closeup: { amp_rating: 125 } },
    verdict: "REVIEW",
    batteryCount: 1,
    code: "AMP_LOCATION_UNKNOWN",
  },
  {
    name: "U2. location not asked, 90A",
    input: { inAustin: null },
    steps: { main_disconnect_closeup: { amp_rating: 90 } },
    verdict: "FAIL",
    code: "AMP_TOO_LOW",
  },
  {
    name: "U3. solar not asked, 150A",
    input: { hasSolar: null },
    steps: { main_disconnect_closeup: { amp_rating: 150 } },
    verdict: "REVIEW",
    code: "SOLAR_UNKNOWN",
  },
  {
    name: "U5. solar not asked, 125A (count is 1 either way)",
    input: { hasSolar: null },
    steps: { main_disconnect_closeup: { amp_rating: 125 } },
    verdict: "PASS",
    batteryCount: 1,
  },
  {
    name: "U4. location and solar not asked, 200A",
    input: { inAustin: null, hasSolar: null },
    verdict: "PASS",
    batteryCount: 2,
    code: "AMP_OK",
  },
];

describe("evaluate", () => {
  it.each(cases)("$name", (c) => {
    const result = evaluate(build(c));
    expect(result.verdict).toBe(c.verdict);
    if (c.batteryCount !== undefined) expect(result.batteryCount).toBe(c.batteryCount);
    if (c.code) {
      const reason = result.reasons.find((r) => r.code === c.code);
      expect(reason, `expected reason ${c.code}`).toBeDefined();
      if (c.codeOutcome) expect(reason!.outcome).toBe(c.codeOutcome);
    }
  });

  it("marks low-confidence downgrades in the message", () => {
    const result = evaluate(
      build({
        name: "closet low confidence",
        input: { setupType: "separate_meter_and_panel_outdoors" },
        steps: { panel_wide: { location: "closet", confidence: 60 } },
        verdict: "REVIEW",
      }),
    );
    const reason = result.reasons.find((r) => r.code === "PANEL_IN_LIVING_SPACE");
    expect(reason?.message.endsWith(" (low confidence)")).toBe(true);
  });

  it("sorts reasons FAIL, then REVIEW, then PASS", () => {
    const result = evaluate(
      build({
        name: "mixed",
        input: { inAustin: true },
        steps: {
          main_disconnect_closeup: { amp_rating: 125 },
          meter_area_wide: { gas_meter_near: true },
        },
        verdict: "FAIL",
      }),
    );
    const order = result.reasons.map((r) => r.outcome);
    const rank = { FAIL: 0, REVIEW: 1, PASS: 2 };
    expect(order).toEqual([...order].sort((a, b) => rank[a] - rank[b]));
  });

  it("flags a required step with no photo as STEP_MISSING", () => {
    const input = build({ name: "missing", verdict: "REVIEW" });
    input.photos = input.photos.filter((p) => p.step !== "adjacent_wall");
    const result = evaluate(input);
    expect(result.verdict).toBe("REVIEW");
    expect(result.reasons.some((r) => r.code === "STEP_MISSING" && r.step === "adjacent_wall")).toBe(true);
  });
});

describe("planSteps", () => {
  const combo = { setup_type: "combo_meter_main_unit" as const, panel_same_wall_answer: "not_asked" as const };

  it("skips panel_wide for combo units and behind_fence without a fence", () => {
    expect(planSteps(combo, [])).toEqual([
      "meter_area_wide",
      "meter_closeup",
      "left_of_meter",
      "right_of_meter",
      "adjacent_wall",
      "main_disconnect_closeup",
    ]);
  });

  it("inserts behind_fence in place when an accepted photo shows a fence", () => {
    const steps = planSteps(combo, [
      { step: "left_of_meter", status: "accepted", analysis: { ...GOOD, fence_present: true } },
    ]);
    expect(steps.indexOf("behind_fence")).toBe(steps.indexOf("adjacent_wall") + 1);
  });

  it("ignores fences seen only in retake photos", () => {
    const steps = planSteps(combo, [
      { step: "left_of_meter", status: "retake", analysis: { ...GOOD, fence_present: true } },
    ]);
    expect(steps).not.toContain("behind_fence");
  });

  it("includes panel_wide when setup is unknown", () => {
    expect(planSteps({ ...combo, setup_type: "unknown" }, [])).toContain("panel_wide");
  });

  it("runs the whole-site check after the regular steps, then the extra steps", () => {
    const done = planSteps(combo, []).map((step) => ({ step, status: "accepted" as const, analysis: GOOD }));
    expect(nextStep({ ...combo, site_check_status: "not_run" }, done)).toBe("site_check");
    const withExtras = { ...combo, site_check_status: "done" as const, extra_steps: [{ id: "extra_1" }, { id: "extra_2" }] };
    expect(planSteps(withExtras, done).slice(-2)).toEqual(["extra_1", "extra_2"]);
    expect(nextStep(withExtras, done)).toBe("extra_1");
    const oneExtra = [...done, { step: "extra_1", status: "accepted" as const, analysis: GOOD }];
    expect(nextStep(withExtras, oneExtra)).toBe("extra_2");
    expect(nextStep({ ...combo, site_check_status: "failed" }, done)).toBeNull();
  });

  it("asks regular steps before the whole-site check", () => {
    expect(nextStep({ ...combo, site_check_status: "not_run" }, [])).toBe("meter_area_wide");
  });
});
