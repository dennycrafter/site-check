import { valueLabel } from "./review";
import type { PhotoRow } from "./types";

export type AuditPhoto = Pick<
  PhotoRow,
  "id" | "created_at" | "home_id" | "step" | "attempt" | "status" | "analysis" | "error" | "latency_ms" | "ai_attempts"
>;

export type AuditTab = "all" | "check_failed" | "retake" | "kept" | "retried";

export const AUDIT_TABS: { id: AuditTab; label: string }[] = [
  { id: "all", label: "All issues" },
  { id: "check_failed", label: "Check failed" },
  { id: "retake", label: "Retakes" },
  { id: "kept", label: "Kept for review" },
  { id: "retried", label: "Retried" },
];

export function parseAuditTab(value: unknown): AuditTab {
  return AUDIT_TABS.some((t) => t.id === value) ? (value as AuditTab) : "all";
}

export function matchesAuditTab(photo: AuditPhoto, tab: AuditTab): boolean {
  switch (tab) {
    case "check_failed":
      return photo.status === "check_failed";
    case "retake":
      return photo.status === "retake";
    case "kept":
      return photo.status === "accepted_after_max_attempts";
    case "retried":
      return photo.ai_attempts > 1;
    case "all":
      return photo.status !== "accepted" || photo.ai_attempts > 1;
  }
}

/** Newest first. */
export function filterAudit(photos: AuditPhoto[], tab: AuditTab): AuditPhoto[] {
  return photos
    .filter((p) => matchesAuditTab(p, tab))
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
}

export type AuditStats = {
  total: number;
  /** 0 to 100, or null when there are no checks. */
  firstTryRate: number | null;
  retried: number;
  failed: number;
  retakes: number;
  kept: number;
  /** Mean of the rows that have a latency, or null. */
  avgLatencyMs: number | null;
};

export function auditStats(photos: AuditPhoto[]): AuditStats {
  const total = photos.length;
  const firstTry = photos.filter((p) => p.ai_attempts === 1 && p.status !== "check_failed").length;
  const latencies = photos.map((p) => p.latency_ms).filter((ms): ms is number => typeof ms === "number");
  return {
    total,
    firstTryRate: total ? Math.round((firstTry / total) * 100) : null,
    retried: photos.filter((p) => p.ai_attempts > 1).length,
    failed: photos.filter((p) => p.status === "check_failed").length,
    retakes: photos.filter((p) => p.status === "retake").length,
    kept: photos.filter((p) => p.status === "accepted_after_max_attempts").length,
    avgLatencyMs: latencies.length ? Math.round(latencies.reduce((sum, ms) => sum + ms, 0) / latencies.length) : null,
  };
}

/** What the AI told the homeowner, or the error text when the check itself failed. */
export function aiSaid(photo: AuditPhoto): string {
  if (photo.status === "check_failed") return photo.error || "The automatic check failed.";
  const analysis = photo.analysis;
  if (!analysis) return "-";
  if (analysis.retake_instruction?.trim()) return analysis.retake_instruction.trim();
  if (analysis.retake_reason && analysis.retake_reason !== "none") return valueLabel("retake_reason", analysis.retake_reason);
  return "-";
}

export function formatLatency(ms: number | null): string {
  return ms === null ? "-" : `${(ms / 1000).toFixed(1)}s`;
}
