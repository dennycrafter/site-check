import type { Metadata } from "next";
import Link from "next/link";
import { Footer } from "@/components/footer";
import { LiveRefresh } from "@/components/live-refresh";
import { SiteHeader } from "@/components/site-header";
import { Banner, QueueResult } from "@/components/ui";
import { homeLabel, loadLabeledData } from "@/lib/homes";
import { correctionStats } from "@/lib/labeledData";
import { formatTime } from "@/lib/labels";
import { isLive, liveHref } from "@/lib/live";
import {
  effectiveQueueSort,
  filterQueue,
  nextQueueSort,
  parseQueueFilter,
  parseQueueSort,
  QUEUE_FILTERS,
  queueHref,
  queueTab,
  SORT_KEYS,
  sortQueue,
  topReason,
  waitingTime,
  type QueueFilter,
  type QueueSort,
  type SortKey,
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
  if (home.verdict === "REVIEW") {
    return (
      <span className="text-muted" title="Provisional">
        {home.battery_count}
      </span>
    );
  }
  return <span className="text-ink">{home.battery_count}</span>;
}

function TopReason({ home }: { home: HomeRow }) {
  const { reason, others } = topReason(home.reasons);
  if (!reason) return <span className="text-muted">-</span>;
  return (
    <span className="review-reason" title={reason.message}>
      <span className="review-reason-text">{reason.message}</span>
      {others > 0 && <span className="review-reason-more">+{others} more</span>}
    </span>
  );
}

function homeFullText(home: HomeRow): string {
  const parts = [homeLabel(home)];
  if (home.address && home.customer_name) parts.push(home.customer_name);
  if (home.external_ref) parts.push(`Order ${home.external_ref}`);
  return parts.join(" · ");
}

function HomeName({ home }: { home: HomeRow }) {
  const detail = [home.address ? home.customer_name : null, home.external_ref ? `Order ${home.external_ref}` : null]
    .filter(Boolean)
    .join(" · ");
  return (
    <span className="review-home">
      <span className="review-home-address">{homeLabel(home)}</span>
      {detail && <span className="review-home-detail">{` · ${detail}`}</span>}
    </span>
  );
}

function shortSubmitted(iso: string): string {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZone: "America/Chicago",
  }).format(new Date(iso));
}

/** `bare` drops the "Waiting" label where the column header already says it. */
function WhenText({ home, now, bare = false }: { home: HomeRow; now: number; bare?: boolean }) {
  const tab = queueTab(home);
  if (tab === "to_decide") {
    const wait = waitingTime(home.submitted_at, now);
    return <>{bare ? wait : `Waiting ${wait}`}</>;
  }
  if (tab === "in_progress") return <span className="text-muted">Taking photos</span>;
  return (
    <span title={home.submitted_at ? `Submitted ${formatTime(home.submitted_at)}` : undefined}>
      {home.submitted_at ? `Submitted ${shortSubmitted(home.submitted_at)}` : "Not submitted"}
    </span>
  );
}

