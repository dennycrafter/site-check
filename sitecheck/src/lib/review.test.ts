import { describe, expect, it } from "vitest";
import {
  decidedToday,
  decisionLabel,
  filterQueue,
  groupReasons,
  parseQueueFilter,
  QUEUE_FILTERS,
  queueTab,
  topReason,
  valueLabel,
  verdictLabel,
  waitingTime,
} from "./review";
import { AI_SETUP_TYPES, GROUND_SPACE, LOCATIONS, PANEL_BRANDS, PHOTO_ANALYSIS_SCHEMA, RETAKE_REASONS } from "./schema";
import type { Outcome, Reason } from "./types";

const reason = (code: string, outcome: Outcome, step: string | null = null, message = `${code} message`): Reason => ({
  code,
  outcome,
  message,
  step,
});

describe("verdictLabel", () => {
  it("uses plain words, never all caps", () => {
    expect(verdictLabel("PASS")).toBe("Pass");
    expect(verdictLabel("FAIL")).toBe("Fail");
    expect(verdictLabel("REVIEW")).toBe("Needs review");
  });

  it("handles a home with no verdict yet", () => {
    expect(verdictLabel(null)).toBe("Not checked yet");
    expect(verdictLabel(undefined)).toBe("Not checked yet");
  });
});

describe("decisionLabel", () => {
  it("labels each surveyor decision", () => {
    expect(decisionLabel("approved")).toBe("Approved");
    expect(decisionLabel("rejected")).toBe("Rejected");
    expect(decisionLabel("needs_site_visit")).toBe("Needs site visit");
  });

  it("says Undecided when there is no decision", () => {
    expect(decisionLabel(null)).toBe("Undecided");
    expect(decisionLabel(undefined)).toBe("Undecided");
  });
});

describe("valueLabel", () => {
  it("matches the examples from the ticket", () => {
    expect(valueLabel("clear_ground_space", "room_for_one")).toBe("Room for 1 battery");
    expect(valueLabel("clear_ground_space", "room_for_two")).toBe("Room for 2 batteries");
    expect(valueLabel("clear_ground_space", "none")).toBe("No clear space");
    expect(valueLabel("clear_ground_space", "unclear")).toBe("Unclear");
    expect(valueLabel("retake_reason", "wrong_subject")).toBe("Wrong thing photographed");
    expect(valueLabel("retake_reason", "too_dark")).toBe("Too dark");
    expect(valueLabel("retake_reason", "lid_closed")).toBe("Lid closed");
    expect(valueLabel("location", "outdoor")).toBe("Outside wall");
    expect(valueLabel("panel_brand", "other")).toBe("Unknown brand");
    expect(valueLabel("heavy_rust", true)).toBe("Yes");
    expect(valueLabel("heavy_rust", false)).toBe("No");
    expect(valueLabel("amp_rating", 0)).toBe("Unknown");
  });

  it("gives every enum value in the analysis schema a plain label", () => {
    const enums: [string, readonly string[]][] = [
      ["retake_reason", RETAKE_REASONS],
      ["setup_type", AI_SETUP_TYPES],
      ["location", LOCATIONS],
      ["clear_ground_space", GROUND_SPACE],
      ["panel_brand", PANEL_BRANDS],
    ];
    for (const [field, values] of enums) {
      for (const value of values) {
        const label = valueLabel(field, value);
        expect(label, `${field}=${value}`).not.toContain("_");
        expect(label, `${field}=${value}`).toMatch(/^[A-Z0-9]/);
      }
    }
  });

  it("covers every enum field the schema declares", () => {
    const enumFields = Object.entries(PHOTO_ANALYSIS_SCHEMA.properties)
      .filter(([, p]) => "enum" in p)
      .map(([f]) => f)
      .sort();
    expect(enumFields).toEqual(["clear_ground_space", "location", "panel_brand", "retake_reason", "setup_type"]);
  });

  it("labels the home setup type that only the rules produce", () => {
    expect(valueLabel("setup_type", "panel_indoors")).toBe("Breaker box indoors");
  });

  it("formats numbers", () => {
    expect(valueLabel("amp_rating", 200)).toBe("200A");
    expect(valueLabel("amp_rating", -1)).toBe("Unknown");
    expect(valueLabel("confidence", 85)).toBe("85%");
    expect(valueLabel("meter_count", 2)).toBe("2");
  });

  it("accepts enum values in any casing", () => {
    expect(valueLabel("location", "GARAGE")).toBe("Garage");
  });

  it("humanizes unknown enum values instead of showing raw codes", () => {
    expect(valueLabel("location", "roof_top")).toBe("Roof top");
    expect(valueLabel("some_new_field", "brand_new_value")).toBe("Brand new value");
  });

  it("handles missing and empty values", () => {
    expect(valueLabel("heavy_rust", undefined)).toBe("Not checked");
    expect(valueLabel("heavy_rust", null)).toBe("Not checked");
    expect(valueLabel("notes", "")).toBe("None");
    expect(valueLabel("location", "")).toBe("None");
  });

  it("keeps free text as written", () => {
    expect(valueLabel("notes", "Meter is behind a gate_latch")).toBe("Meter is behind a gate_latch");
  });
});

