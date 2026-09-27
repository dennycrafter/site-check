import type { Metadata } from "next";
import Link from "next/link";
import { Footer } from "@/components/footer";
import { StatusBadges } from "@/components/ui";
import { homeLabel } from "@/lib/homes";
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
export const metadata: Metadata = { title: "Surveyor queue | SiteCheck" };

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

function BatteryCell({ home }: { home: HomeRow }) {
  if (home.battery_count === null) return <span className="text-gray-400">-</span>;
  return (
    <span>
      <span className="font-semibold text-gray-900">{home.battery_count}</span>
      {home.verdict === "REVIEW" && <span className="ml-1 text-xs text-gray-500">provisional</span>}
    </span>
  );
}

function TopReason({ home }: { home: HomeRow }) {
  const { reason, others } = topReason(home.reasons);
  if (!reason) return <span className="text-gray-400">-</span>;
  return (
    <span>
      {reason.message}
      {others > 0 && <span className="ml-1 whitespace-nowrap text-xs font-semibold text-gray-500">+{others} more</span>}
    </span>
  );
}

function HomeName({ home }: { home: HomeRow }) {
  return (
    <>
      <span className="font-semibold text-gray-900">{homeLabel(home)}</span>
      {home.address && home.customer_name && <span className="block text-sm text-gray-500">{home.customer_name}</span>}
      {home.external_ref && <span className="block text-xs text-gray-500">Order {home.external_ref}</span>}
    </>
  );
}

function WhenText({ home, now }: { home: HomeRow; now: number }) {
  const tab = queueTab(home);
  if (tab === "to_decide") return <>Waiting {waitingTime(home.submitted_at, now)}</>;
  if (tab === "in_progress") return <span className="text-gray-500">Taking photos</span>;
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
  const stats = [
    { label: "To decide", value: String(counts.to_decide) },
    { label: "Oldest wait", value: oldest ? waitingTime(oldest.submitted_at, now) : "-" },
    { label: "Decided today", value: String(homes.filter((h) => decidedToday(h.decided_at, now)).length) },
  ];

  return (
    <>
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-6 sm:px-6">
        <div className="flex flex-wrap items-baseline justify-between gap-3">
          <div>
            <Link href="/" className="text-sm font-semibold text-accent">
              SiteCheck
            </Link>
            <h1 className="mt-1 text-2xl font-bold text-gray-900">Surveyor queue</h1>
          </div>
          <p className="text-sm text-gray-500">{homes.length} homes total</p>
        </div>

        <section className="mt-5 grid grid-cols-3 gap-3 sm:max-w-lg">
          {stats.map((s) => (
            <div key={s.label} className="rounded-xl border border-gray-200 px-4 py-3">
              <p className="text-2xl font-bold text-gray-900">{s.value}</p>
              <p className="text-xs font-semibold text-gray-500">{s.label}</p>
            </div>
          ))}
        </section>

        <nav aria-label="Queue tabs" className="mt-5 flex flex-wrap gap-2">
          {QUEUE_FILTERS.map((f) => (
            <Link
              key={f.id}
              href={f.id === "to_decide" ? "/review" : `/review?tab=${f.id}`}
              aria-current={filter === f.id ? "page" : undefined}
              className={`inline-flex min-h-10 items-center gap-2 rounded-full border px-4 text-sm font-semibold transition-colors ${
                filter === f.id
                  ? "border-accent bg-accent text-white"
                  : "border-gray-300 bg-surface text-gray-700 hover:border-gray-400"
              }`}
            >
              {f.label}
              <span className={filter === f.id ? "text-white/80" : "text-gray-400"}>{counts[f.id]}</span>
            </Link>
          ))}
        </nav>

        {error && (
          <div className="mt-6 rounded-xl border border-fail/30 bg-red-50 px-4 py-3 text-fail">
            Could not load homes. {error}
          </div>
        )}

        {!error && shown.length === 0 && (
          <div className="mt-8 rounded-2xl border border-dashed border-gray-300 px-6 py-12 text-center">
            <p className="text-lg font-semibold text-gray-900">No homes here</p>
            <p className="mt-1 text-gray-600">{EMPTY_TEXT[filter]}</p>
          </div>
        )}

        {shown.length > 0 && (
          <>
            <div className="mt-6 hidden overflow-hidden rounded-2xl border border-gray-200 md:block">
              <table className="w-full text-left text-sm">
                <thead className="bg-gray-50 text-xs font-semibold text-gray-500">
                  <tr>
                    <th className="px-4 py-3">Home</th>
                    <th className="px-4 py-3">{filter === "to_decide" ? "Waiting" : "Status"}</th>
                    <th className="px-4 py-3">Result</th>
                    <th className="px-4 py-3">Batteries</th>
                    <th className="px-4 py-3">Top reason</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {shown.map((h) => (
                    <tr key={h.id} className="relative hover:bg-gray-50">
                      <td className="px-4 py-3">
                        <Link href={`/review/${h.id}`} className="after:absolute after:inset-0 hover:text-accent">
                          <HomeName home={h} />
                        </Link>
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 text-gray-700">
                        <WhenText home={h} now={now} />
                      </td>
                      <td className="px-4 py-3">
                        <StatusBadges verdict={h.verdict} decision={h.surveyor_decision} />
                      </td>
                      <td className="px-4 py-3">
                        <BatteryCell home={h} />
                      </td>
                      <td className="max-w-sm px-4 py-3 text-gray-700">
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
                  <Link href={`/review/${h.id}`} className="block rounded-2xl border border-gray-200 p-4 active:bg-gray-50">
                    <div className="flex items-start justify-between gap-3">
                      <span className="min-w-0">
                        <HomeName home={h} />
                      </span>
                      <span className="shrink-0">
                        <StatusBadges verdict={h.verdict} decision={h.surveyor_decision} />
                      </span>
                    </div>
                    <p className="mt-1 text-sm text-gray-500">
                      <WhenText home={h} now={now} />
                      {" · "}
                      Batteries: <BatteryCell home={h} />
                    </p>
                    <p className="mt-2 text-sm text-gray-700">
                      <TopReason home={h} />
                    </p>
                  </Link>
                </li>
              ))}
            </ul>
          </>
        )}
      </main>
      <Footer />
    </>
  );
}
