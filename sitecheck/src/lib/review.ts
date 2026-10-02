import { DECISION_LABELS } from "./labels";
import type { AnalysisField, PhotoAnalysis } from "./schema";
import type { HomeRow, Outcome, Reason, SurveyorDecision } from "./types";

export const VERDICT_LABELS: Record<Outcome, string> = {
  PASS: "Pass",
  FAIL: "Fail",
  REVIEW: "Needs review",
};

export function verdictLabel(verdict: Outcome | null | undefined): string {
  return verdict ? VERDICT_LABELS[verdict] : "Not checked yet";
}

export function decisionLabel(decision: SurveyorDecision | null | undefined): string {
  return decision ? DECISION_LABELS[decision] : "Undecided";
}

const ENUM_VALUE_LABELS: Partial<Record<AnalysisField, Record<string, string>>> = {
  retake_reason: {
    none: "None",
    too_dark: "Too dark",
    blurry: "Blurry",
    too_close: "Too close",
    too_far: "Too far",
    wrong_subject: "Wrong thing photographed",
    lid_closed: "Lid closed",
    view_blocked: "View blocked",
    text_unreadable: "Text unreadable",
  },
  // Covers the AI values and the setup types the home row can hold.
  setup_type: {
    separate_meter_and_panel_outdoors: "Meter and separate breaker box, both outside",
    combo_meter_main_unit: "All-in-one meter and main breaker",
    panel_not_visible: "Breaker box not visible",
    panel_indoors: "Breaker box indoors",
    unknown: "Unknown",
  },
  location: {
    outdoor: "Outside wall",
    garage: "Garage",
    closet: "Closet",
    indoor_other: "Inside the home",
    unknown: "Unknown",
  },
  clear_ground_space: {
    none: "No clear space",
    room_for_one: "Room for 1 battery",
    room_for_two: "Room for 2 batteries",
    unclear: "Unclear",
  },
  panel_brand: {
    federal_pacific: "Federal Pacific",
    zinsco: "Zinsco",
    challenger: "Challenger",
    sylvania: "Sylvania",
    westinghouse: "Westinghouse",
    other: "Unknown brand",
    not_visible: "Not visible",
  },
};

function humanize(value: string): string {
  const words = value.replace(/_/g, " ").trim();
  return words ? words.charAt(0).toUpperCase() + words.slice(1) : "None";
}

/** Plain-English value for an AI analysis field. Unknown enum values are humanized, never shown raw. */
export function valueLabel(field: AnalysisField | string, value: unknown): string {
  if (value === undefined || value === null) return "Not checked";
  if (typeof value === "boolean") return value ? "Yes" : "No";
  if (field === "amp_rating") return typeof value === "number" && value > 0 ? `${value}A` : "Unknown";
  if (field === "confidence") return `${value}%`;
  if (typeof value === "number") return String(value);
  const text = String(value);
  const known = ENUM_VALUE_LABELS[field as AnalysisField]?.[text.toLowerCase()];
  if (known) return known;
  if (field === "notes" || field === "retake_instruction") return text.trim() || "None";
  return humanize(text);
}

export type QueueTab = "to_decide" | "in_progress" | "decided";

export function queueTab(home: Pick<HomeRow, "status" | "surveyor_decision">): QueueTab {
  if (home.surveyor_decision) return "decided";
  return home.status === "submitted" ? "to_decide" : "in_progress";
}

export type QueueFilter = QueueTab | "all";

export const QUEUE_FILTERS: { id: QueueFilter; label: string }[] = [
  { id: "to_decide", label: "To decide" },
  { id: "in_progress", label: "In progress" },
  { id: "decided", label: "Decided" },
  { id: "all", label: "All" },
];

export function parseQueueFilter(value: unknown): QueueFilter {
  return QUEUE_FILTERS.some((f) => f.id === value) ? (value as QueueFilter) : "to_decide";
}

type QueueHome = Pick<HomeRow, "status" | "surveyor_decision" | "created_at" | "submitted_at" | "decided_at">;

const time = (iso: string | null | undefined) => (iso ? new Date(iso).getTime() || 0 : 0);
const lastActivity = (h: QueueHome) => Math.max(time(h.decided_at), time(h.submitted_at), time(h.created_at));

/** To decide: oldest submitted first. Every other tab: most recent activity first. */
export function filterQueue<T extends QueueHome>(homes: T[], filter: QueueFilter): T[] {
  const shown = filter === "all" ? [...homes] : homes.filter((h) => queueTab(h) === filter);
  if (filter === "to_decide") return shown.sort((a, b) => time(a.submitted_at) - time(b.submitted_at));
  return shown.sort((a, b) => lastActivity(b) - lastActivity(a));
}

