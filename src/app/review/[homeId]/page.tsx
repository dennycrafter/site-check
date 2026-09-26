import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Footer } from "@/components/footer";
import { VerdictBadge } from "@/components/ui";
import { loadHome } from "@/lib/homes";
import {
  DECISION_LABELS,
  FIELD_LABELS,
  formatField,
  formatTime,
  HAZARD_FIELDS,
  PHOTO_STATUS_LABELS,
  SETUP_LABELS,
} from "@/lib/labels";
import { latestPhotoByStep, planSteps } from "@/lib/plan";
import { CONFIDENCE_MIN } from "@/lib/rules";
import { isStepId, STEP_BY_ID, STEP_IDS, stepTitle } from "@/lib/steps";
import { signedUrls } from "@/lib/supabase";
import type { Outcome, PhotoRow, PhotoStatus, Reason } from "@/lib/types";
import { DecisionPanel, RecheckButton } from "./actions";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Home detail | SiteCheck" };

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const OUTCOME_STYLES: Record<Outcome, { title: string; dot: string; text: string }> = {
  FAIL: { title: "Fail", dot: "bg-fail", text: "text-fail" },
  REVIEW: { title: "Needs review", dot: "bg-review", text: "text-review" },
  PASS: { title: "Pass", dot: "bg-pass", text: "text-pass" },
};

const STATUS_STYLES: Record<PhotoStatus | "pending", string> = {
  accepted: "bg-green-50 text-pass",
  retake: "bg-amber-50 text-review",
  check_failed: "bg-gray-100 text-gray-700",
  accepted_after_max_attempts: "bg-amber-50 text-review",
  pending: "bg-gray-100 text-gray-500",
};

function YesNo({ value }: { value: boolean }) {
  return <span className="font-semibold text-gray-900">{value ? "Yes" : "No"}</span>;
}

function Readout({ photo }: { photo: PhotoRow }) {
  if (!photo.analysis) {
    return (
      <p className="text-sm text-gray-600">
        No AI readout. {photo.error ? <span className="text-gray-500">Error: {photo.error}</span> : null}
      </p>
    );
  }
  const a = photo.analysis;
  const fields = isStepId(photo.step) ? STEP_BY_ID[photo.step].fields : [];
  const lowConfidence = a.confidence < CONFIDENCE_MIN;
  return (
    <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-sm">
      {fields.map((field) => {
        const hazard = HAZARD_FIELDS.includes(field) && a[field] === true;
        return (
          <div key={field} className="contents">
            <dt className="text-gray-500">{FIELD_LABELS[field]}</dt>
            <dd className={`font-medium ${hazard ? "text-fail" : "text-gray-900"}`}>{formatField(field, a)}</dd>
          </div>
        );
      })}
      <dt className="text-gray-500">Confidence</dt>
      <dd className={`font-medium ${lowConfidence ? "text-review" : "text-gray-900"}`}>
        {a.confidence}%{lowConfidence ? " (low)" : ""}
      </dd>
      {a.retake_reason !== "none" && (
        <>
          <dt className="text-gray-500">Retake reason</dt>
          <dd className="font-medium text-gray-900">{formatField("retake_reason", a)}</dd>
        </>
      )}
      {a.notes && (
        <>
          <dt className="text-gray-500">AI notes</dt>
          <dd className="text-gray-700">{a.notes}</dd>
        </>
      )}
    </dl>
  );
}

function PhotoMeta({ photo }: { photo: PhotoRow }) {
  return (
    <p className="text-xs text-gray-400">
      Attempt {photo.attempt}
      {photo.latency_ms !== null && ` · ${(photo.latency_ms / 1000).toFixed(1)}s`}
      {` · ${photo.ai_attempts} AI ${photo.ai_attempts === 1 ? "call" : "calls"}`}
      {photo.model && ` · ${photo.model}`}
    </p>
  );
}