function SortArrow({ dir }: { dir: "asc" | "desc" }) {
  return (
    <svg viewBox="0 0 10 10" aria-hidden="true" focusable="false" className="review-sort-arrow">
      <path
        d={dir === "asc" ? "M5 1.5v7M2 4.5l3-3 3 3" : "M5 8.5v-7M2 5.5l3 3 3-3"}
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function ariaSort(sort: QueueSort, key: SortKey) {
  if (sort?.key !== key) return undefined;
  return sort.dir === "asc" ? "ascending" : "descending";
}

type SortLinkProps = { sortKey: SortKey; label: string; filter: QueueFilter; sort: QueueSort; live: boolean };

/** One click moves to the next state: default direction, flipped, then no sort. */
function SortLink({ sortKey, label, filter, sort, live }: SortLinkProps) {
  const active = sort?.key === sortKey ? sort : null;
  return (
    <Link
      href={queueHref(filter, nextQueueSort(sort, sortKey), live)}
      aria-current={active ? "true" : undefined}
      className="review-sort-link"
    >
      {label}
      {active && <SortArrow dir={active.dir} />}
    </Link>
  );
}

export default async function ReviewPage({ searchParams }: PageProps<"/review">) {
  const params = await searchParams;
  const filter = parseQueueFilter(params.tab);
  const live = isLive(params);
  const sort = effectiveQueueSort(parseQueueSort(params.sort, params.dir), filter);
  const urlSort = parseQueueSort(params.sort, params.dir);
  const { homes, error, now } = await loadHomes();
  const shown = sortQueue(filterQueue(homes, filter), sort);
  const counts: Record<QueueFilter, number> = {
    to_decide: 0,
    in_progress: 0,
    decided: 0,
    all: homes.length,
  };
  for (const h of homes) counts[queueTab(h)] += 1;
  const corrected = await correctedReadings(homes);

  return (
    <>
      <SiteHeader tag="Surveyor" wide />
      {live && <LiveRefresh />}
      <main className="ui-container ui-container-wide flex-1 pt-4 pb-12">
        <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
          <h1 className="review-title">Surveyor queue</h1>
          <p className="review-count">{homes.length} homes</p>
        </div>

        <nav aria-label="Queue tabs" className="review-tabs mt-5">
          <div className="review-tabs-list">
            {QUEUE_FILTERS.map((f) => (
              <Link
                key={f.id}
                href={queueHref(f.id, urlSort, live)}
                aria-current={filter === f.id ? "page" : undefined}
                className="review-tab"
              >
                {f.label}
                <span className="review-tab-count">{counts[f.id]}</span>
              </Link>
            ))}
          </div>
          <Link href="/review/audit" className="review-tabs-link">
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
            <table className="review-table mt-6 hidden md:table">
              <colgroup>
                <col />
                <col className={filter === "to_decide" ? "review-col-waiting" : "review-col-when"} />
                <col className="review-col-result" />
                <col className="review-col-batteries" />
                <col className="review-col-reason" />
              </colgroup>
              <thead>
                <tr>
                  <th>Home</th>
                  <th aria-sort={ariaSort(sort, "waiting")}>
                    {filter === "to_decide" ? (
                      <SortLink sortKey="waiting" label="Waiting" filter={filter} sort={sort} live={live} />
                    ) : (
                      "Status"
                    )}
                  </th>
                  <th aria-sort={ariaSort(sort, "result")}>
                    <SortLink sortKey="result" label="Result" filter={filter} sort={sort} live={live} />
                  </th>
                  <th>Batteries</th>
                  <th>Top reason</th>
                </tr>
              </thead>
              <tbody>
                {shown.map((h) => {
                  const href = liveHref(`/review/${h.id}`, live);
                  return (
                    <tr key={h.id}>
                      <td>
                        <Link href={href} title={homeFullText(h)} className="review-row-link">
                          <HomeName home={h} />
                        </Link>
                      </td>
                      <td className="review-nowrap">
                        <WhenText home={h} now={now} bare={filter === "to_decide"} />
                      </td>
                      <td>
                        <QueueResult verdict={h.verdict} decision={h.surveyor_decision} />
                      </td>
                      <td className="review-numeric">
                        <Link href={href} tabIndex={-1} aria-hidden="true" className="review-cell-link">
                          <BatteryCell home={h} />
                        </Link>
                      </td>
                      <td>
                        <Link href={href} tabIndex={-1} aria-hidden="true" className="review-cell-link">
                          <TopReason home={h} />
                        </Link>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>

            <p className="review-sort-bar md:hidden">
              <span>Sort:</span>
              {SORT_KEYS.filter((k) => k.id === "result" || filter === "to_decide").map((k, i) => (
                <span key={k.id} className="contents">
                  {i > 0 && <span aria-hidden="true">·</span>}
                  <SortLink sortKey={k.id} label={k.label} filter={filter} sort={sort} live={live} />
                </span>
              ))}
            </p>

            <ul className="review-list mt-2 md:hidden">
              {shown.map((h) => (
                <li key={h.id}>
                  <Link href={liveHref(`/review/${h.id}`, live)} className="review-list-link">
                    <span className="review-list-address">{homeLabel(h)}</span>
                    <span className="review-list-meta">
                      <QueueResult verdict={h.verdict} decision={h.surveyor_decision} />
                      <span className="review-list-when">
                        <WhenText home={h} now={now} />
                      </span>
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </>
        )}
      </main>
      <p className="review-footnote">
        AI readings corrected: {corrected ? `${corrected.corrected} of ${corrected.total}` : "-"}
        {" · "}
        <a href="/api/export/labels" download>
          Export labeled data
        </a>
      </p>
      <Footer />
    </>
  );
}
