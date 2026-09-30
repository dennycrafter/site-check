import { describe, expect, it } from "vitest";
import type { CorrectionInput } from "./corrections";
import { correctionStats, labelEntries, type LabelHome, type LabelPhoto } from "./labeledData";
import { GOOD_ANALYSIS } from "./testing";

const photo = (id: string, home_id: string, step: string, attempt = 1, withAnalysis = true): LabelPhoto => ({
  id,
  home_id,
  step,
  attempt,
  storage_path: `${home_id}/${step}/${attempt}.jpg`,
  status: withAnalysis ? "accepted" : "check_failed",
  analysis: withAnalysis ? { ...GOOD_ANALYSIS, amp_rating: 125 } : null,
});

const homes: LabelHome[] = [
  { id: "h1", surveyor_decision: "approved", verdict: "PASS" },
  { id: "h2", surveyor_decision: null, verdict: "FAIL" },
];

const photos: LabelPhoto[] = [
  photo("old-main", "h1", "main_disconnect_closeup", 1),
  photo("main", "h1", "main_disconnect_closeup", 2),
  photo("left", "h1", "left_of_meter"),
  photo("closeup", "h1", "meter_closeup", 1, false),
  photo("other", "h2", "main_disconnect_closeup"),
];

const fix = (photo_id: string, field: string, corrected_value: unknown): CorrectionInput => ({
  photo_id,
  field,
  corrected_value,
  created_at: "2026-09-30T10:00:00Z",
});

const corrections = [
  fix("main", "amp_rating", 200),
  fix("main", "amp_rating", 200),
  fix("old-main", "damage_visible", true),
  fix("other", "amp_rating", 150),
];

describe("correctionStats", () => {
  it("counts editable readings on the latest photos of decided homes only", () => {
    // main: amp_rating, amp_rating_legible, damage_visible. left: clear_ground_space. closeup has no analysis.
    expect(correctionStats(homes, photos, corrections)).toEqual({ corrected: 1, total: 4 });
  });

  it("is 0 of 0 with no decided homes", () => {
    expect(correctionStats([homes[1]], photos, corrections)).toEqual({ corrected: 0, total: 0 });
  });
});

describe("labelEntries", () => {
  const entries = labelEntries(homes, photos, corrections);

  it("has one entry per latest photo of each decided home", () => {
    expect(entries.map((e) => e.photoId).sort()).toEqual(["closeup", "left", "main"]);
  });

  it("carries AI values, final values and the corrected fields", () => {
    const main = entries.find((e) => e.photoId === "main")!;
    expect(main).toMatchObject({
      homeId: "h1",
      step: "main_disconnect_closeup",
      storagePath: "h1/main_disconnect_closeup/2.jpg",
      finalValues: { amp_rating: 200, amp_rating_legible: true, damage_visible: false },
      correctedFields: ["amp_rating"],
      surveyorDecision: "approved",
      verdict: "PASS",
    });
    expect(main.aiAnalysis?.amp_rating).toBe(125);
  });

  it("keeps photos without analysis with empty values", () => {
    const closeup = entries.find((e) => e.photoId === "closeup")!;
    expect(closeup.aiAnalysis).toBeNull();
    expect(closeup.finalValues).toEqual({});
    expect(closeup.correctedFields).toEqual([]);
  });

  it("has only the listed keys, so no names or emails", () => {
    for (const e of entries) {
      expect(Object.keys(e).sort()).toEqual(
        ["aiAnalysis", "correctedFields", "finalValues", "homeId", "photoId", "step", "storagePath", "surveyorDecision", "verdict"].sort(),
      );
    }
  });
});