export type SortKey = "waiting" | "result";
export type SortDir = "asc" | "desc";
export type QueueSort = { key: SortKey; dir: SortDir } | null;

export const SORT_KEYS: { id: SortKey; label: string }[] = [
  { id: "waiting", label: "Waiting" },
  { id: "result", label: "Result" },
];

/** Longest wait first, and Fail first. Both are "desc"; "asc" flips them. */
const DEFAULT_SORT_DIR: SortDir = "desc";

/** Reads ?sort and ?dir. Anything unknown means no sort. A missing or unknown dir uses the default. */
export function parseQueueSort(sort: unknown, dir: unknown): QueueSort {
  const key = SORT_KEYS.find((k) => k.id === sort)?.id;
  if (!key) return null;
  return { key, dir: dir === "asc" || dir === "desc" ? dir : DEFAULT_SORT_DIR };
}

/** The sort after clicking a header: default direction, then flipped, then none. A different header starts over. */
export function nextQueueSort(current: QueueSort, key: SortKey): QueueSort {
  if (!current || current.key !== key) return { key, dir: DEFAULT_SORT_DIR };
  if (current.dir === DEFAULT_SORT_DIR) return { key, dir: "asc" };
  return null;
}

/** The Waiting column only exists on To decide, so a waiting sort is ignored on other tabs. */
export function effectiveQueueSort(sort: QueueSort, filter: QueueFilter): QueueSort {
  return sort && sort.key === "waiting" && filter !== "to_decide" ? null : sort;
}

/** The queue link for a tab and sort. Keeps the sort and ?live=1 so neither is lost when clicking around. */
export function queueHref(filter: QueueFilter, sort: QueueSort, live: boolean): string {
  const query: string[] = [];
  if (filter !== "to_decide") query.push(`tab=${filter}`);
  if (sort) query.push(`sort=${sort.key}`, `dir=${sort.dir}`);
  if (live) query.push("live=1");
  return query.length ? `/review?${query.join("&")}` : "/review";
}

const SEVERITY: Record<Outcome, number> = { FAIL: 0, REVIEW: 1, PASS: 2 };

/**
 * Sorts a copy of the list. Waiting: longest wait first, or shortest first when flipped.
 * Result: Fail, Needs review, Pass, or the reverse when flipped. Homes with no submit time
 * or no result always come last. Result ties go to the longest wait; other ties keep their order.
 */
export function sortQueue<T extends { verdict: Outcome | null; submitted_at: string | null }>(
  homes: T[],
  sort: QueueSort,
): T[] {
  if (!sort) return [...homes];
  const sign = sort.dir === "desc" ? 1 : -1;
  const submitted = (h: T) => (h.submitted_at ? new Date(h.submitted_at).getTime() : NaN);
  const missingLast = (aMissing: boolean, bMissing: boolean) => (aMissing === bMissing ? 0 : aMissing ? 1 : -1);
  const byWait = (a: T, b: T, dir: 1 | -1) => {
    const x = submitted(a);
    const y = submitted(b);
    if (Number.isNaN(x) || Number.isNaN(y)) return missingLast(Number.isNaN(x), Number.isNaN(y));
    return (x - y) * dir;
  };
  const byResult = (a: T, b: T) => {
    if (!a.verdict || !b.verdict) return missingLast(!a.verdict, !b.verdict);
    return (SEVERITY[a.verdict] - SEVERITY[b.verdict]) * sign;
  };
  const compare =
    sort.key === "waiting"
      ? (a: T, b: T) => byWait(a, b, sign)
      : (a: T, b: T) => byResult(a, b) || byWait(a, b, 1);
  return [...homes].sort(compare);
}

/** The most severe reason (first one wins a tie) and how many other non-Pass reasons there are. */
export function topReason(reasons: Reason[] | null | undefined): { reason: Reason | null; others: number } {
  const list = reasons ?? [];
  if (list.length === 0) return { reason: null, others: 0 };
  let top = list[0];
  for (const r of list) if (SEVERITY[r.outcome] < SEVERITY[top.outcome]) top = r;
  const others = list.filter((r) => r !== top && r.outcome !== "PASS").length;
  return { reason: top, others };
}

/** "2 batteries", or "1 battery, provisional" for REVIEW. Null before the first check. */
export function batteryText(verdict: Outcome | null | undefined, count: number | null | undefined): string | null {
  if (!verdict || count === null || count === undefined) return null;
  const text = count === 1 ? "1 battery" : `${count} batteries`;
  return verdict === "REVIEW" ? `${text}, provisional` : text;
}

/** The step whose photo backs a reason. Reasons with no step point at the wide meter photo. */
export function evidenceStep(reason: Pick<Reason, "step"> | null | undefined): string {
  return reason?.step ?? "meter_area_wide";
}

