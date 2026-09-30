import "server-only";
import {
  deriveSetupType,
  latestFinishedByStep,
  latestPhotoByStep,
  photosFingerprint,
  planSteps,
} from "./plan";
import { applyCorrections, type CorrectionRow } from "./corrections";
import type { LabelHome, LabelPhoto } from "./labeledData";
import { evaluate, type RulesPhoto } from "./rules";
import { sawLine } from "./sawLine";
import { getStep, stepTitle } from "./steps";
import { getSupabase, signedUrls } from "./supabase";
import type { HomeRow, PhotoRow, PhotoStatus } from "./types";

export async function loadHome(homeId: string): Promise<{ home: HomeRow; photos: PhotoRow[] } | null> {
  const supabase = getSupabase();
  const [homeRes, photosRes] = await Promise.all([
    supabase.from("homes").select("*").eq("id", homeId).maybeSingle(),
    supabase
      .from("photos")
      .select("*")
      .eq("home_id", homeId)
      .order("step")
      .order("attempt", { ascending: true }),
  ]);
  if (homeRes.error) throw new Error(`Load home failed: ${homeRes.error.message}`);
  if (photosRes.error) throw new Error(`Load photos failed: ${photosRes.error.message}`);
  if (!homeRes.data) return null;
  return { home: homeRes.data as HomeRow, photos: (photosRes.data ?? []) as PhotoRow[] };
}

export function rulesPhotos(photos: PhotoRow[]): RulesPhoto[] {
  return [...latestFinishedByStep(photos).values()].map((p) => ({
    step: p.step,
    status: p.status as RulesPhoto["status"],
    analysis: p.analysis,
  }));
}

/** PostgREST and Postgres codes for a table that does not exist (migration-v5.sql not run yet). */
const MISSING_TABLE_CODES = ["PGRST205", "42P01"];

export function isMissingTable(error: { code?: string } | null | undefined): boolean {
  return !!error?.code && MISSING_TABLE_CODES.includes(error.code);
}

let warnedMissingCorrections = false;
const ID_CHUNK = 100;

/** Corrections for these homes, oldest first. Empty when the corrections table does not exist yet. */
export async function loadCorrections(homeIds: string[], columns = "*"): Promise<CorrectionRow[]> {
  const out: CorrectionRow[] = [];
  for (let i = 0; i < homeIds.length; i += ID_CHUNK) {
    const { data, error } = await getSupabase()
      .from("corrections")
      .select(columns)
      .in("home_id", homeIds.slice(i, i + ID_CHUNK))
      .order("created_at", { ascending: true });
    if (isMissingTable(error)) {
      if (!warnedMissingCorrections) console.warn("[corrections] table missing, run supabase/migration-v5.sql");
      warnedMissingCorrections = true;
      return [];
    }
    if (error) throw new Error(`Load corrections failed: ${error.message}`);
    out.push(...((data ?? []) as unknown as CorrectionRow[]));
  }
  return out;
}

/**
 * Photos and corrections of the decided homes, for the labeled data stat and export. Pass the homes
 * when they are already loaded; otherwise every decided home is read.
 */
export async function loadLabeledData(homes?: LabelHome[]): Promise<{
  homes: LabelHome[];
  photos: LabelPhoto[];
  corrections: CorrectionRow[];
}> {
  const supabase = getSupabase();
  let decided = homes?.filter((h) => h.surveyor_decision);
  if (!decided) {
    const { data, error } = await supabase
      .from("homes")
      .select("id, surveyor_decision, verdict")
      .not("surveyor_decision", "is", null)
      .order("created_at", { ascending: true });
    if (error) throw new Error(`Load homes failed: ${error.message}`);
    decided = (data ?? []) as LabelHome[];
  }
  const ids = decided.map((h) => h.id);
  const photos: LabelPhoto[] = [];
  for (let i = 0; i < ids.length; i += ID_CHUNK) {
    const { data, error } = await supabase
      .from("photos")
      .select("id, home_id, step, attempt, storage_path, status, analysis")
      .in("home_id", ids.slice(i, i + ID_CHUNK))
      .order("attempt", { ascending: true });
    if (error) throw new Error(`Load photos failed: ${error.message}`);
    photos.push(...((data ?? []) as LabelPhoto[]));
  }
  return { homes: decided, photos, corrections: await loadCorrections(ids) };
}

