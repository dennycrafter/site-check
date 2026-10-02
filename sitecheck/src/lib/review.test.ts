import { describe, expect, it } from "vitest";
import {
  batteryText,
  decisionLabel,
  evidenceStep,
  filterQueue,
  groupReasons,
  highlightedFields,
  keyFacts,
  parseQueueFilter,
  QUEUE_FILTERS,
  queueTab,
  topReason,
  valueLabel,
  verdictLabel,
  waitingTime,
} from "./review";
import { AI_SETUP_TYPES, GROUND_SPACE, LOCATIONS, PANEL_BRANDS, PHOTO_ANALYSIS_SCHEMA, RETAKE_REASONS } from "./schema";
import { evaluate } from "./rules";
import type { PhotoAnalysis } from "./schema";
import { GOOD_ANALYSIS } from "./testing";
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

describe("batteryText", () => {
  it("counts batteries for PASS and FAIL", () => {
    expect(batteryText("PASS", 2)).toBe("2 batteries");
    expect(batteryText("PASS", 1)).toBe("1 battery");
    expect(batteryText("FAIL", 0)).toBe("0 batteries");
  });

  it("marks a REVIEW count as provisional", () => {
    expect(batteryText("REVIEW", 1)).toBe("1 battery, provisional");
    expect(batteryText("REVIEW", 2)).toBe("2 batteries, provisional");
  });

  it("is empty before the first check", () => {
    expect(batteryText(null, null)).toBeNull();
    expect(batteryText("PASS", null)).toBeNull();
  });
});

