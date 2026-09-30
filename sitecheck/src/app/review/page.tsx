import type { Metadata } from "next";
import Link from "next/link";
import { Footer } from "@/components/footer";
import { SiteHeader } from "@/components/site-header";
import { Banner, StatusBadges } from "@/components/ui";
import { homeLabel, loadLabeledData } from "@/lib/homes";
import { correctionStats } from "@/lib/labeledData";
import { formatTime } from "@/lib/labels";
import {
  decidedToday,
  filterQueue,
  parseQueueFilter,
  QUEUE_FILTERS,
  queueTab,
  topReason,
  waitingTime,
  type QueueFilter,
} from "@/lib/review";
import { getSupabase } from "@/lib/supabase";
import type { HomeRow } from "@/lib/types";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Surveyor queue | site-check" };

const EMPTY_TEXT: Record<QueueFilter, string> = {
  to_decide: "Nothing waiting. Submitted homes show up here for a decision.",
  in_progress: "No homeowner is taking photos right now.",
  decided: "No decisions yet.",
  all: "When a customer opens their photo link, the home shows up here.",
};

async function loadHomes(): Promise<{ homes: HomeRow[]; error: string | null; now: number }> {
  const now = Date.now();
  try {
    const { data, error } = await getSupabase()
      .from("homes")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(500);
    if (error) return { homes: [], error: error.message, now };
    return { homes: (data ?? []) as HomeRow[], error: null, now };
  } catch (err) {
    return { homes: [], error: err instanceof Error ? err.message : String(err), now };
  }
}

/** N of M over decided homes. Null when it cannot be loaded, so the queue still shows. */
async function correctedReadings(homes: HomeRow[]): Promise<{ corrected: number; total: number } | null> {
  try {
    const { homes: decided, photos, corrections } = await loadLabeledData(homes);
    return correctionStats(decided, photos, corrections);
  } catch (err) {
    console.error("[review] corrected readings", err);
    return null;
  }
}

function BatteryCell({ home }: { home: HomeRow }) {
  if (home.battery_count === null) return <span className="text-muted">-</span>;
  return (
    <span>
      <span className="font-semibold text-ink">{home.battery_count}</span>
      {home.verdict === "REVIEW" && <span className="ml-1 text-xs text-muted">provisional</span>}
    </span>
  );
}

function TopReason({ home }: { home: HomeRow }) {
  const { reason, others } = topReason(home.reasons);
  if (!reason) return <span className="text-muted">-</span>;
  return (
    <span>
      {reason.message}
      {others > 0 && <span className="ml-1 whitespace-nowrap text-xs font-semibold text-muted">+{others} more</span>}
    </span>
  );
}

function HomeName({ home }: { home: HomeRow }) {
  return (
    <>
      <span className="font-semibold text-ink">{homeLabel(home)}</span>
      {home.address && home.customer_name && <span className="block text-sm text-muted">{home.customer_name}</span>}
      {home.external_ref && <span className="block text-xs text-muted">Order {home.external_ref}</span>}
    </>
  );
}

function WhenText({ home, now }: { home: HomeRow; now: number }) {
  const tab = queueTab(home);
  if (tab === "to_decide") return <>Waiting {waitingTime(home.submitted_at, now)}</>;
  if (tab === "in_progress") return <span className="text-muted">Taking photos</span>;
  return <>{home.submitted_at ? `Submitted ${formatTime(home.submitted_at)}` : "Not submitted"}</>;
}

