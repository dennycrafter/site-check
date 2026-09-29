import { describe, expect, it } from "vitest";
import { checkpointState, followUpStep, rowFromResult, type CheckpointRow } from "./checkpoint";

const accepted: CheckpointRow = { kind: "accepted", saw: "Got it." };
const retake: CheckpointRow = { kind: "retake", message: "Too dark." };

describe("checkpoint", () => {
  it("says it is checking while any photo is still pending, and keeps Continue locked", () => {
    const state = checkpointState(1, [accepted, { kind: "checking" }]);
    expect(state).toMatchObject({ title: "Checking your photos", pending: 1, settled: false });
  });

  it("counts retakes and failed requests as quick fixes", () => {
    expect(checkpointState(2, [accepted, retake, { kind: "surveyor" }])).toMatchObject({ title: "1 quick fix", fixes: 1, settled: false });
    expect(checkpointState(2, [retake, { kind: "failed" }, accepted])).toMatchObject({ title: "2 quick fixes", fixes: 2, settled: false });
  });

  it("is done when nothing is pending and nothing needs a fix", () => {
    expect(checkpointState(1, [accepted, { kind: "surveyor" }])).toMatchObject({ title: "Your meter: done", settled: true });
    expect(checkpointState(3, [accepted]).title).toBe("Your breaker box: done");
  });

  it("maps photo results to rows", () => {
    expect(rowFromResult("accepted", "Got it: 200A main switch.", "Looks good")).toEqual({ kind: "accepted", saw: "Got it: 200A main switch." });
    expect(rowFromResult("retake", undefined, "Open the lid.")).toEqual({ kind: "retake", message: "Open the lid." });
    expect(rowFromResult("check_failed", undefined, "x")).toEqual({ kind: "surveyor" });
    expect(rowFromResult("accepted_after_max_attempts", undefined, "x")).toEqual({ kind: "surveyor" });
    expect(rowFromResult("pending", undefined, undefined)).toEqual({ kind: "failed" });
  });

  it("opens a follow-up step only when the next step belongs to the same phase", () => {
    expect(followUpStep("behind_fence", 2)).toBe("behind_fence");
    expect(followUpStep("panel_wide", 2)).toBeNull();
    expect(followUpStep("question_5", 3)).toBeNull();
    expect(followUpStep("site_check", 3)).toBeNull();
    expect(followUpStep("extra_1", 3)).toBeNull();
    expect(followUpStep(null, 1)).toBeNull();
  });
});