function ReasonGroup({ outcome, reasons }: { outcome: Outcome; reasons: Reason[] }) {
  if (reasons.length === 0) return null;
  const style = OUTCOME_STYLES[outcome];
  return (
    <div>
      <h3 className={`text-sm font-bold uppercase tracking-wide ${style.text}`}>
        {style.title} ({reasons.length})
      </h3>
      <ul className="mt-2 space-y-2">
        {reasons.map((r, i) => (
          <li key={`${r.code}-${i}`} className="flex gap-3">
            <span className={`mt-2 h-2 w-2 shrink-0 rounded-full ${style.dot}`} />
            <div>
              <p className="text-gray-900">{r.message}</p>
              <p className="text-xs text-gray-500">
                <span className="font-mono">{r.code}</span>
                {r.step && ` · ${stepTitle(r.step)}`}
              </p>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

export default async function HomeDetailPage({ params }: PageProps<"/review/[homeId]">) {
  const { homeId } = await params;
  if (!UUID_RE.test(homeId)) notFound();
  const loaded = await loadHome(homeId);
  if (!loaded) notFound();
  const { home, photos } = loaded;

  const urls = await signedUrls(photos.map((p) => p.storage_path));
  const latest = latestPhotoByStep(photos);
  const planned = planSteps(home, photos);
  const extra = STEP_IDS.filter((id) => !planned.includes(id) && latest.has(id));
  const stepOrder = [...planned, ...extra];
  const reasons = home.reasons ?? [];

  return (
    <>
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-6 sm:px-6">
        <Link href="/review" className="text-sm font-semibold text-accent hover:underline">
          Back to queue
        </Link>

        <header className="mt-3 flex flex-col gap-4 border-b border-gray-200 pb-6 md:flex-row md:items-start md:justify-between">
          <div>
            <div className="flex flex-wrap items-center gap-3">
              <h1 className="text-2xl font-bold text-gray-900">{home.customer_name}</h1>
              <VerdictBadge verdict={home.verdict} />
            </div>
            <p className="mt-1 text-gray-600">{home.customer_email}</p>
            <div className="mt-3 flex flex-wrap gap-x-6 gap-y-1 text-sm text-gray-600">
              <span>
                Austin: <YesNo value={home.in_austin} />
              </span>
              <span>
                Solar: <YesNo value={home.has_solar} />
              </span>
              <span>
                Setup: <span className="font-semibold text-gray-900">{SETUP_LABELS[home.setup_type]}</span>
              </span>
              {home.panel_same_wall_answer !== "not_asked" && (
                <span>
                  Panel on meter wall:{" "}
                  <span className="font-semibold text-gray-900">{home.panel_same_wall_answer.replace("_", " ")}</span>
                </span>
              )}
            </div>
            <p className="mt-2 text-xs text-gray-500">
              {home.submitted_at ? `Submitted ${formatTime(home.submitted_at)}` : "In progress"}
              {` · Started ${formatTime(home.created_at)}`}
            </p>
          </div>
          <div className="flex items-center gap-4 rounded-2xl border border-gray-200 px-5 py-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Batteries</p>
              <p className="text-3xl font-bold text-gray-900">{home.battery_count ?? "-"}</p>
              {home.verdict === "REVIEW" && <p className="text-xs text-review">provisional</p>}
            </div>
            <div className="h-12 w-px bg-gray-200" />
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Decision</p>
              <p className="text-base font-semibold text-gray-900">
                {home.surveyor_decision ? DECISION_LABELS[home.surveyor_decision] : "Undecided"}
              </p>
            </div>
          </div>
        </header>

        <div className="mt-6 grid gap-8 lg:grid-cols-[1fr_340px]">
          <div className="order-2 lg:order-1">
            <h2 className="text-lg font-bold text-gray-900">Photos</h2>
            {stepOrder.length === 0 && <p className="mt-2 text-gray-600">No steps yet.</p>}
            <div className="mt-3 grid gap-4 sm:grid-cols-2">
              {stepOrder.map((stepId) => {
                const photo = latest.get(stepId);
                const history = photos.filter((p) => p.step === stepId && p.id !== photo?.id).reverse();
                const status = photo?.status ?? "pending";
                return (
                  <article key={stepId} className="overflow-hidden rounded-2xl border border-gray-200">
                    <div className="relative aspect-[4/3] bg-gray-100">
                      {photo && urls[photo.storage_path] ? (
                        <a href={urls[photo.storage_path]} target="_blank" rel="noreferrer">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            src={urls[photo.storage_path]}
                            alt={stepTitle(stepId)}
                            className="h-full w-full object-cover"
                          />
                        </a>
                      ) : (
                        <div className="flex h-full items-center justify-center text-sm text-gray-400">
                          No photo
                        </div>
                      )}
                    </div>
                    <div className="space-y-3 p-4">
                      <div className="flex items-start justify-between gap-2">
                        <h3 className="font-semibold text-gray-900">{stepTitle(stepId)}</h3>
                        <span className={`shrink-0 rounded-md px-2 py-0.5 text-xs font-semibold ${STATUS_STYLES[status]}`}>
                          {PHOTO_STATUS_LABELS[status]}
                        </span>
                      </div>
                      {!planned.includes(stepId) && (
                        <p className="text-xs text-gray-500">No longer required for this setup.</p>
                      )}
                      {photo && (
                        <>
                          <Readout photo={photo} />
                          <PhotoMeta photo={photo} />
                        </>
                      )}
                      {history.length > 0 && (
                        <details className="rounded-lg bg-gray-50 px-3 py-2">
                          <summary className="cursor-pointer text-sm font-medium text-gray-700">
                            Previous attempts ({history.length})
                          </summary>
                          <ul className="mt-3 space-y-3">
                            {history.map((p) => (
                              <li key={p.id} className="flex gap-3">
                                {urls[p.storage_path] && (
                                  <a href={urls[p.storage_path]} target="_blank" rel="noreferrer" className="shrink-0">
                                    {/* eslint-disable-next-line @next/next/no-img-element */}
                                    <img src={urls[p.storage_path]} alt="" className="h-16 w-16 rounded-md object-cover" />
                                  </a>
                                )}
                                <div className="min-w-0 text-sm">
                                  <p className="font-medium text-gray-800">{PHOTO_STATUS_LABELS[p.status]}</p>
                                  {p.analysis?.retake_instruction && (
                                    <p className="text-gray-600">&ldquo;{p.analysis.retake_instruction}&rdquo;</p>
                                  )}
                                  <PhotoMeta photo={p} />
                                </div>
                              </li>
                            ))}
                          </ul>
                        </details>
                      )}
                    </div>
                  </article>
                );
              })}
            </div>
          </div>

          <aside className="order-1 space-y-6 lg:order-2">
            <section className="rounded-2xl border border-gray-200 p-5">
              <div className="flex items-center justify-between gap-3">
                <h2 className="text-lg font-bold text-gray-900">Reasons</h2>
                <RecheckButton homeId={home.id} disabled={photos.length === 0} />
              </div>
              <div className="mt-4 space-y-5">
                {reasons.length === 0 && <p className="text-gray-600">No reasons yet.</p>}
                {(["FAIL", "REVIEW", "PASS"] as Outcome[]).map((o) => (
                  <ReasonGroup key={o} outcome={o} reasons={reasons.filter((r) => r.outcome === o)} />
                ))}
              </div>
            </section>
            <DecisionPanel
              homeId={home.id}
              decision={home.surveyor_decision}
              note={home.surveyor_note ?? ""}
            />
          </aside>
        </div>
      </main>
      <Footer />
    </>
  );
}
