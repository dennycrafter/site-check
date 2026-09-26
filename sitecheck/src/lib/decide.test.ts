import { describe, expect, it } from "vitest";
import { decidePhoto } from "./decide";
import type { PhotoAnalysis } from "./schema";

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

  it("retakes a meter close-up with the box cut off", () => {
    expect(retakeMessage("meter_closeup", { meter_can_edges_visible: false })).toBe(
      "Step back a little so the whole meter box fits, with some wall around it.",
    );
  });

  it("retakes wall photos without ground, before checking the wall end", () => {
    expect(retakeMessage("left_of_meter", { ground_visible: false, wall_end_visible: false })).toBe(
      "Tilt your phone down a little so we can see the ground by the wall.",
    );
    expect(retakeMessage("right_of_meter", { wall_end_visible: false })).toBe(
      "Step back until you can see where this wall ends.",
    );
  });

  it("does not apply wall_end_visible to the wide meter photo", () => {
    expect(decidePhoto("meter_area_wide", { ...GOOD, wall_end_visible: false }).accept).toBe(true);
  });

  it("retakes a breaker box photo without surroundings", () => {
    expect(retakeMessage("panel_wide", { panel_context_visible: false })).toBe(
      "Step back so we can see the room or wall around the breaker box.",
    );
  });

  it("prefers the model's own retake instruction", () => {
    expect(
      retakeMessage("meter_closeup", { meter_can_edges_visible: false, retake_instruction: "Back up one step." }),
    ).toBe("Back up one step.");
  });

  it("falls back to the retake reason message when no trigger failed", () => {
    expect(retakeMessage("meter_area_wide", { usable: false, retake_reason: "too_dark" })).toBe(
      "It's too dark. Turn on your flash or retake in daylight.",
    );
  });
});
