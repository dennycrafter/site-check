import type { PhotoAnalysis } from "./schema";

const GENERIC = "Got it.";

const SPACE_STEPS = ["left_of_meter", "right_of_meter", "adjacent_wall", "behind_fence"];

const PANEL_PLACE: Partial<Record<PhotoAnalysis["location"], string>> = {
  outdoor: "outside",
  garage: "in the garage",
  closet: "in a closet",
  indoor_other: "indoors",
};

/**
 * One short, friendly line for an accepted photo, built from the analysis with no extra AI call.
 * Never a verdict, a battery count, a hazard, or anything that sounds like pass or fail.
 */
export function sawLine(step: string, analysis: PhotoAnalysis | null): string {
  if (step === "meter_area_wide") return "Got it: your meter and the wall around it.";
  if (!analysis) return GENERIC;

  if (step === "meter_closeup") {
    return analysis.meter_number_legible ? "Got it: meter numbers are readable." : GENERIC;
  }
  if (SPACE_STEPS.includes(step)) {
    if (analysis.clear_ground_space === "room_for_two") return "Got it: plenty of clear ground here.";
    if (analysis.clear_ground_space === "room_for_one") return "Got it: some clear ground here.";
    return GENERIC;
  }
  if (step === "panel_wide") {
    const place = PANEL_PLACE[analysis.location];
    return place ? `Got it: breaker box ${place}.` : GENERIC;
  }
  if (step === "panel_open") return "Got it: the inside of your breaker box.";
  if (step === "main_disconnect_closeup") {
    return analysis.amp_rating_legible && analysis.amp_rating > 0 ? `Got it: ${analysis.amp_rating}A main switch.` : GENERIC;
  }
  return GENERIC;
}