export default async function ReviewPage({ searchParams }: PageProps<"/review">) {
  const params = await searchParams;
  const filter = parseQueueFilter(params.tab);
  const { homes, error, now } = await loadHomes();
  const shown = filterQueue(homes, filter);
  const counts: Record<QueueFilter, number> = {
    to_decide: 0,
    in_progress: 0,
    decided: 0,
    all: homes.length,
  };
  for (const h of homes) counts[queueTab(h)] += 1;
  const oldest = filterQueue(homes, "to_decide")[0];
  const corrected = await correctedReadings(homes);
  const stats = [
    { label: "To decide", value: String(counts.to_decide) },
    { label: "Oldest wait", value: oldest ? waitingTime(oldest.submitted_at, now) : "-" },
    { label: "Decided today", value: String(homes.filter((h) => decidedToday(h.decided_at, now)).length) },
    { label: "AI readings corrected", value: corrected ? `${corrected.corrected} of ${corrected.total}` : "-" },
  ];

  return (
    <>
      <SiteHeader tag="Surveyor" />
      <main className="ui-container flex-1 pt-4 pb-12">
        <div className="flex flex-wrap items-baseline justify-between gap-3">
          <h1 className="ui-title">Surveyor queue</h1>
          <p className="ui-muted">{homes.length} homes total</p>
        </div>

        <section className="ui-card mt-6 grid grid-cols-2 gap-3 p-4 sm:max-w-3xl sm:grid-cols-4">
          {stats.map((s) => (
            <div key={s.label} className="ui-stat">
              <span className="ui-stat-value">{s.value}</span>
              <span className="ui-stat-label">{s.label}</span>
            </div>
          ))}
        </section>

        <nav aria-label="Queue tabs" className="mt-6 flex flex-wrap items-center gap-2">
          {QUEUE_FILTERS.map((f) => (
            <Link
              key={f.id}
              href={f.id === "to_decide" ? "/review" : `/review?tab=${f.id}`}
              aria-current={filter === f.id ? "page" : undefined}
              className="ui-tab"
            >
              {f.label}
              <span className="ui-tab-count">{counts[f.id]}</span>
            </Link>
          ))}
          <Link href="/review/audit" className="ui-button-ghost ml-2">
            Audit
          </Link>
        </nav>

        {error && (
          <div className="mt-6">
            <Banner tone="error">Could not load homes. {error}</Banner>
          </div>
        )}

        {!error && shown.length === 0 && (
          <div className="ui-card mt-6 py-12 text-center">
            <p className="ui-subtitle">No homes here</p>
            <p className="ui-muted mt-1">{EMPTY_TEXT[filter]}</p>
          </div>
        )}

        {shown.length > 0 && (
          <>
            <div className="ui-card ui-card-flush mt-6 hidden overflow-x-auto md:block">
              <table className="ui-table">
                <thead>
                  <tr>
                    <th>Home</th>
                    <th>{filter === "to_decide" ? "Waiting" : "Status"}</th>
                    <th>Result</th>
                    <th>Batteries</th>
                    <th>Top reason</th>
                  </tr>
                </thead>
                <tbody>
                  {shown.map((h) => (
                    <tr key={h.id} className="relative">
                      <td>
                        <Link href={`/review/${h.id}`} className="after:absolute after:inset-0 hover:text-accent">
                          <HomeName home={h} />
                        </Link>
                      </td>
                      <td className="whitespace-nowrap">
                        <WhenText home={h} now={now} />
                      </td>
                      <td>
                        <StatusBadges verdict={h.verdict} decision={h.surveyor_decision} />
                      </td>
                      <td>
                        <BatteryCell home={h} />
                      </td>
                      <td className="max-w-sm">
                        <TopReason home={h} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <ul className="mt-6 space-y-3 md:hidden">
              {shown.map((h) => (
                <li key={h.id}>
                  <Link href={`/review/${h.id}`} className="ui-card block p-4 active:bg-page">
                    <div className="flex items-start justify-between gap-3">
                      <span className="min-w-0">
                        <HomeName home={h} />
                      </span>
                      <span className="shrink-0">
                        <StatusBadges verdict={h.verdict} decision={h.surveyor_decision} />
                      </span>
                    </div>
                    <p className="mt-1 text-sm text-muted">
                      <WhenText home={h} now={now} />
                      {" · "}
                      Batteries: <BatteryCell home={h} />
                    </p>
                    <p className="mt-2 text-sm text-ink">
                      <TopReason home={h} />
                    </p>
                  </Link>
                </li>
              ))}
            </ul>
          </>
        )}
      </main>
      <div className="flex justify-center pt-6">
        <a href="/api/export/labels" download className="ui-button-ghost text-base">
          Export labeled data
        </a>
      </div>
      <Footer />
    </>
  );
}