export type ReasonGroup = { code: string; outcome: Outcome; message: string; steps: string[] };

/**
 * One group per rule code, most severe first. Keeps the first message and the
 * worst outcome in the group, and every distinct step the reasons point at.
 */
export function groupReasons(reasons: Reason[] | null | undefined): ReasonGroup[] {
  const groups = new Map<string, ReasonGroup>();
  for (const r of reasons ?? []) {
    let group = groups.get(r.code);
    if (!group) {
      group = { code: r.code, outcome: r.outcome, message: r.message, steps: [] };
      groups.set(r.code, group);
    } else if (SEVERITY[r.outcome] < SEVERITY[group.outcome]) {
      group.outcome = r.outcome;
    }
    if (r.step && !group.steps.includes(r.step)) group.steps.push(r.step);
  }
  return [...groups.values()].sort((a, b) => SEVERITY[a.outcome] - SEVERITY[b.outcome]);
}

export type FactTone = "ok" | "unknown" | "review" | "fail";
export type KeyFact = { label: string; value: string; tone: FactTone };

const FACT_CODES = {
  amp: ["AMP_UNREADABLE", "AMP_TOO_LOW", "AMP_LOCATION_UNKNOWN", "SOLAR_UNKNOWN", "AMP_ABOVE_200"],
  setup: ["SETUP_UNCLEAR", "PANEL_IN_LIVING_SPACE", "PANEL_NOT_SAME_WALL", "PANEL_WALL_UNSURE"],
  space: ["NO_SPACE", "SPACE_UNCLEAR"],
  hazards: ["OBSTACLE_NEAR_METER", "MULTIPLE_METERS", "MULTIPLE_PANELS"],
  condition: ["DAMAGE", "HEAVY_RUST", "PANEL_RECALLED_BRAND", "PANEL_BRAND_CHECK", "PANEL_BRAND_UNREADABLE"],
};

const RECALLED = ["federal_pacific", "zinsco", "challenger", "sylvania"];
const SPACE_ORDER = ["none", "room_for_one", "room_for_two"];

function reasonTone(reasons: Reason[], codes: string[]): FactTone {
  const related = reasons.filter((r) => codes.includes(r.code));
  if (related.some((r) => r.outcome === "FAIL")) return "fail";
  if (related.some((r) => r.outcome === "REVIEW")) return "review";
  return "ok";
}

/** The worse of a value-based tone and the tone from the rules. */
function worst(a: FactTone, b: FactTone): FactTone {
  const rank: Record<FactTone, number> = { fail: 0, unknown: 1, review: 2, ok: 3 };
  return rank[a] <= rank[b] ? a : b;
}

type FactInput = {
  setupType: string;
  /** Accepted photo analyses by step, the same photos the rules read. */
  analyses: Map<string, PhotoAnalysis>;
  reasons: Reason[] | null | undefined;
  spaceSteps: string[];
};

