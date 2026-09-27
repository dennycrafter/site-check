import { describe, expect, it } from "vitest";
import { deriveSetupType, type PlanPhoto } from "./plan";
import type { PhotoAnalysis } from "./schema";
import { GOOD_ANALYSIS } from "./testing";

const photo = (step: string, status: PlanPhoto["status"], setup: PhotoAnalysis["setup_type"], attempt = 1): PlanPhoto => ({
  step,
  status,
  attempt,
  analysis: { ...GOOD_ANALYSIS, setup_type: setup },
});

describe("deriveSetupType", () => {
  it("trusts an accepted wide photo over the other photos", () => {
    expect(
      deriveSetupType([
        photo("meter_area_wide", "accepted", "combo_meter_main_unit"),
        photo("meter_closeup", "accepted", "separate_meter_and_panel_outdoors"),
        photo("left_of_meter", "accepted", "separate_meter_and_panel_outdoors"),
      ]),
    ).toBe("combo_meter_main_unit");
  });

  it("falls back to the other accepted photos when the wide photo was kept after retakes", () => {
    expect(
      deriveSetupType([
        photo("meter_area_wide", "retake", "unknown", 1),
        photo("meter_area_wide", "accepted_after_max_attempts", "unknown", 2),
        photo("meter_closeup", "accepted", "separate_meter_and_panel_outdoors"),
        photo("left_of_meter", "accepted", "separate_meter_and_panel_outdoors"),
        photo("right_of_meter", "accepted", "separate_meter_and_panel_outdoors"),
      ]),
    ).toBe("separate_meter_and_panel_outdoors");
  });

  it("is unknown when no other photo votes", () => {
    expect(
      deriveSetupType([
        photo("meter_area_wide", "accepted_after_max_attempts", "combo_meter_main_unit"),
        photo("meter_closeup", "accepted", "unknown"),
        photo("left_of_meter", "accepted", "panel_not_visible"),
      ]),
    ).toBe("unknown");
  });

  it("is unknown on a tie", () => {
    expect(
      deriveSetupType([
        photo("meter_closeup", "accepted", "combo_meter_main_unit"),
        photo("left_of_meter", "accepted", "separate_meter_and_panel_outdoors"),
      ]),
    ).toBe("unknown");
  });
});
