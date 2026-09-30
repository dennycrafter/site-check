import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Footer } from "@/components/footer";
import { SiteHeader } from "@/components/site-header";
import { BADGE_CLASS, buttonClass, type BadgeTone } from "@/components/ui";
import { homeLabel, loadHome } from "@/lib/homes";
import { FIELD_LABELS, formatTime, PHOTO_STATUS_LABELS } from "@/lib/labels";
import { latestFinishedByStep, latestPhotoByStep, planSteps } from "@/lib/plan";
import { googleMapsLink } from "@/lib/property";
import {
  batteryText,
  evidenceStep,
  groupReasons,
  highlightedFields,
  keyFacts,
  topReason,
  valueLabel,
  verdictLabel,
  type FactTone,
  type ReasonGroup,
} from "@/lib/review";
import { CONFIDENCE_MIN } from "@/lib/rules";
import type { PhotoAnalysis } from "@/lib/schema";
import { getStep, isExtraStepId, SPACE_STEPS, STEP_IDS, stepTitle } from "@/lib/steps";
import { signedUrls } from "@/lib/supabase";
import type { HomeProperty, HomeRow, Outcome, PanelSameWallAnswer, PhotoRow, PhotoStatus, Reason } from "@/lib/types";
import "@/styles/customer-flow.css";
import "@/styles/review.css";
import { DecisionControls, DetailsToggle, HomeMenu, PhotoZoom, RecheckButton } from "./actions";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Home detail | site-check" };

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const OUTCOME_STYLES: Record<Outcome, { title: string; dot: string; text: string }> = {
  FAIL: { title: "Fail", dot: "bg-fail", text: "text-fail" },
  REVIEW: { title: "Needs review", dot: "bg-review", text: "text-review" },
  PASS: { title: "Pass", dot: "bg-pass", text: "text-pass" },
};

const STATUS_TONES: Record<PhotoStatus | "pending", BadgeTone> = {
  accepted: "pass",
  retake: "review",
  check_failed: "neutral",
  accepted_after_max_attempts: "review",
  pending: "neutral",
};

const FACT_STYLES: Record<FactTone, string> = {
  ok: "text-ink",
  unknown: "text-review",
  review: "text-review",
  fail: "text-fail",
};

const WALL_ANSWER_LABELS: Record<PanelSameWallAnswer, string> = {
  yes: "Yes",
  no: "No",
  not_sure: "Not sure",
  not_asked: "Not asked",
};

const photoAnchor = (step: string) => `photo-${step}`;

function YesNo({ value }: { value: boolean | null }) {
  if (value === null) return <span className="font-semibold text-muted">Not given</span>;
  return <span className="font-semibold text-ink">{value ? "Yes" : "No"}</span>;
}