/** The five facts a surveyor checks first. Unknown values and rule findings set the tone. */
export function keyFacts({ setupType, analyses, reasons: rawReasons, spaceSteps }: FactInput): KeyFact[] {
  const reasons = rawReasons ?? [];
  const all = [...analyses.values()];

  const amp = analyses.get("main_disconnect_closeup");
  const ampKnown = !!amp && amp.amp_rating_legible && amp.amp_rating > 0;
  const ampFact: KeyFact = {
    label: "Amp rating",
    value: ampKnown ? valueLabel("amp_rating", amp.amp_rating) : "Unknown",
    tone: worst(ampKnown ? "ok" : "unknown", reasonTone(reasons, FACT_CODES.amp)),
  };

  const setupFact: KeyFact = {
    label: "Setup",
    value: valueLabel("setup_type", setupType),
    tone: worst(setupType === "unknown" ? "unknown" : "ok", reasonTone(reasons, FACT_CODES.setup)),
  };
  const location = analyses.get("panel_wide")?.location;
  if (location && location !== "unknown") setupFact.value += `, breaker box: ${valueLabel("location", location).toLowerCase()}`;

  const spaceValues = spaceSteps.flatMap((s) => {
    const v = analyses.get(s)?.clear_ground_space;
    return v ? [v] : [];
  });
  const ranked = spaceValues.filter((v) => SPACE_ORDER.includes(v));
  const best = ranked.sort((a, b) => SPACE_ORDER.indexOf(b) - SPACE_ORDER.indexOf(a))[0];
  const spaceFact: KeyFact = {
    label: "Ground space",
    value: best ? valueLabel("clear_ground_space", best) : spaceValues.length ? "Unclear" : "Unknown",
    tone: worst(
      !best ? "unknown" : best === "none" ? "review" : "ok",
      reasonTone(reasons, FACT_CODES.space),
    ),
  };

  const hazards: string[] = [];
  if (all.some((a) => a.gas_meter_near)) hazards.push("gas meter nearby");
  if (all.some((a) => a.window_near)) hazards.push("window nearby");
  if (all.some((a) => a.ac_unit_near)) hazards.push("A/C unit nearby");
  if (all.some((a) => a.meter_count > 1)) hazards.push("more than one meter");
  if (all.some((a) => a.multiple_panels_visible)) hazards.push("more than one breaker box");
  const hazardText = hazards.join(", ");
  const hazardFact: KeyFact = {
    label: "Hazards",
    value: all.length === 0 ? "Unknown" : hazards.length ? hazardText.charAt(0).toUpperCase() + hazardText.slice(1) : "None seen",
    tone: worst(all.length === 0 ? "unknown" : hazards.length ? "review" : "ok", reasonTone(reasons, FACT_CODES.hazards)),
  };

  const problems: string[] = [];
  if (all.some((a) => a.damage_visible)) problems.push("damage");
  if (all.some((a) => a.heavy_rust)) problems.push("heavy rust");
  const brand = analyses.get("panel_open")?.panel_brand;
  if (brand && RECALLED.includes(brand)) problems.push(`recalled brand (${valueLabel("panel_brand", brand)})`);
  else if (brand === "westinghouse") problems.push("Westinghouse panel to verify");
  const conditionText = problems.length ? problems.join(", ") : "No damage or rust seen";
  const conditionFact: KeyFact = {
    label: "Condition",
    value: all.length === 0 ? "Unknown" : conditionText.charAt(0).toUpperCase() + conditionText.slice(1),
    tone: worst(all.length === 0 ? "unknown" : problems.length ? "review" : "ok", reasonTone(reasons, FACT_CODES.condition)),
  };

  return [ampFact, setupFact, spaceFact, hazardFact, conditionFact];
}

const REASON_FIELDS: Record<string, AnalysisField[]> = {
  AMP_UNREADABLE: ["amp_rating", "amp_rating_legible"],
  AMP_TOO_LOW: ["amp_rating"],
  AMP_LOCATION_UNKNOWN: ["amp_rating"],
  SOLAR_UNKNOWN: ["amp_rating"],
  AMP_ABOVE_200: ["amp_rating"],
  PANEL_IN_LIVING_SPACE: ["location"],
  MULTIPLE_METERS: ["meter_count"],
  MULTIPLE_PANELS: ["multiple_panels_visible"],
  DAMAGE: ["damage_visible"],
  PANEL_RECALLED_BRAND: ["panel_brand"],
  PANEL_BRAND_CHECK: ["panel_brand"],
  PANEL_BRAND_UNREADABLE: ["panel_brand", "panel_label_legible"],
  HEAVY_RUST: ["heavy_rust"],
  OBSTACLE_NEAR_METER: ["gas_meter_near", "window_near", "ac_unit_near"],
  SETUP_UNCLEAR: ["setup_type"],
};

/**
 * Fields on this photo that led to a Fail or Needs review reason. Space reasons
 * have no step, so they mark the ground space field on photos with no clear space.
 */
export function highlightedFields(
  step: string,
  analysis: PhotoAnalysis | null | undefined,
  reasons: Reason[] | null | undefined,
): AnalysisField[] {
  if (!analysis) return [];
  const out = new Set<AnalysisField>();
  for (const r of reasons ?? []) {
    if (r.outcome === "PASS") continue;
    if (r.step === step) {
      for (const f of REASON_FIELDS[r.code] ?? []) {
        if (f === "gas_meter_near" || f === "window_near" || f === "ac_unit_near") {
          if (analysis[f]) out.add(f);
        } else {
          out.add(f);
        }
      }
    } else if (r.step === null && (r.code === "NO_SPACE" || r.code === "SPACE_UNCLEAR")) {
      if (analysis.clear_ground_space === "none" || analysis.clear_ground_space === "unclear") {
        out.add("clear_ground_space");
      }
    } else if (r.step === null && r.code === "SETUP_UNCLEAR" && step === "meter_area_wide") {
      out.add("setup_type");
    }
  }
  return [...out];
}

/** Short wait text like "45m", "3h", "2d". Empty when there is no submit time. */
export function waitingTime(submittedAt: string | Date | null | undefined, now: Date | number = Date.now()): string {
  if (!submittedAt) return "";
  const start = new Date(submittedAt).getTime();
  if (Number.isNaN(start)) return "";
  const minutes = Math.floor((new Date(now).getTime() - start) / 60_000);
  if (minutes < 1) return "<1m";
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h`;
  return `${Math.floor(hours / 24)}d`;
}
