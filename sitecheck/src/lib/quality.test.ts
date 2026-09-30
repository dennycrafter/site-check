import { afterEach, describe, expect, it, vi } from "vitest";
import { RETAKE_FALLBACK } from "./decide";
import { instantCheck, type GrayImage } from "./instantCheck";
import { MIN_BRIGHTNESS, MIN_SHARPNESS, measureQuality, qualityFailure } from "./quality";

const SIZE = 64;

function image(fill: (x: number, y: number) => number): GrayImage {
  const data = new Uint8Array(SIZE * SIZE);
  for (let y = 0; y < SIZE; y++) for (let x = 0; x < SIZE; x++) data[y * SIZE + x] = fill(x, y);
  return { data, width: SIZE, height: SIZE };
}

const black = image(() => 0);
const flatGray = image(() => 128);
const checkerboard = image((x, y) => ((x + y) % 2 === 0 ? 0 : 255));

const scores = (img: GrayImage) => measureQuality(img.data, img.width, img.height);

describe("measureQuality", () => {
  it("fails brightness for an all black image", () => {
    const quality = scores(black);
    expect(quality.brightness).toBe(0);
    expect(quality.brightness).toBeLessThan(MIN_BRIGHTNESS);
    expect(qualityFailure(quality)).toBe("too_dark");
  });

  it("fails sharpness for a flat gray image", () => {
    const quality = scores(flatGray);
    expect(quality.brightness).toBe(128);
    expect(quality.sharpness).toBe(0);
    expect(quality.sharpness).toBeLessThan(MIN_SHARPNESS);
    expect(qualityFailure(quality)).toBe("blurry");
  });

  it("passes both for a checkerboard", () => {
    const quality = scores(checkerboard);
    expect(quality.brightness).toBeGreaterThanOrEqual(MIN_BRIGHTNESS);
    expect(quality.sharpness).toBeGreaterThanOrEqual(MIN_SHARPNESS);
    expect(qualityFailure(quality)).toBeNull();
  });

  it("returns zero sharpness for images too small to measure", () => {
    expect(measureQuality([10, 20], 2, 1)).toEqual({ brightness: 15, sharpness: 0 });
  });
});

describe("instantCheck", () => {
  afterEach(() => vi.restoreAllMocks());

  it("rejects with the existing too_dark and blurry messages", () => {
    vi.spyOn(console, "log").mockImplementation(() => {});
    const streaks = new Map<string, number>();
    expect(instantCheck("meter_closeup", black, streaks)).toEqual({ pass: false, message: RETAKE_FALLBACK.too_dark });
    expect(instantCheck("left_of_meter", flatGray, streaks)).toEqual({ pass: false, message: RETAKE_FALLBACK.blurry });
  });

  it("logs one line per photo, pass or fail", () => {
    const log = vi.spyOn(console, "log").mockImplementation(() => {});
    const streaks = new Map<string, number>();
    instantCheck("meter_closeup", black, streaks);
    instantCheck("meter_closeup", checkerboard, streaks);
    expect(log.mock.calls.map((call) => call[0])).toEqual([
      "[quality] step=meter_closeup brightness=0.0 sharpness=0.0 pass=false",
      "[quality] step=meter_closeup brightness=127.5 sharpness=" + scores(checkerboard).sharpness.toFixed(1) + " pass=true",
    ]);
  });

  it("lets the third photo in a row for a step through, still logging its scores", () => {
    const log = vi.spyOn(console, "log").mockImplementation(() => {});
    const streaks = new Map<string, number>();
    expect(instantCheck("meter_closeup", black, streaks).pass).toBe(false);
    expect(instantCheck("meter_closeup", black, streaks).pass).toBe(false);
    expect(instantCheck("meter_closeup", black, streaks)).toEqual({ pass: true });
    expect(log).toHaveBeenCalledTimes(3);
    expect(log.mock.calls[2][0]).toContain("pass=false");
    expect(instantCheck("meter_closeup", black, streaks).pass).toBe(false);
  });

  it("counts failures per step and resets after a good photo", () => {
    vi.spyOn(console, "log").mockImplementation(() => {});
    const streaks = new Map<string, number>();
    instantCheck("meter_closeup", black, streaks);
    instantCheck("left_of_meter", black, streaks);
    instantCheck("meter_closeup", checkerboard, streaks);
    expect(instantCheck("meter_closeup", black, streaks).pass).toBe(false);
    expect(instantCheck("meter_closeup", black, streaks).pass).toBe(false);
    expect(instantCheck("left_of_meter", black, streaks).pass).toBe(false);
  });
});
