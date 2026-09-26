import type { PhotoAnalysis } from "./schema";
import type { StepId } from "./steps";

export const MESSAGES = {
  accepted: "Looks good",
  checkFailed: "Got it. We'll double-check this one.",
  maxAttempts: "Thanks, a surveyor will take a look at this one.",
} as const;

const RETAKE_FALLBACK: Record<PhotoAnalysis["retake_reason"], string> = {
  too_dark: "It's too dark. Turn on your flash or retake in daylight.",
  blurry: "The photo is blurry. Hold still and tap the screen to focus.",
  too_close: "Step back so we can see more around it.",
  too_far: "Move closer so it fills the outline.",
  wrong_subject: "This doesn't look like the right thing. Check the outline and try again.",
  lid_closed: "Lift the lid so we can see the main switch.",
  view_blocked: "Something is in the way. Clear the area if you can, then retake.",
  text_unreadable: "We can't read the number. Move closer and tap to focus.",
  none: "We couldn't use this photo. Please try again.",
};

export type PhotoDecision = { accept: true } | { accept: false; message: string };

/** Section 8.5: whether a successfully analyzed photo is usable for its step. */
export function decidePhoto(step: StepId, a: PhotoAnalysis): PhotoDecision {
  const retake =
    !a.photo_matches_request ||
    !a.usable ||
    a.retake_reason !== "none" ||
    (step === "meter_closeup" && !a.meter_number_legible) ||
    (step === "main_disconnect_closeup" && !a.amp_rating_legible);
  if (!retake) return { accept: true };
  const instruction = a.retake_instruction.trim();
  return { accept: false, message: instruction || RETAKE_FALLBACK[a.retake_reason] };
}