describe("queueTab", () => {
  it("puts submitted homes with no decision in To decide", () => {
    expect(queueTab({ status: "submitted", surveyor_decision: null })).toBe("to_decide");
  });

  it("puts homes that are not submitted in In progress", () => {
    expect(queueTab({ status: "in_progress", surveyor_decision: null })).toBe("in_progress");
  });

  it("puts any home with a decision in Decided, even if not submitted", () => {
    expect(queueTab({ status: "submitted", surveyor_decision: "approved" })).toBe("decided");
    expect(queueTab({ status: "in_progress", surveyor_decision: "needs_site_visit" })).toBe("decided");
  });
});

describe("parseQueueFilter", () => {
  it("defaults to To decide for missing or unknown tabs", () => {
    expect(parseQueueFilter(undefined)).toBe("to_decide");
    expect(parseQueueFilter("nope")).toBe("to_decide");
    expect(parseQueueFilter(["decided"])).toBe("to_decide");
  });

  it("keeps known tabs", () => {
    for (const id of ["to_decide", "in_progress", "decided", "all"]) expect(parseQueueFilter(id)).toBe(id);
  });

  it("lists the tabs in the right order", () => {
    expect(QUEUE_FILTERS.map((f) => f.label)).toEqual(["To decide", "In progress", "Decided", "All"]);
  });
});

describe("filterQueue", () => {
  const home = (id: string, over: Partial<Parameters<typeof filterQueue>[0][number]>) => ({
    id,
    status: "submitted" as const,
    surveyor_decision: null,
    created_at: "2026-09-20T10:00:00Z",
    submitted_at: null,
    decided_at: null,
    ...over,
  });
  const homes = [
    home("new-submit", { submitted_at: "2026-09-26T10:00:00Z" }),
    home("old-submit", { submitted_at: "2026-09-24T10:00:00Z" }),
    home("draft-old", { status: "in_progress", created_at: "2026-09-21T10:00:00Z" }),
    home("draft-new", { status: "in_progress", created_at: "2026-09-25T10:00:00Z" }),
    home("decided-early", { surveyor_decision: "approved", submitted_at: "2026-09-22T10:00:00Z", decided_at: "2026-09-23T10:00:00Z" }),
    home("decided-late", { surveyor_decision: "rejected", submitted_at: "2026-09-22T10:00:00Z", decided_at: "2026-09-26T12:00:00Z" }),
  ];
  const ids = (list: { id: string }[]) => list.map((h) => h.id);

  it("sorts To decide oldest submitted first", () => {
    expect(ids(filterQueue(homes, "to_decide"))).toEqual(["old-submit", "new-submit"]);
  });

  it("sorts the other tabs newest first", () => {
    expect(ids(filterQueue(homes, "in_progress"))).toEqual(["draft-new", "draft-old"]);
    expect(ids(filterQueue(homes, "decided"))).toEqual(["decided-late", "decided-early"]);
    expect(ids(filterQueue(homes, "all"))).toEqual([
      "decided-late",
      "new-submit",
      "draft-new",
      "old-submit",
      "decided-early",
      "draft-old",
    ]);
  });

  it("does not change the input list", () => {
    const before = ids(homes);
    filterQueue(homes, "all");
    expect(ids(homes)).toEqual(before);
  });

  it("returns an empty list when nothing matches", () => {
    expect(filterQueue([], "to_decide")).toEqual([]);
  });
});

describe("decidedToday", () => {
  const now = new Date("2026-09-27T15:00:00Z");

  it("counts decisions from the same Austin day", () => {
    expect(decidedToday("2026-09-27T06:00:00Z", now)).toBe(true);
  });

  it("uses Austin time, not UTC, for the day boundary", () => {
    expect(decidedToday("2026-09-27T03:00:00Z", now)).toBe(false);
    expect(decidedToday("2026-09-27T03:00:00Z", now, "UTC")).toBe(true);
  });

  it("ignores missing or invalid times", () => {
    expect(decidedToday(null, now)).toBe(false);
    expect(decidedToday("bad", now)).toBe(false);
  });
});

