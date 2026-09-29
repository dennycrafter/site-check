import type { Metadata } from "next";
import Link from "next/link";
import { Footer } from "@/components/footer";
import { Banner, BADGE_CLASS, type BadgeTone } from "@/components/ui";
import { SiteHeader } from "@/components/site-header";
import {
  AUDIT_TABS,
  aiSaid,
  auditStats,
  filterAudit,
  formatLatency,
  matchesAuditTab,
  parseAuditTab,
  type AuditPhoto,
  type AuditTab,
} from "@/lib/audit";
import { homeLabel } from "@/lib/homes";
import { formatTime, PHOTO_STATUS_LABELS } from "@/lib/labels";
import { stepTitle } from "@/lib/steps";
import { getSupabase } from "@/lib/supabase";
import type { HomeRow, PhotoStatus } from "@/lib/types";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "AI check audit | site-check" };

const PHOTO_LIMIT = 1000;
const ROWS_SHOWN = 300;

type AuditHome = Pick<HomeRow, "id" | "address" | "customer_name" | "created_at" | "site_check_status">;

const STATUS_TONES: Record<PhotoStatus, BadgeTone> = {
  accepted: "pass",
  retake: "review",
  check_failed: "fail",
  accepted_after_max_attempts: "review",
};

const EMPTY_TEXT: Record<AuditTab, string> = {
  all: "No failed or rejected checks yet.",
  check_failed: "No check has failed after all its retries.",
  retake: "No retakes asked yet.",
  kept: "No photos kept for review yet.",
  retried: "No check needed a retry.",
};

async function loadAudit(): Promise<{
  photos: AuditPhoto[];
  homes: Map<string, AuditHome>;
  failedHomes: AuditHome[];
  error: string | null;
}> {
  const empty = { photos: [], homes: new Map<string, AuditHome>(), failedHomes: [] };
  try {
    const supabase = getSupabase();
    const columns = "id, address, customer_name, created_at, site_check_status";
    const [photosRes, homesRes, failedRes] = await Promise.all([
      supabase
        .from("photos")
        .select("id, created_at, home_id, step, attempt, status, analysis, error, latency_ms, ai_attempts")
        .order("created_at", { ascending: false })
        .limit(PHOTO_LIMIT),
      supabase.from("homes").select(columns).order("created_at", { ascending: false }).limit(PHOTO_LIMIT),
      supabase
        .from("homes")
        .select(columns)
        .eq("site_check_status", "failed")
        .order("created_at", { ascending: false })
        .limit(100),
    ]);
    const error = photosRes.error ?? homesRes.error ?? failedRes.error;
    if (error) return { ...empty, error: error.message };
    const homes = new Map<string, AuditHome>();
    for (const h of [...((homesRes.data ?? []) as AuditHome[]), ...((failedRes.data ?? []) as AuditHome[])]) homes.set(h.id, h);
    return {
      photos: (photosRes.data ?? []) as AuditPhoto[],
      homes,
      failedHomes: (failedRes.data ?? []) as AuditHome[],
      error: null,
    };
  } catch (err) {
    return { ...empty, error: err instanceof Error ? err.message : String(err) };
  }
}

function HomeLink({ homeId, home }: { homeId: string; home: AuditHome | undefined }) {
  return (
    <Link href={`/review/${homeId}`} className="font-semibold text-ink hover:text-accent hover:underline">
      {home ? homeLabel(home) : "Open home"}
    </Link>
  );
}

function StatusBadge({ status }: { status: PhotoStatus }) {
  return <span className={BADGE_CLASS[STATUS_TONES[status]]}>{PHOTO_STATUS_LABELS[status]}</span>;
}

