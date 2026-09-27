import type { StepId } from "./steps";

/**
 * Example photo shown above the camera on each capture step.
 * image: tile number, /photo-guides/photo-<image>.webp (styled by .sc-example-<image>).
 * guide: framing box drawn on the example (.sc-guide-<guide>).
 * photo: a full image that replaces the tile when no tile fits.
 */
export type Guide = { image: number; guide: number; angle: string; photo?: string };

/** Every regular step must have an entry here. guides.test.ts fails if one is missing. */
export const GUIDE: Record<StepId, Guide> = {
  meter_closeup: { image: 1, guide: 0, angle: "Stand straight in front of the meter." },
  meter_area_wide: { image: 2, guide: 1, angle: "Walk back only as far as it is safe." },
  left_of_meter: { image: 4, guide: 2, angle: "Keep the meter at the right edge." },
  right_of_meter: { image: 3, guide: 3, angle: "Keep the meter at the left edge." },
  adjacent_wall: { image: 5, guide: 4, angle: "Stand back to fit the whole wall." },
  // No photo of a fenced side yard exists yet. The corner-to-corner wall tile shows the
  // same framing (whole wall and ground, corner to corner), so it stands in until one does.
  behind_fence: { image: 5, guide: 4, angle: "Look over or through the gate. Never climb the fence." },
  panel_wide: { image: 6, guide: 5, angle: "Stand straight in front of the panel." },
  panel_open: {
    image: 6,
    guide: 5,
    photo: "/find-breaker.webp",
    angle: "Open only the hinged door. Never remove screws or covers.",
  },
  main_disconnect_closeup: {
    image: 7,
    guide: 6,
    angle: "Open only the hinged door. Never remove screws or covers.",
  },
};

/** Extra photos (extra_<n>) the whole-site check asks for are walls and ground, so they reuse the wall tile. */
const EXTRA_GUIDE: Guide = { image: 5, guide: 4, angle: "Stand back to fit the whole area." };

/** Always returns an example, so no step ever shows an empty space. */
export function guideFor(stepId: string): Guide {
  return Object.hasOwn(GUIDE, stepId) ? GUIDE[stepId as StepId] : EXTRA_GUIDE;
}
