import Link from "next/link";
import { DemoLinkForm } from "@/components/demo-link-form";
import { Footer } from "@/components/footer";
import { SiteHeader } from "@/components/site-header";
import { buttonClass } from "@/components/ui";
import { decidedToday, queueTab } from "@/lib/review";
import { getSupabase } from "@/lib/supabase";
import type { HomeRow } from "@/lib/types";

export const dynamic = "force-dynamic";

type QueueStat = { label: string; value: number };

async function loadQueueStats(): Promise<QueueStat[] | null> {
  const now = Date.now();
  try {
    const { data, error } = await getSupabase()
      .from("homes")
      .select("status, surveyor_decision, decided_at")
      .order("created_at", { ascending: false })
      .limit(500);
    if (error) return null;
    const homes = (data ?? []) as Pick<HomeRow, "status" | "surveyor_decision" | "decided_at">[];
    const counts = { to_decide: 0, in_progress: 0, decided: 0 };
    for (const h of homes) counts[queueTab(h)] += 1;
    return [
      { label: "To decide", value: counts.to_decide },
      { label: "In progress", value: counts.in_progress },
      { label: "Decided today", value: homes.filter((h) => decidedToday(h.decided_at, now)).length },
    ];
  } catch {
    return null;
  }
}

export default async function Home() {
  const stats = await loadQueueStats();
  return (
    <div className="ui-landing">
      <SiteHeader narrow />

      <main className="ui-container ui-container-narrow ui-landing-main">
        <section className="mx-auto max-w-3xl text-center">
          <h1 className="ui-hero">Home battery site photos, checked on the spot</h1>
          <p className="ui-lead ui-landing-hero-sub text-muted">Homeowners get it right the first time. Surveyors get a pre-checked site.</p>
        </section>

        <div className="ui-landing-grid">
          <DemoLinkForm />

          <section className="ui-card flex h-full flex-col">
            <div>
              <p className="ui-eyebrow">For surveyors</p>
              <h2 className="ui-title">Surveyor queue</h2>
              <p className="ui-lead ui-landing-intro">
                Every home arrives with photos, a preliminary check and a battery count. The surveyor makes the final call.
              </p>
            </div>
            {stats && (
              <div className="ui-landing-section grid grid-cols-3 gap-2">
                {stats.map((s) => (
                  <div key={s.label} className="ui-stat">
                    <span className="ui-stat-value">{s.value}</span>
                    <span className="ui-stat-label">{s.label}</span>
                  </div>
                ))}
              </div>
            )}
            <div className="ui-landing-actions mt-auto grid gap-3">
              <Link href="/review/audit" className={buttonClass("secondary", "w-full")}>
                Audit log
              </Link>
              <Link href="/review" className={buttonClass("primary", "w-full")}>
                Open surveyor queue
              </Link>
            </div>
          </section>
        </div>
      </main>

      <Footer />
    </div>
  );
}