describe("topReason", () => {
  it("returns nothing for no reasons", () => {
    expect(topReason([])).toEqual({ reason: null, others: 0 });
    expect(topReason(null)).toEqual({ reason: null, others: 0 });
    expect(topReason(undefined)).toEqual({ reason: null, others: 0 });
  });

  it("puts Fail before Needs review before Pass, whatever the order", () => {
    const pass = reason("AMP_OK", "PASS");
    const review = reason("DAMAGE", "REVIEW");
    const fail = reason("NO_SPACE", "FAIL");
    expect(topReason([pass, review, fail])).toEqual({ reason: fail, others: 1 });
    expect(topReason([pass, review])).toEqual({ reason: review, others: 0 });
  });

  it("counts only other non-Pass reasons", () => {
    const list = [
      reason("AMP_TOO_LOW", "FAIL"),
      reason("NO_SPACE", "FAIL"),
      reason("DAMAGE", "REVIEW"),
      reason("SPACE_OK", "PASS"),
    ];
    expect(topReason(list)).toEqual({ reason: list[0], others: 2 });
  });

  it("returns the first Pass reason and no others when all reasons pass", () => {
    const list = [reason("AMP_OK", "PASS"), reason("SPACE_OK", "PASS")];
    expect(topReason(list)).toEqual({ reason: list[0], others: 0 });
  });

  it("keeps the first reason on a tie", () => {
    const list = [reason("DAMAGE", "REVIEW"), reason("HEAVY_RUST", "REVIEW")];
    expect(topReason(list)).toEqual({ reason: list[0], others: 1 });
  });
});

describe("groupReasons", () => {
  it("returns no groups for no reasons", () => {
    expect(groupReasons([])).toEqual([]);
    expect(groupReasons(null)).toEqual([]);
  });

  it("groups by code, keeps the first message and lists each step once", () => {
    const groups = groupReasons([
      reason("DAMAGE", "REVIEW", "meter_closeup", "Damage on meter"),
      reason("DAMAGE", "REVIEW", "panel_wide", "Damage on panel"),
      reason("DAMAGE", "REVIEW", "meter_closeup", "Damage on meter again"),
    ]);
    expect(groups).toEqual([
      { code: "DAMAGE", outcome: "REVIEW", message: "Damage on meter", steps: ["meter_closeup", "panel_wide"] },
    ]);
  });

  it("skips reasons with no step in the step list", () => {
    expect(groupReasons([reason("SPACE_UNCLEAR", "REVIEW", null)])).toEqual([
      { code: "SPACE_UNCLEAR", outcome: "REVIEW", message: "SPACE_UNCLEAR message", steps: [] },
    ]);
  });

  it("orders groups Fail, then Needs review, then Pass, keeping order within each", () => {
    const groups = groupReasons([
      reason("AMP_OK", "PASS", "main_disconnect_closeup"),
      reason("DAMAGE", "REVIEW", "meter_closeup"),
      reason("NO_SPACE", "FAIL"),
      reason("HEAVY_RUST", "REVIEW", "panel_open"),
      reason("SPACE_OK", "PASS", "left_of_meter"),
    ]);
    expect(groups.map((g) => g.code)).toEqual(["NO_SPACE", "DAMAGE", "HEAVY_RUST", "AMP_OK", "SPACE_OK"]);
  });

  it("uses the worst outcome when one code has mixed outcomes", () => {
    const groups = groupReasons([reason("X", "REVIEW", "a"), reason("X", "FAIL", "b")]);
    expect(groups).toEqual([{ code: "X", outcome: "FAIL", message: "X message", steps: ["a", "b"] }]);
  });

  it("handles only Pass reasons", () => {
    const groups = groupReasons([reason("AMP_OK", "PASS"), reason("SPACE_OK", "PASS")]);
    expect(groups.every((g) => g.outcome === "PASS")).toBe(true);
    expect(groups).toHaveLength(2);
  });
});

describe("waitingTime", () => {
  const now = new Date("2026-09-27T12:00:00Z");
  const ago = (ms: number) => new Date(now.getTime() - ms).toISOString();

  it("shows minutes under an hour", () => {
    expect(waitingTime(ago(45 * 60_000), now)).toBe("45m");
    expect(waitingTime(ago(59 * 60_000 + 59_000), now)).toBe("59m");
  });

  it("shows hours under a day", () => {
    expect(waitingTime(ago(60 * 60_000), now)).toBe("1h");
    expect(waitingTime(ago(3.5 * 3_600_000), now)).toBe("3h");
    expect(waitingTime(ago(23 * 3_600_000 + 59 * 60_000), now)).toBe("23h");
  });

  it("shows days from 24 hours", () => {
    expect(waitingTime(ago(24 * 3_600_000), now)).toBe("1d");
    expect(waitingTime(ago(2 * 86_400_000 + 5 * 3_600_000), now)).toBe("2d");
  });

  it("shows <1m for just now and for clock skew into the future", () => {
    expect(waitingTime(ago(10_000), now)).toBe("<1m");
    expect(waitingTime(ago(-60_000), now)).toBe("<1m");
  });

  it("accepts Date objects and a number for now", () => {
    expect(waitingTime(new Date(ago(3 * 60_000)), now.getTime())).toBe("3m");
  });

  it("returns empty text when there is no valid submit time", () => {
    expect(waitingTime(null, now)).toBe("");
    expect(waitingTime(undefined, now)).toBe("");
    expect(waitingTime("not a date", now)).toBe("");
  });
});
