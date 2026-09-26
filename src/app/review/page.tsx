import type { Metadata } from "next";
import Link from "next/link";
import { Footer } from "@/components/footer";
import { VerdictBadge } from "@/components/ui";
import { homeLabel } from "@/lib/homes";
import { DECISION_LABELS, formatTime } from "@/lib/labels";
import { getSupabase } from "@/lib/supabase";
import type { HomeRow, Outcome } from "@/lib/types";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Surveyor queue | SiteCheck" };

const FILTERS = [
  { id: "all", label: "All" },
  { id: "PASS", label: "PASS" },
  { id: "FAIL", label: "FAIL" },
  { id: "REVIEW", label: "REVIEW" },
  { id: "undecided", label: "Undecided" },
] as const;

type FilterId = (typeof FILTERS)[number]["id"];

const STAT_STYLES: Record<Outcome, string> = {
  PASS: "text-pass",
  FAIL: "text-fail",
  REVIEW: "text-review",
};

async function loadHomes(): Promise<{ homes: HomeRow[]; error: string | null }> {
  try {
    const { data, error } = await getSupabase()
      .from("homes")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(500);
    if (error) return { homes: [], error: error.message };
    return { homes: (data ?? []) as HomeRow[], error: null };
  } catch (err) {
    return { homes: [], error: err instanceof Error ? err.message : String(err) };
  }
}

function applyFilter(homes: HomeRow[], filter: FilterId) {
  if (filter === "all") return homes;
  if (filter === "undecided") return homes.filter((h) => !h.surveyor_decision);
  return homes.filter((h) => h.verdict === filter);
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

export default async function ReviewPage({ searchParams }: PageProps<"/review">) {
  const params = await searchParams;
  const requested = typeof params.filter === "string" ? params.filter : "all";
  const filter: FilterId = FILTERS.some((f) => f.id === requested) ? (requested as FilterId) : "all";
  const { homes, error } = await loadHomes();
  const shown = applyFilter(homes, filter);
  const counts = {
    PASS: homes.filter((h) => h.verdict === "PASS").length,
    FAIL: homes.filter((h) => h.verdict === "FAIL").length,
    REVIEW: homes.filter((h) => h.verdict === "REVIEW").length,
  };

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

        <section className="mt-5 grid grid-cols-3 gap-3 sm:max-w-md">
          {(Object.keys(counts) as Outcome[]).map((v) => (
            <div key={v} className="rounded-xl border border-gray-200 px-4 py-3">
              <p className={`text-2xl font-bold ${STAT_STYLES[v]}`}>{counts[v]}</p>
              <p className="text-xs font-semibold tracking-wide text-gray-500">{v}</p>
            </div>
          ))}
        </section>

        <nav aria-label="Filter homes" className="mt-5 flex flex-wrap gap-2">
          {FILTERS.map((f) => (
            <Link
              key={f.id}
              href={f.id === "all" ? "/review" : `/review?filter=${f.id}`}
              aria-current={filter === f.id ? "page" : undefined}
              className={`inline-flex min-h-10 items-center rounded-full border px-4 text-sm font-semibold transition-colors ${
                filter === f.id
                  ? "border-accent bg-accent text-white"
                  : "border-gray-300 bg-white text-gray-700 hover:border-gray-400"
              }`}
            >
              {f.label}
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
            <p className="text-lg font-semibold text-gray-900">
              {homes.length === 0 ? "No homes yet" : "No homes match this filter"}
            </p>
            <p className="mt-1 text-gray-600">
              {homes.length === 0
                ? "When a homeowner starts a photo check, it shows up here right away."
                : "Try another filter to see more homes."}
            </p>
          </div>
        )}

        {shown.length > 0 && (
          <>
            <div className="mt-6 hidden overflow-hidden rounded-2xl border border-gray-200 md:block">
              <table className="w-full text-left text-sm">
                <thead className="bg-gray-50 text-xs font-semibold uppercase tracking-wide text-gray-500">
                  <tr>
                    <th className="px-4 py-3">Home</th>
                    <th className="px-4 py-3">Submitted</th>
                    <th className="px-4 py-3">Verdict</th>
                    <th className="px-4 py-3">Batteries</th>
                    <th className="px-4 py-3">Top reason</th>
                    <th className="px-4 py-3">Decision</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {shown.map((h) => (
                    <tr key={h.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3">
                        <Link href={`/review/${h.id}`} className="font-semibold text-gray-900 hover:text-accent">
                          {homeLabel(h)}
                        </Link>
                        {h.customer_name && h.address && (
                          <p className="text-xs text-gray-500">{h.customer_name}</p>
                        )}
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 text-gray-700">
                        {h.submitted_at ? formatTime(h.submitted_at) : <span className="text-gray-500">In progress</span>}
                      </td>
                      <td className="px-4 py-3">
                        <VerdictBadge verdict={h.verdict} />
                      </td>
                      <td className="px-4 py-3">
                        <BatteryCell home={h} />
                      </td>
                      <td className="max-w-sm px-4 py-3 text-gray-700">{h.reasons[0]?.message ?? "-"}</td>
                      <td className="whitespace-nowrap px-4 py-3 text-gray-700">
                        {h.surveyor_decision ? DECISION_LABELS[h.surveyor_decision] : <span className="text-gray-400">-</span>}
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
                    <div className="flex items-center justify-between gap-3">
                      <span className="font-semibold text-gray-900">{homeLabel(h)}</span>
                      <VerdictBadge verdict={h.verdict} />
                    </div>
                    <p className="mt-1 text-sm text-gray-500">
                      {h.submitted_at ? formatTime(h.submitted_at) : "In progress"}
                      {" · "}
                      Batteries: <BatteryCell home={h} />
                    </p>
                    {h.reasons[0] && <p className="mt-2 text-sm text-gray-700">{h.reasons[0].message}</p>}
                    {h.surveyor_decision && (
                      <p className="mt-2 text-xs font-semibold text-accent">{DECISION_LABELS[h.surveyor_decision]}</p>
                    )}
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
