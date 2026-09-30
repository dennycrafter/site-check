import { RETAKE_FALLBACK } from "./decide";
import { measureQuality, qualityFailure } from "./quality";

/** Grayscale pixels of a downscaled copy of a photo, row by row. */
export type GrayImage = { data: ArrayLike<number>; width: number; height: number };

export type InstantResult = { pass: true } | { pass: false; message: string };

/** The third photo in a row for the same step goes to the AI without this check. */
const FAILS_BEFORE_SKIP = 2;

/**
 * The one on-phone check. The camera, the library upload and (later) the demo camera all call it
 * with the step and the grayscale copy of the photo before anything is sent. `failStreaks` counts
 * failures in a row per step and lives as long as the page.
 */
export function instantCheck(step: string, image: GrayImage, failStreaks: Map<string, number>): InstantResult {
  const quality = measureQuality(image.data, image.width, image.height);
  const failure = qualityFailure(quality);
  console.log(
    `[quality] step=${step} brightness=${quality.brightness.toFixed(1)} sharpness=${quality.sharpness.toFixed(1)} pass=${failure === null}`,
  );
  if (failure === null) {
    failStreaks.delete(step);
    return { pass: true };
  }
  const streak = failStreaks.get(step) ?? 0;
  if (streak >= FAILS_BEFORE_SKIP) {
    failStreaks.delete(step);
    return { pass: true };
  }
  failStreaks.set(step, streak + 1);
  return { pass: false, message: RETAKE_FALLBACK[failure] };
}
