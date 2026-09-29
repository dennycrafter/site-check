import { describe, expect, it } from "vitest";
import { sawLine } from "./sawLine";
import { GOOD_ANALYSIS } from "./testing";

const a = (over: Partial<typeof GOOD_ANALYSIS>) => ({ ...GOOD_ANALYSIS, ...over });

describe("sawLine", () => {
  it("describes the wide meter photo without needing the analysis", () => {
    expect(sawLine("meter_area_wide", null)).toBe("Got it: your meter and the wall around it.");
    expect(sawLine("meter_area_wide", GOOD_ANALYSIS)).toBe("Got it: your meter and the wall around it.");
  });

  it("describes the meter close-up", () => {
    expect(sawLine("meter_closeup", a({ meter_number_legible: true }))).toBe("Got it: meter numbers are readable.");
    expect(sawLine("meter_closeup", a({ meter_number_legible: false }))).toBe("Got it.");
  });

  it.each(["left_of_meter", "right_of_meter", "adjacent_wall", "behind_fence"])("describes clear ground for %s", (step) => {
    expect(sawLine(step, a({ clear_ground_space: "room_for_two" }))).toBe("Got it: plenty of clear ground here.");
    expect(sawLine(step, a({ clear_ground_space: "room_for_one" }))).toBe("Got it: some clear ground here.");
    expect(sawLine(step, a({ clear_ground_space: "none" }))).toBe("Got it.");
    expect(sawLine(step, a({ clear_ground_space: "unclear" }))).toBe("Got it.");
  });

  it("says where the breaker box is", () => {
    expect(sawLine("panel_wide", a({ location: "outdoor" }))).toBe("Got it: breaker box outside.");
    expect(sawLine("panel_wide", a({ location: "garage" }))).toBe("Got it: breaker box in the garage.");
    expect(sawLine("panel_wide", a({ location: "closet" }))).toBe("Got it: breaker box in a closet.");
    expect(sawLine("panel_wide", a({ location: "indoor_other" }))).toBe("Got it: breaker box indoors.");
    expect(sawLine("panel_wide", a({ location: "unknown" }))).toBe("Got it.");
  });

  it("reads back the main switch amps", () => {
    expect(sawLine("main_disconnect_closeup", a({ amp_rating: 200 }))).toBe("Got it: 200A main switch.");
    expect(sawLine("main_disconnect_closeup", a({ amp_rating: 100 }))).toBe("Got it: 100A main switch.");
    expect(sawLine("main_disconnect_closeup", a({ amp_rating_legible: false }))).toBe("Got it.");
    expect(sawLine("main_disconnect_closeup", a({ amp_rating: 0 }))).toBe("Got it.");
  });

  it("falls back to a plain line for other steps and missing analysis", () => {
    expect(sawLine("extra_1", GOOD_ANALYSIS)).toBe("Got it.");
    expect(sawLine("meter_closeup", null)).toBe("Got it.");
    expect(sawLine("panel_open", null)).toBe("Got it.");
  });

  it("never sounds like a verdict", () => {
    const steps = ["meter_area_wide", "meter_closeup", "left_of_meter", "panel_wide", "panel_open", "main_disconnect_closeup"];
    for (const step of steps) {
      expect(sawLine(step, GOOD_ANALYSIS)).not.toMatch(/pass|fail|approve|battery|batteries|hazard|qualif|problem/i);
    }
  });
});