function KeyFacts({ home, photos }: { home: HomeRow; photos: PhotoRow[] }) {
  const analyses = new Map<string, PhotoAnalysis>();
  for (const [step, p] of latestFinishedByStep(photos)) {
    if (p.status === "accepted" && p.analysis) analyses.set(step, p.analysis);
  }
  const facts = keyFacts({
    setupType: home.setup_type,
    analyses,
    reasons: home.reasons,
    spaceSteps: [...SPACE_STEPS, ...home.extra_steps.map((e) => e.id)],
  });
  return (
    <section className="ui-card">
      <h2 className="ui-subtitle">Key facts</h2>
      <dl className="mt-3 grid gap-x-6 gap-y-3 sm:grid-cols-2">
        {facts.map((f) => (
          <div key={f.label}>
            <dt className="text-xs font-semibold text-muted">{f.label}</dt>
            <dd className={`font-semibold ${FACT_STYLES[f.tone]}`}>{f.value}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}

function ReasonSection({ outcome, groups }: { outcome: Outcome; groups: ReasonGroup[] }) {
  if (groups.length === 0) return null;
  const style = OUTCOME_STYLES[outcome];
  return (
    <div>
      <h3 className={`text-sm font-bold ${style.text}`}>
        {style.title} ({groups.length})
      </h3>
      <ul className="mt-2 space-y-3">
        {groups.map((g) => (
          <li key={g.code} className="flex gap-3">
            <span className={`mt-2 h-2 w-2 shrink-0 rounded-full ${style.dot}`} />
            <div className="min-w-0">
              <p className="text-ink">{g.message}</p>
              <p className="mt-0.5 flex flex-wrap items-baseline gap-x-2 text-sm">
                {g.steps.map((step) => (
                  <a key={step} href={`#${photoAnchor(step)}`} className="font-medium text-accent hover:underline">
                    {stepTitle(step)}
                  </a>
                ))}
                <span className="font-mono text-[11px] text-muted">{g.code}</span>
              </p>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

function Reasons({ home, hasPhotos }: { home: HomeRow; hasPhotos: boolean }) {
  const groups = groupReasons(home.reasons);
  return (
    <section className="ui-card">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="ui-subtitle">Reasons</h2>
          <p className="mt-1 text-sm text-muted">From the automatic check. Final decision stays with the review team.</p>
        </div>
        <RecheckButton homeId={home.id} disabled={!hasPhotos} />
      </div>
      <div className="mt-4 space-y-5">
        {groups.length === 0 && <p className="text-muted">No reasons yet.</p>}
        {(["FAIL", "REVIEW", "PASS"] as Outcome[]).map((o) => (
          <ReasonSection key={o} outcome={o} groups={groups.filter((g) => g.outcome === o)} />
        ))}
      </div>
    </section>
  );
}

function Readout({ photo, home, reasons }: { photo: PhotoRow; home: HomeRow; reasons: Reason[] }) {
  if (!photo.analysis) {
    return (
      <p className="text-sm text-muted">
        No AI readout. {photo.error ? <span className="text-muted">Error: {photo.error}</span> : null}
      </p>
    );
  }
  const a = photo.analysis;
  const fields = getStep(photo.step, home.extra_steps)?.fields ?? [];
  const flagged = new Set(highlightedFields(photo.step, a, reasons));
  const failing = new Set(highlightedFields(photo.step, a, reasons.filter((r) => r.outcome === "FAIL")));
  const lowConfidence = a.confidence < CONFIDENCE_MIN;
  return (
    <dl className="grid grid-cols-[auto_1fr] gap-x-4 text-sm">
      {fields.map((field) => {
        const value = valueLabel(field, a[field]);
        const tone = failing.has(field)
          ? "bg-red-50 font-semibold text-fail"
          : flagged.has(field)
            ? "bg-amber-50 font-semibold text-review"
            : "";
        return (
          <div key={field} className={`col-span-2 grid grid-cols-subgrid rounded-md px-2 py-0.5 ${tone}`}>
            <dt className={tone ? "" : "text-muted"}>{FIELD_LABELS[field]}</dt>
            <dd className={tone ? "" : value === "Unknown" || value === "Unclear" ? "font-medium text-review" : "font-medium text-ink"}>
              {value}
            </dd>
          </div>
        );
      })}
      <div className="col-span-2 grid grid-cols-subgrid px-2 py-0.5">
        <dt className="text-muted">Confidence</dt>
        <dd className={`font-medium ${lowConfidence ? "text-review" : "text-ink"}`}>
          {a.confidence}%{lowConfidence ? " (low)" : ""}
        </dd>
      </div>
      {a.retake_reason !== "none" && (
        <div className="col-span-2 grid grid-cols-subgrid px-2 py-0.5">
          <dt className="text-muted">Retake reason</dt>
          <dd className="font-medium text-ink">{valueLabel("retake_reason", a.retake_reason)}</dd>
        </div>
      )}
      {a.notes && (
        <div className="col-span-2 grid grid-cols-subgrid px-2 py-0.5">
          <dt className="text-muted">AI notes</dt>
          <dd className="text-ink">{a.notes}</dd>
        </div>
      )}
    </dl>
  );
}

function siteCoverage(home: HomeRow): { label: string; tone: string } {
  if (home.site_check_status === "failed") {
    return { label: "Could not be checked. Look over the photos yourself.", tone: "text-review" };
  }
  if (home.site_check_status === "not_run") return { label: "Not checked yet", tone: "text-muted" };
  const n = home.extra_steps.length;
  if (n === 0) return { label: "All areas around the meter are covered", tone: "text-pass" };
  return { label: `Some areas were missing, so we asked for ${n} more ${n === 1 ? "photo" : "photos"}`, tone: "text-review" };
}

function MapLink({ point, children }: { point: { lat: number; lng: number }; children: string }) {
  return (
    <a href={googleMapsLink(point)} target="_blank" rel="noreferrer" className="font-semibold text-accent underline-offset-4 hover:underline">
      {children}
    </a>
  );
}

function LocationCard({ property }: { property: HomeProperty }) {
  const flags = [
    !property.propertyConfirmed && "Home not confirmed",
    property.meterUncertain && "Meter spot marked as unsure",
  ].filter((flag): flag is string => Boolean(flag));
  return (
    <section className="ui-card">
      <h2 className="ui-subtitle">Location</h2>
      {property.address && <p className="mt-1 text-ink">{property.address}</p>}
      {flags.length > 0 && (
        <ul className="mt-3 flex flex-wrap gap-2">
          {flags.map((flag) => (
            <li key={flag} className="ui-badge-review">
              {flag}
            </li>
          ))}
        </ul>
      )}
      {property.source === "google" ? (
        <ul className="mt-3 space-y-1 text-sm">
          <li>
            {property.meter ? (
              <MapLink point={property.meter}>Open meter spot in Google Maps</MapLink>
            ) : (
              <span className="text-muted">Meter spot not marked</span>
            )}
          </li>
        </ul>
      ) : (
        <div className="pl-reference mt-3 max-w-sm rounded-brand border border-line" style={{ height: 420 }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/property-map-reference.png" alt="Example map with the meter marked" draggable={false} />
          <span className="pl-example-badge">Example map</span>
          {property.exampleMeter && (
            <span className="pl-pin pl-meter" style={{ left: `${property.exampleMeter.x * 100}%`, top: `${property.exampleMeter.y * 100}%` }}>
              M<span>Meter</span>
            </span>
          )}
        </div>
      )}
    </section>
  );
}

function SiteCoverageCard({
  home,
  latest,
  urls,
}: {
  home: HomeRow;
  latest: Map<string, PhotoRow>;
  urls: Record<string, string>;
}) {
  const { label, tone } = siteCoverage(home);
  return (
    <section className="ui-card">
      <h2 className="ui-subtitle">Site coverage</h2>
      <p className={`mt-1 font-semibold ${tone}`}>{label}</p>
      {home.site_check?.summary && <p className="mt-2 text-ink">{home.site_check.summary}</p>}
      {home.extra_steps.length > 0 && (
        <ul className="mt-4 space-y-3">
          {home.extra_steps.map((extra) => {
            const photo = latest.get(extra.id);
            const url = photo ? urls[photo.storage_path] : undefined;
            return (
              <li key={extra.id} className="flex gap-3">
                {url ? (
                  <PhotoZoom src={url} alt={extra.instruction} className="h-16 w-16 shrink-0 overflow-hidden rounded-md" />
                ) : (
                  <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-brand bg-page text-center text-[10px] text-muted">
                    Not taken
                  </div>
                )}
                <div className="min-w-0">
                  <p className="font-medium text-ink">{extra.instruction}</p>
                  {extra.reason && <p className="text-xs text-muted">{extra.reason}</p>}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

function PhotoMeta({ photo }: { photo: PhotoRow }) {
  return (
    <p className="text-xs text-muted">
      Attempt {photo.attempt}
      {photo.latency_ms !== null && ` · ${(photo.latency_ms / 1000).toFixed(1)}s`}
      {` · ${photo.ai_attempts} AI ${photo.ai_attempts === 1 ? "call" : "calls"}`}
      {photo.model && ` · ${photo.model}`}
    </p>
  );
}

function HomeInfo({ home }: { home: HomeRow }) {
  return (
    <section className="ui-card">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="ui-subtitle">{homeLabel(home)}</h2>
          {home.external_ref && <p className="mt-1 text-sm font-semibold text-ink">Order {home.external_ref}</p>}
        </div>
        <div className="flex shrink-0 items-center gap-3">
          <a
            href={`/api/homes/${home.id}/export`}
            target="_blank"
            rel="noreferrer"
            className={buttonClass("secondary", "whitespace-nowrap")}
          >
            Export for Base (JSON)
          </a>
          <HomeMenu homeId={home.id} />
        </div>
      </div>
      <div className="mt-3 flex flex-wrap gap-x-6 gap-y-1 text-sm text-muted">
        <span>
          Austin: <YesNo value={home.in_austin} />
        </span>
        <span>
          Solar: <YesNo value={home.has_solar} />
        </span>
        {home.panel_same_wall_answer !== "not_asked" && (
          <span>
            Breaker box on meter wall:{" "}
            <span className="font-semibold text-ink">{WALL_ANSWER_LABELS[home.panel_same_wall_answer]}</span>
          </span>
        )}
      </div>
      <p className="mt-2 text-xs text-muted">
        {home.submitted_at ? `Submitted ${formatTime(home.submitted_at)}` : "In progress"}
        {` · Started ${formatTime(home.created_at)}`}
      </p>
    </section>
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

  const { reason: top } = topReason(reasons);
  const evidence = evidenceStep(top);
  const evidencePhoto = latest.get(evidence);
  const evidenceUrl = evidencePhoto ? urls[evidencePhoto.storage_path] : undefined;
  const evidenceTitle = getStep(evidence, home.extra_steps)?.title ?? stepTitle(evidence);
  const batteries = batteryText(home.verdict, home.battery_count);
  const customer = [home.customer_name, home.customer_email].filter(Boolean).join(" · ") || homeLabel(home);

  return (
    <>
      <SiteHeader tag="Surveyor" />
      <main className="rv ui-container flex-1 pt-4 pb-12">
        <Link href="/review" className="ui-button-ghost">
          Back to queue
        </Link>

        <section className="rv-decision" aria-label="Decision">
          <p className="rv-customer">{customer}</p>
          <h1 className="rv-verdict">
            <span className={home.verdict ? OUTCOME_STYLES[home.verdict].text : "text-muted"}>
              {verdictLabel(home.verdict)}
            </span>
            {batteries && <span className="rv-batteries">{batteries}</span>}
          </h1>
          {top && <p className="rv-reason">{top.message}</p>}
          <figure className="rv-evidence">
            <div className="rv-evidence-frame">
              {evidenceUrl ? (
                <PhotoZoom src={evidenceUrl} alt={evidenceTitle} className="h-full w-full" />
              ) : (
                <div className="flex h-full items-center justify-center text-muted">No photo yet</div>
              )}
            </div>
            <figcaption>{evidenceTitle}</figcaption>
          </figure>
          <DecisionControls
            key={`${home.surveyor_decision ?? "none"}-${home.decided_at ?? ""}`}
            homeId={home.id}
            decision={home.surveyor_decision}
            note={home.surveyor_note ?? ""}
          />
        </section>

        <DetailsToggle>
          <div className="space-y-6 pb-6">
            <HomeInfo home={home} />
            <KeyFacts home={home} photos={photos} />
            <Reasons home={home} hasPhotos={photos.length > 0} />
            <SiteCoverageCard home={home} latest={latest} urls={urls} />
            {home.property && <LocationCard property={home.property} />}

            <section>
              <h2 className="ui-subtitle">Photos</h2>
              {stepOrder.length === 0 && <p className="mt-2 text-muted">No steps yet.</p>}
              <div className="mt-3 grid gap-4 sm:grid-cols-2">
                {stepOrder.map((stepId) => {
                  const photo = latest.get(stepId);
                  const history = photos.filter((p) => p.step === stepId && p.id !== photo?.id).reverse();
                  const status = photo?.status ?? "pending";
                  const url = photo ? urls[photo.storage_path] : undefined;
                  return (
                    <article
                      key={stepId}
                      id={photoAnchor(stepId)}
                      className="ui-card ui-card-flush scroll-mt-6 target:ring-2 target:ring-accent"
                    >
                      <div className="relative aspect-[4/3] bg-page">
                        {url ? (
                          <PhotoZoom src={url} alt={stepTitle(stepId)} className="h-full w-full" />
                        ) : (
                          <div className="flex h-full items-center justify-center text-sm text-muted">No photo</div>
                        )}
                      </div>
                      <div className="space-y-3 p-4">
                        <div className="flex items-start justify-between gap-2">
                          <h3 className="ui-label">{stepTitle(stepId)}</h3>
                          <span className={`shrink-0 ${BADGE_CLASS[STATUS_TONES[status]]}`}>{PHOTO_STATUS_LABELS[status]}</span>
                        </div>
                        {isExtraStepId(stepId) && (
                          <p className="text-sm text-muted">{getStep(stepId, home.extra_steps)?.instruction}</p>
                        )}
                        {!planned.includes(stepId) && (
                          <p className="text-xs text-muted">No longer required for this setup.</p>
                        )}
                        {photo && (
                          <>
                            <Readout photo={photo} home={home} reasons={reasons} />
                            <PhotoMeta photo={photo} />
                          </>
                        )}
                        {history.length > 0 && (
                          <details className="rounded-brand bg-page px-3 py-2">
                            <summary className="cursor-pointer text-sm font-medium text-ink">
                              Previous attempts ({history.length})
                            </summary>
                            <ul className="mt-3 space-y-3">
                              {history.map((p) => (
                                <li key={p.id} className="flex gap-3">
                                  {urls[p.storage_path] && (
                                    <PhotoZoom
                                      src={urls[p.storage_path]}
                                      alt={`${stepTitle(stepId)}, attempt ${p.attempt}`}
                                      className="h-16 w-16 shrink-0 overflow-hidden rounded-md"
                                    />
                                  )}
                                  <div className="min-w-0 text-sm">
                                    <p className="font-medium text-ink">{PHOTO_STATUS_LABELS[p.status]}</p>
                                    {p.analysis?.retake_instruction && (
                                      <p className="text-muted">&ldquo;{p.analysis.retake_instruction}&rdquo;</p>
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
            </section>
          </div>
        </DetailsToggle>
      </main>
      <Footer />
    </>
  );
}
