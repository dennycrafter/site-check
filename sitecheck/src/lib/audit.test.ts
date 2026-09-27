import { describe, expect, it } from "vitest";
import { aiSaid, auditStats, filterAudit, parseAuditTab, type AuditPhoto } from "./audit";
import { GOOD_ANALYSIS } from "./testing";

let n = 0;
function photo(extra: Partial<AuditPhoto>): AuditPhoto {
  n += 1;
  return {
    id: `p${n}`,
    created_at: new Date(Date.UTC(2026, 0, 1, 0, n)).toISOString(),
    home_id: "h1",
    step: "meter_closeup",
    attempt: 1,
    status: "accepted",
    analysis: GOOD_ANALYSIS,
    error: null,
    latency_ms: 1000,
    ai_attempts: 1,
    ...extra,
  };
}

const ok = photo({});
const retried = photo({ ai_attempts: 2, latency_ms: 3000 });
const failed = photo({ status: "check_failed", ai_attempts: 3, analysis: null, error: "Timed out", latency_ms: null });
const retake = photo({ status: "retake", analysis: { ...GOOD_ANALYSIS, retake_reason: "too_dark", retake_instruction: "" } });
const kept = photo({ status: "accepted_after_max_attempts", analysis: { ...GOOD_ANALYSIS, retake_instruction: "Step back." } });
const all = [ok, retried, failed, retake, kept];

describe("audit", () => {
  it("counts the stats", () => {
    expect(auditStats(all)).toEqual({
      total: 5,
      firstTryRate: 60,
      retried: 2,
      failed: 1,
      retakes: 1,
      kept: 1,
      avgLatencyMs: 1500,
    });
    expect(auditStats([]).firstTryRate).toBeNull();
  });

  it("filters by tab, newest first", () => {
    expect(filterAudit(all, "all").map((p) => p.id)).toEqual([kept.id, retake.id, failed.id, retried.id]);
    expect(filterAudit(all, "check_failed")).toEqual([failed]);
    expect(filterAudit(all, "retake")).toEqual([retake]);
    expect(filterAudit(all, "kept")).toEqual([kept]);
    expect(filterAudit(all, "retried").map((p) => p.id)).toEqual([failed.id, retried.id]);
  });

  it("parses unknown tabs as all", () => {
    expect(parseAuditTab("retake")).toBe("retake");
    expect(parseAuditTab("nope")).toBe("all");
    expect(parseAuditTab(undefined)).toBe("all");
  });

  it("says what the AI said", () => {
    expect(aiSaid(failed)).toBe("Timed out");
    expect(aiSaid(retake)).toBe("Too dark");
    expect(aiSaid(kept)).toBe("Step back.");
  });
});
