import { describe, expect, it } from "vitest";
import { centerCrop } from "./image";

describe("centerCrop", () => {
  it("crops the sides of a landscape frame for a portrait stage", () => {
    expect(centerCrop(1920, 1080, 0.5)).toEqual({ x: 690, y: 0, width: 540, height: 1080 });
  });

  it("crops the top and bottom when the stage is wider than the frame", () => {
    expect(centerCrop(1080, 1920, 1)).toEqual({ x: 0, y: 420, width: 1080, height: 1080 });
  });

  it("keeps the whole frame for a bad ratio", () => {
    expect(centerCrop(640, 480, 0)).toEqual({ x: 0, y: 0, width: 640, height: 480 });
  });
});