const MAX_RECOMPUTE_PASSES = 3;

type Recomputed = { home: HomeRow; photos: PhotoRow[]; correctionIds: string[] };

/**
 * Re-derives setup type and re-runs the rules engine on photos and surveyor corrections read fresh
 * from the database, then saves both on the home. Several photo checks (or corrections) can finish at
 * once and each recomputes, so after saving it reads the rows again: if another request changed them
 * in between, this save may be stale and the pass runs again.
 */
export async function recomputeHome(
  homeId: string,
  extra: Partial<HomeRow> = {},
): Promise<{ home: HomeRow; photos: PhotoRow[] }> {
  let saved = await recomputeOnce(homeId, extra);
  for (let pass = 1; pass < MAX_RECOMPUTE_PASSES; pass++) {
    const [photosRes, corrections] = await Promise.all([
      getSupabase().from("photos").select("id, status").eq("home_id", homeId),
      loadCorrections([homeId], "id"),
    ]);
    if (photosRes.error) throw new Error(`Load photos failed: ${photosRes.error.message}`);
    const same =
      photosFingerprint(photosRes.data ?? []) === photosFingerprint(saved.photos) &&
      corrections.map((c) => c.id).join(",") === saved.correctionIds.join(",");
    if (same) break;
    console.log(`[recompute] home=${homeId} photos or corrections changed during pass ${pass}, recomputing`);
    saved = await recomputeOnce(homeId, extra);
  }
  return { home: saved.home, photos: saved.photos };
}

async function recomputeOnce(homeId: string, extra: Partial<HomeRow>): Promise<Recomputed> {
  const [loaded, corrections] = await Promise.all([loadHome(homeId), loadCorrections([homeId])]);
  if (!loaded) throw new Error(`Home ${homeId} not found`);
  const { home, photos } = loaded;
  const corrected = applyCorrections(photos, corrections);
  const setupType = deriveSetupType(corrected);
  const result = evaluate({
    inAustin: home.in_austin,
    hasSolar: home.has_solar,
    panelSameWallAnswer: home.panel_same_wall_answer,
    setupType,
    siteCheckStatus: home.site_check_status,
    extraSteps: home.extra_steps,
    photos: rulesPhotos(corrected),
  });
  const update = {
    setup_type: setupType,
    verdict: result.verdict,
    battery_count: result.batteryCount,
    reasons: result.reasons,
    ...extra,
  };
  const { data, error } = await getSupabase()
    .from("homes")
    .update(update)
    .eq("id", homeId)
    .select("*")
    .single();
  if (error) throw new Error(`Save verdict failed: ${error.message}`);
  return { home: data as HomeRow, photos, correctionIds: corrections.map((c) => c.id) };
}

export type StepView = {
  id: string;
  title: string;
  status: PhotoStatus | "pending";
  attempts: number;
  thumbnailUrl: string | null;
  /** The "what we saw" line of an accepted photo. */
  saw?: string;
};

export async function buildStepViews(home: HomeRow, photos: PhotoRow[]): Promise<StepView[]> {
  const latest = latestPhotoByStep(photos);
  const steps = planSteps(home, photos);
  const urls = await signedUrls(steps.map((id) => latest.get(id)?.storage_path ?? ""));
  return steps.map((id) => {
    const photo = latest.get(id);
    return {
      id,
      title: getStep(id, home.extra_steps)?.title ?? stepTitle(id),
      status: photo?.status ?? "pending",
      attempts: photos.filter((p) => p.step === id).length,
      thumbnailUrl: photo ? (urls[photo.storage_path] ?? null) : null,
      ...(photo?.status === "accepted" ? { saw: sawLine(id, photo.analysis) } : {}),
    };
  });
}

export function homeLabel(home: Pick<HomeRow, "address" | "customer_name">): string {
  return home.address || home.customer_name || "Address not given";
}

/** The homeowner-facing subset of a home. The verdict is for surveyors only. */
export function publicHome(home: HomeRow) {
  return {
    id: home.id,
    address: home.address,
    setup_type: home.setup_type,
    panel_same_wall_answer: home.panel_same_wall_answer,
    status: home.status,
    submitted_at: home.submitted_at,
    site_check_status: home.site_check_status,
    extra_steps: home.extra_steps.map((e) => ({ id: e.id, instruction: e.instruction })),
    property: home.property ?? null,
  };
}
