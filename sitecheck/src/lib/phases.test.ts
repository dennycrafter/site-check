import { describe, expect, it } from "vitest";
import { phaseProgress, plannedForPhase, stepLabel } from "./phases";
import { PHASE_TITLES, phaseOf, STEPS } from "./steps";
import type { PhotoStatus } from "./types";

const status = (map: Record<string, PhotoStatus>) => (id: string) => map[id] ?? "pending";

describe("phases", () => {
  it("gives every step a phase, in order, with the agreed titles", () => {
    expect(Object.values(PHASE_TITLES)).toEqual(["Your meter", "The space around it", "Your breaker box"]);
    const phases = STEPS.map((s) => s.phase);
    expect([...phases].sort()).toEqual(phases);
    expect(phaseOf("meter_closeup")).toBe(1);
    expect(phaseOf("behind_fence")).toBe(2);
    expect(phaseOf("main_disconnect_closeup")).toBe(3);
    expect(phaseOf("extra_1")).toBe(3);
  });

  it("plans only the regular steps of the phase", () => {
    const plan = ["meter_area_wide", "meter_closeup", "left_of_meter", "right_of_meter", "adjacent_wall", "main_disconnect_closeup", "extra_1"];
    expect(plannedForPhase(plan, 1)).toEqual(["meter_area_wide", "meter_closeup"]);
    expect(plannedForPhase(plan, 2)).toEqual(["left_of_meter", "right_of_meter", "adjacent_wall"]);
    expect(plannedForPhase(plan, 3)).toEqual(["main_disconnect_closeup"]);
  });

  it("counts Photo Y of Z from the planned photos", () => {
    const planned = ["left_of_meter", "right_of_meter", "adjacent_wall"];
    const p = phaseProgress("right_of_meter", planned, status({ left_of_meter: "accepted" }));
    expect(p).toMatchObject({ part: 2, partCount: 3, photo: 2, photoCount: 3, extra: false });
    expect(p.segments).toEqual([1, 1 / 3, 0]);
  });

  it("keeps Z when a conditional step appears mid-phase and labels it as extra", () => {
    const planned = ["left_of_meter", "right_of_meter", "adjacent_wall"];
    const done = status({ left_of_meter: "accepted", right_of_meter: "accepted", adjacent_wall: "accepted" });
    const p = phaseProgress("behind_fence", planned, done);
    expect(p).toMatchObject({ part: 2, photo: 3, photoCount: 3, extra: true });
    expect(p.segments).toEqual([1, 1, 0]);
    expect(stepLabel("behind_fence", "Behind the fence", p.extra)).toBe("One extra photo: Behind the fence");
  });

  it("counts a conditional step planned at phase start like any other photo", () => {
    const planned = ["left_of_meter", "right_of_meter", "adjacent_wall", "behind_fence"];
    const p = phaseProgress("behind_fence", planned, status({}));
    expect(p).toMatchObject({ photo: 4, photoCount: 4, extra: false });
    expect(stepLabel("behind_fence", "Behind the fence", p.extra)).toBe("Behind the fence");
  });

  it("labels extras from the whole-site check without repeating the title", () => {
    expect(stepLabel("extra_1", "One more photo", true)).toBe("One extra photo");
  });

  it("never moves the bar backwards", () => {
    const planned = ["meter_area_wide", "meter_closeup"];
    const fills = [
      phaseProgress("meter_area_wide", planned, status({})).segments[0],
      phaseProgress("meter_closeup", planned, status({ meter_area_wide: "accepted" })).segments[0],
      phaseProgress("left_of_meter", ["left_of_meter"], status({})).segments[0],
    ];
    expect(fills).toEqual([0, 0.5, 1]);
  });

  it("fills every segment when redoing a photo from the summary", () => {
    const p = phaseProgress("meter_closeup", ["meter_area_wide", "meter_closeup"], status({ meter_area_wide: "accepted" }), true);
    expect(p.segments).toEqual([1, 1, 1]);
  });
});
