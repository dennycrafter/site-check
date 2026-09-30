import { describe, expect, it } from "vitest";
import type { CorrectionInput } from "./corrections";
import { correctPhotosForExport } from "./exportCorrections";
import type { PhotoStatus } from "./types";
import { GOOD_ANALYSIS } from "./testing";

const photo = (id: string, step: string, status: PhotoStatus = "accepted", withAnalysis = true) => ({
  id,
  step,
  status,
  analysis: withAnalysis ? { ...GOOD_ANALYSIS, amp_rating: 125 } : null,
});

const fix = (photo_id: string, field: string, corrected_value: unknown): CorrectionInput => ({
  photo_id,
  field,
  corrected_value,
  created_at: "2026-09-30T10:00:00Z",
});

describe("correctPhotosForExport", () => {
  it("exports the corrected value, the AI value and the corrected field names", () => {
    const photos = [photo("main", "main_disconnect_closeup")];
    const [entry] = correctPhotosForExport(photos, [fix("main", "amp_rating", 150)]);
    expect(entry.photo.analysis?.amp_rating).toBe(150);
    expect(entry.aiAnalysis?.amp_rating).toBe(125);
    expect(entry.correctedFields).toEqual(["amp_rating"]);
    expect(photos[0].analysis?.amp_rating).toBe(125);
  });

  it("leaves uncorrected photos as they are, with no corrected fields", () => {
    const photos = [photo("left", "left_of_meter"), photo("nothing", "meter_closeup", "check_failed", false)];
    const out = correctPhotosForExport(photos, [fix("main", "amp_rating", 150)]);
    expect(out.map((e) => e.correctedFields)).toEqual([[], []]);
    expect(out[0].photo.analysis).toEqual(photos[0].analysis);
    expect(out[1].photo.analysis).toBeNull();
    expect(out[1].aiAnalysis).toBeNull();
  });

  it("makes a corrected kept-for-review photo accepted", () => {
    const photos = [photo("a", "main_disconnect_closeup", "accepted_after_max_attempts"), photo("b", "panel_open", "accepted_after_max_attempts")];
    const out = correctPhotosForExport(photos, [fix("a", "amp_rating", 150)]);
    expect(out[0].photo.status).toBe("accepted");
    expect(out[1].photo.status).toBe("accepted_after_max_attempts");
  });

  it("uses the latest correction and lists a field once", () => {
    const later = { ...fix("main", "amp_rating", 200), created_at: "2026-09-30T11:00:00Z" };
    const [entry] = correctPhotosForExport(
      [photo("main", "main_disconnect_closeup")],
      [fix("main", "amp_rating", 150), later],
    );
    expect(entry.photo.analysis?.amp_rating).toBe(200);
    expect(entry.correctedFields).toEqual(["amp_rating"]);
  });
});