export default async function AuditPage({ searchParams }: PageProps<"/review/audit">) {
  const params = await searchParams;
  const tab = parseAuditTab(params.tab);
  const { photos, homes, failedHomes, error } = await loadAudit();
  const stats = auditStats(photos);
  const shown = filterAudit(photos, tab);
  const rows = shown.slice(0, ROWS_SHOWN);
  const counts = Object.fromEntries(
    AUDIT_TABS.map((t) => [t.id, photos.filter((p) => matchesAuditTab(p, t.id)).length]),
  ) as Record<AuditTab, number>;

  const statCards = [
    { label: "AI checks", value: String(stats.total) },
    { label: "First-try success", value: stats.firstTryRate === null ? "-" : `${stats.firstTryRate}%` },
    { label: "Needed retries", value: String(stats.retried) },
    { label: "Failed after all retries", value: String(stats.failed) },
    { label: "Retakes asked", value: String(stats.retakes) },
    { label: "Kept for review", value: String(stats.kept) },
    { label: "Average latency", value: formatLatency(stats.avgLatencyMs) },
  ];

  return (
    <>
      <SiteHeader tag="Surveyor" />
      <main className="ui-container flex-1 pt-4 pb-12">
        <Link href="/review" className="ui-button-ghost">
          Back to queue
        </Link>
        <h1 className="ui-title mt-1">AI check audit</h1>
        <p className="ui-muted mt-2">
          Every failed or rejected check and how the system recovered. Based on the latest {PHOTO_LIMIT} photos.
        </p>

        <section className="ui-card mt-6 grid grid-cols-2 gap-3 p-4 sm:grid-cols-4 lg:grid-cols-7">
          {statCards.map((s) => (
            <div key={s.label} className="ui-stat">
              <span className="ui-stat-value">{s.value}</span>
              <span className="ui-stat-label">{s.label}</span>
            </div>
          ))}
        </section>

        <nav aria-label="Audit tabs" className="mt-6 flex flex-wrap gap-2">
          {AUDIT_TABS.map((t) => (
            <Link
              key={t.id}
              href={t.id === "all" ? "/review/audit" : `/review/audit?tab=${t.id}`}
              aria-current={tab === t.id ? "page" : undefined}
              className="ui-tab"
            >
              {t.label}
              <span className="ui-tab-count">{counts[t.id]}</span>
            </Link>
          ))}
        </nav>

        {error && (
          <div className="mt-6">
            <Banner tone="error">Could not load the audit. {error}</Banner>
          </div>
        )}

        {!error && rows.length === 0 && (
          <div className="ui-card mt-6 py-12 text-center">
            <p className="ui-subtitle">Nothing here</p>
            <p className="ui-muted mt-1">{EMPTY_TEXT[tab]}</p>
          </div>
        )}

        {rows.length > 0 && (
          <>
            <div className="ui-card ui-card-flush mt-6 hidden overflow-x-auto md:block">
              <table className="ui-table">
                <thead>
                  <tr>
                    <th>Time</th>
                    <th>Home</th>
                    <th>Step</th>
                    <th>Attempt</th>
                    <th>Status</th>
                    <th>What the AI said</th>
                    <th>AI tries</th>
                    <th>Latency</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((p) => (
                    <tr key={p.id} className="align-top">
                      <td className="whitespace-nowrap">{formatTime(p.created_at)}</td>
                      <td>
                        <HomeLink homeId={p.home_id} home={homes.get(p.home_id)} />
                      </td>
                      <td>{stepTitle(p.step)}</td>
                      <td>{p.attempt}</td>
                      <td>
                        <StatusBadge status={p.status} />
                      </td>
                      <td className="max-w-sm">{aiSaid(p)}</td>
                      <td>{p.ai_attempts}</td>
                      <td className="whitespace-nowrap">{formatLatency(p.latency_ms)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <ul className="mt-6 space-y-3 md:hidden">
              {rows.map((p) => (
                <li key={p.id} className="ui-card p-4">
                  <div className="flex items-start justify-between gap-3">
                    <span className="min-w-0">
                      <HomeLink homeId={p.home_id} home={homes.get(p.home_id)} />
                      <span className="block text-sm text-muted">{stepTitle(p.step)}</span>
                    </span>
                    <span className="shrink-0">
                      <StatusBadge status={p.status} />
                    </span>
                  </div>
                  <p className="mt-2 text-sm text-ink">{aiSaid(p)}</p>
                  <p className="mt-1 text-xs text-muted">
                    {formatTime(p.created_at)} · Attempt {p.attempt} · {p.ai_attempts} AI{" "}
                    {p.ai_attempts === 1 ? "try" : "tries"} · {formatLatency(p.latency_ms)}
                  </p>
                </li>
              ))}
            </ul>
            {shown.length > rows.length && (
              <p className="ui-muted mt-3">
                Showing the newest {rows.length} of {shown.length}.
              </p>
            )}
          </>
        )}

        <section className="mt-10">
          <h2 className="ui-subtitle">Whole-site check failed</h2>
          {failedHomes.length === 0 ? (
            <p className="ui-muted mt-2">No whole-site check has failed.</p>
          ) : (
            <ul className="ui-card ui-card-flush mt-3 divide-y divide-line">
              {failedHomes.map((h) => (
                <li key={h.id} className="flex flex-wrap items-baseline justify-between gap-2 px-4 py-3">
                  <HomeLink homeId={h.id} home={h} />
                  <span className="text-sm text-muted">Created {formatTime(h.created_at)}</span>
                </li>
              ))}
            </ul>
          )}
        </section>
      </main>
      <Footer />
    </>
  );
}
