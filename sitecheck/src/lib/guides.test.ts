import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { GUIDE, guideFor } from "./guides";
import { STEP_IDS } from "./steps";

const root = path.resolve(import.meta.dirname, "../..");
const css = readFileSync(path.join(root, "src/styles/customer-flow.css"), "utf8");

// Conditional steps (behind_fence, panel_wide, panel_open, extra_<n>) only show up for some
// homes, so a manual run-through can miss them. This checks every step without needing a photo.
describe("example photos", () => {
  it.each(STEP_IDS)("%s has its own example photo", (id) => {
    expect(Object.hasOwn(GUIDE, id)).toBe(true);
  });

  it.each(STEP_IDS)("%s example image exists and is styled", (id) => {
    const guide = GUIDE[id];
    if (guide.photo) {
      expect(existsSync(path.join(root, "public", guide.photo))).toBe(true);
      return;
    }
    expect(existsSync(path.join(root, `public/photo-guides/photo-${guide.image}.webp`))).toBe(true);
    expect(css).toContain(`.sc-example-${guide.image}{`);
  });

  it("gives extra photos from the whole-site check an example too", () => {
    expect(guideFor("extra_1")).toBeDefined();
    expect(guideFor("extra_2").angle.length).toBeGreaterThan(0);
  });
});
