import { DECISION_LABELS } from "./labels";
import type { AnalysisField } from "./schema";
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

const SEVERITY: Record<Outcome, number> = { FAIL: 0, REVIEW: 1, PASS: 2 };

/** The most severe reason (first one wins a tie) and how many other non-Pass reasons there are. */
export function topReason(reasons: Reason[] | null | undefined): { reason: Reason | null; others: number } {
  const list = reasons ?? [];
  if (list.length === 0) return { reason: null, others: 0 };
  let top = list[0];
  for (const r of list) if (SEVERITY[r.outcome] < SEVERITY[top.outcome]) top = r;
  const others = list.filter((r) => r !== top && r.outcome !== "PASS").length;
  return { reason: top, others };
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
