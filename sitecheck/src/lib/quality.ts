/** Starting values, not tuned on real photos yet. Change them here. */
export const MIN_BRIGHTNESS = 40;
export const MIN_SHARPNESS = 60;

/** Long edge, in pixels, of the downscaled copy the scores are measured on. */
export const QUALITY_EDGE = 256;

export type Quality = { brightness: number; sharpness: number };

export type QualityFailure = "too_dark" | "blurry";

/** Mean luminance of grayscale values (0 to 255). */
export function brightnessOf(gray: ArrayLike<number>): number {
  if (gray.length === 0) return 0;
  let sum = 0;
  for (let i = 0; i < gray.length; i++) sum += gray[i];
  return sum / gray.length;
}

/** Variance of the 4-neighbour Laplacian over the interior pixels. Higher means more edge detail. */
export function sharpnessOf(gray: ArrayLike<number>, width: number, height: number): number {
  if (width < 3 || height < 3) return 0;
  let sum = 0;
  let sumSquares = 0;
  let count = 0;
  for (let y = 1; y < height - 1; y++) {
    for (let x = 1; x < width - 1; x++) {
      const i = y * width + x;
      const value = gray[i - width] + gray[i + width] + gray[i - 1] + gray[i + 1] - 4 * gray[i];
      sum += value;
      sumSquares += value * value;
      count++;
    }
  }
  const mean = sum / count;
  return sumSquares / count - mean * mean;
}

/** Scores for a grayscale image (row by row, width x height values). */
export function measureQuality(gray: ArrayLike<number>, width: number, height: number): Quality {
  return { brightness: brightnessOf(gray), sharpness: sharpnessOf(gray, width, height) };
}

/** Too dark wins over blurry: a dark photo is nearly always low on detail too, and light is the fix. */
export function qualityFailure(quality: Quality): QualityFailure | null {
  if (quality.brightness < MIN_BRIGHTNESS) return "too_dark";
  if (quality.sharpness < MIN_SHARPNESS) return "blurry";
  return null;
}