describe("evidenceStep", () => {
  it("uses the reason's step", () => {
    expect(evidenceStep(reason("AMP_TOO_LOW", "FAIL", "main_disconnect_closeup"))).toBe("main_disconnect_closeup");
  });

  it("falls back to the wide meter photo", () => {
    expect(evidenceStep(reason("NO_SPACE", "FAIL"))).toBe("meter_area_wide");
    expect(evidenceStep(null)).toBe("meter_area_wide");
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

describe("keyFacts", () => {
  const spaceSteps = ["meter_area_wide", "left_of_meter", "right_of_meter"];
  const good = (over: Partial<PhotoAnalysis> = {}) => ({ ...GOOD_ANALYSIS, ...over });
  const facts = (analyses: Record<string, PhotoAnalysis>, reasons: Reason[] = [], setupType = "combo_meter_main_unit") =>
    Object.fromEntries(
      keyFacts({ setupType, analyses: new Map(Object.entries(analyses)), reasons, spaceSteps }).map((f) => [
        f.label,
        f,
      ]),
    );

  it("lists the five facts in order", () => {
    const list = keyFacts({ setupType: "unknown", analyses: new Map(), reasons: [], spaceSteps });
    expect(list.map((f) => f.label)).toEqual(["Amp rating", "Setup", "Ground space", "Hazards", "Condition"]);
  });

  it("marks everything unknown when there are no photos yet", () => {
    const list = keyFacts({ setupType: "unknown", analyses: new Map(), reasons: null, spaceSteps });
    expect(list.every((f) => f.tone === "unknown")).toBe(true);
    expect(list.map((f) => f.value)).toEqual(["Unknown", "Unknown", "Unknown", "Unknown", "Unknown"]);
  });

  it("reads a clean home in plain words", () => {
    const f = facts({ meter_area_wide: good(), main_disconnect_closeup: good(), panel_open: good() });
    expect(f["Amp rating"]).toEqual({ label: "Amp rating", value: "200A", tone: "ok" });
    expect(f["Setup"].value).toBe("All-in-one meter and main breaker");
    expect(f["Ground space"]).toMatchObject({ value: "Room for 2 batteries", tone: "ok" });
    expect(f["Hazards"]).toMatchObject({ value: "None seen", tone: "ok" });
    expect(f["Condition"]).toMatchObject({ value: "No damage or rust seen", tone: "ok" });
  });

  it("shows an unreadable amp rating as Unknown in amber", () => {
    const f = facts({ main_disconnect_closeup: good({ amp_rating: 0, amp_rating_legible: false }) });
    expect(f["Amp rating"]).toMatchObject({ value: "Unknown", tone: "unknown" });
  });

  it("uses the rules to turn a failing amp rating red", () => {
    const analyses = {
      meter_area_wide: good(),
      main_disconnect_closeup: good({ amp_rating: 60 }),
    };
    const { reasons } = evaluate({
      inAustin: false,
      hasSolar: false,
      panelSameWallAnswer: "not_asked",
      setupType: "combo_meter_main_unit",
      siteCheckStatus: "done",
      photos: Object.entries(analyses).map(([step, analysis]) => ({ step, status: "accepted", analysis })),
    });
    expect(facts(analyses, reasons)["Amp rating"]).toMatchObject({ value: "60A", tone: "fail" });
  });

  it("picks the best ground space across photos", () => {
    const f = facts({
      meter_area_wide: good({ clear_ground_space: "none" }),
      left_of_meter: good({ clear_ground_space: "room_for_one" }),
      right_of_meter: good({ clear_ground_space: "unclear" }),
    });
    expect(f["Ground space"]).toMatchObject({ value: "Room for 1 battery", tone: "ok" });
  });

  it("shows unclear ground space in amber", () => {
    const f = facts({ meter_area_wide: good({ clear_ground_space: "unclear" }) });
    expect(f["Ground space"]).toMatchObject({ value: "Unclear", tone: "unknown" });
  });

  it("lists hazards and condition problems", () => {
    const f = facts({
      meter_area_wide: good({ gas_meter_near: true, ac_unit_near: true }),
      panel_open: good({ panel_brand: "zinsco", heavy_rust: true }),
    });
    expect(f["Hazards"]).toMatchObject({ value: "Gas meter nearby, A/C unit nearby", tone: "review" });
    expect(f["Condition"]).toMatchObject({ value: "Heavy rust, recalled brand (Zinsco)", tone: "review" });
  });

  it("adds the breaker box location to the setup", () => {
    const f = facts({ panel_wide: good({ location: "garage" }) }, [], "separate_meter_and_panel_outdoors");
    expect(f["Setup"].value).toBe("Meter and separate breaker box, both outside, breaker box: garage");
  });

  it("shows an unknown setup in amber", () => {
    expect(facts({}, [], "unknown")["Setup"]).toMatchObject({ value: "Unknown", tone: "unknown" });
  });
});

describe("highlightedFields", () => {
  const a = (over: Partial<PhotoAnalysis> = {}) => ({ ...GOOD_ANALYSIS, ...over });

  it("returns nothing without an analysis or reasons", () => {
    expect(highlightedFields("meter_closeup", null, [reason("DAMAGE", "REVIEW", "meter_closeup")])).toEqual([]);
    expect(highlightedFields("meter_closeup", a(), [])).toEqual([]);
    expect(highlightedFields("meter_closeup", a(), null)).toEqual([]);
  });

  it("marks the field behind a reason on the same step only", () => {
    const reasons = [reason("DAMAGE", "REVIEW", "meter_closeup")];
    expect(highlightedFields("meter_closeup", a({ damage_visible: true }), reasons)).toEqual(["damage_visible"]);
    expect(highlightedFields("panel_wide", a({ damage_visible: true }), reasons)).toEqual([]);
  });

  it("ignores Pass reasons", () => {
    expect(highlightedFields("main_disconnect_closeup", a(), [reason("AMP_OK", "PASS", "main_disconnect_closeup")])).toEqual([]);
  });

  it("marks only the obstacles that were actually seen", () => {
    const reasons = [reason("OBSTACLE_NEAR_METER", "REVIEW", "meter_area_wide")];
    expect(highlightedFields("meter_area_wide", a({ window_near: true }), reasons)).toEqual(["window_near"]);
  });

  it("marks ground space on photos with no clear space for step-less space reasons", () => {
    const reasons = [reason("SPACE_UNCLEAR", "REVIEW", null)];
    expect(highlightedFields("left_of_meter", a({ clear_ground_space: "unclear" }), reasons)).toEqual(["clear_ground_space"]);
    expect(highlightedFields("right_of_meter", a({ clear_ground_space: "room_for_one" }), reasons)).toEqual([]);
  });

  it("marks the setup on the wide meter photo when the setup is unclear", () => {
    const reasons = [reason("SETUP_UNCLEAR", "REVIEW", null)];
    expect(highlightedFields("meter_area_wide", a(), reasons)).toEqual(["setup_type"]);
    expect(highlightedFields("meter_closeup", a(), reasons)).toEqual([]);
  });

  it("does not repeat a field", () => {
    const reasons = [reason("PANEL_BRAND_CHECK", "REVIEW", "panel_open"), reason("PANEL_BRAND_UNREADABLE", "REVIEW", "panel_open")];
    expect(highlightedFields("panel_open", a(), reasons)).toEqual(["panel_brand", "panel_label_legible"]);
  });
});
