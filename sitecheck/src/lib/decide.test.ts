import { describe, expect, it } from "vitest";
import { canKeep, decidePhoto } from "./decide";
import type { PhotoAnalysis } from "./schema";
import { GOOD_ANALYSIS } from "./testing";

const GOOD = GOOD_ANALYSIS;

const retakeMessage = (step: Parameters<typeof decidePhoto>[0], a: Partial<PhotoAnalysis>) => {
  const d = decidePhoto(step, { ...GOOD, ...a });
  return d.accept ? null : d.message;
};

describe("decidePhoto decidability triggers", () => {
  it("accepts a good photo on every step", () => {
    for (const step of ["meter_area_wide", "meter_closeup", "left_of_meter", "panel_wide"] as const) {
      expect(decidePhoto(step, GOOD).accept).toBe(true);
    }
  });

  it("accepts a meter close-up with the box cut off when the number is readable, locked or not", () => {
    for (const locked of [false, true]) {
      const a = { ...GOOD, meter_number_legible: true, meter_in_locked_cabinet: locked, meter_can_edges_visible: false };
      expect(decidePhoto("meter_closeup", a).accept).toBe(true);
    }
  });

  it("retakes a locked cabinet close-up with the cabinet cut off and the number not readable", () => {
    const a = { meter_number_legible: false, meter_in_locked_cabinet: true, meter_can_edges_visible: false };
    expect(retakeMessage("meter_closeup", a)).toBe(
      "Step back a little so the whole meter box fits, with some wall around it.",
    );
  });

  it("accepts a locked cabinet close-up with the cabinet in frame and the number not readable", () => {
    const a = { ...GOOD, meter_in_locked_cabinet: true, meter_can_edges_visible: true, meter_number_legible: false };
    expect(decidePhoto("meter_closeup", a).accept).toBe(true);
  });

  it("retakes a normal meter close-up when the number is not readable", () => {
    const a = { ...GOOD, meter_in_locked_cabinet: false, meter_can_edges_visible: true, meter_number_legible: false };
    expect(decidePhoto("meter_closeup", a).accept).toBe(false);
  });

  it("retakes wall photos without ground, before checking how much wall is shown", () => {
    expect(retakeMessage("left_of_meter", { ground_visible: false, enough_wall_shown: false })).toBe(
      "Tilt your phone down a little so we can see the ground by the wall.",
    );
    expect(retakeMessage("right_of_meter", { enough_wall_shown: false })).toBe(
      "Step back so we can see more of the wall and the ground in front of it.",
    );
  });

  it("does not apply enough_wall_shown to the wide meter photo", () => {
    expect(decidePhoto("meter_area_wide", { ...GOOD, enough_wall_shown: false }).accept).toBe(true);
  });

  it("retakes a breaker box photo without surroundings", () => {
    expect(retakeMessage("panel_wide", { panel_context_visible: false })).toBe(
      "Step back so we can see the room or wall around the breaker box.",
    );
  });

  it("prefers the model's own retake instruction", () => {
    expect(
      retakeMessage("meter_closeup", {
        meter_can_edges_visible: false,
        meter_number_legible: false,
        retake_instruction: "Back up one step.",
      }),
    ).toBe("Back up one step.");
  });

  it("treats an older analysis without meter_in_locked_cabinet as a normal meter", () => {
    const old = Object.fromEntries(Object.entries(GOOD).filter(([k]) => k !== "meter_in_locked_cabinet"));
    expect(decidePhoto("meter_closeup", old as PhotoAnalysis).accept).toBe(true);
    expect(decidePhoto("meter_closeup", { ...old, meter_number_legible: false } as PhotoAnalysis).accept).toBe(false);
  });

  it("falls back to the retake reason message when no trigger failed", () => {
    expect(retakeMessage("meter_area_wide", { usable: false, retake_reason: "too_dark" })).toBe(
      "It's too dark. Turn on your flash or retake in daylight.",
    );
  });
});

describe("canKeep", () => {
  it("never allows keeping on the first attempt", () => {
    expect(canKeep(1, GOOD)).toBe(false);
  });

  it("allows keeping a photo of the right thing from attempt 2", () => {
    expect(canKeep(2, GOOD)).toBe(true);
  });

  it("never allows keeping a photo of the wrong subject", () => {
    expect(canKeep(2, { ...GOOD, retake_reason: "wrong_subject" })).toBe(false);
  });

  it("never allows keeping a photo that does not match the request", () => {
    expect(canKeep(2, { ...GOOD, photo_matches_request: false })).toBe(false);
  });

  it("never allows keeping a photo without an analysis", () => {
    expect(canKeep(2, null)).toBe(false);
  });
});
