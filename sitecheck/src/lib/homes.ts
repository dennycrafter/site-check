import "server-only";
import {
  deriveSetupType,
  latestFinishedByStep,
  latestPhotoByStep,
  photosFingerprint,
  planSteps,
} from "./plan";
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

const MAX_RECOMPUTE_PASSES = 3;

/**
 * Re-derives setup type and re-runs the rules engine on photos read fresh from the database, then
 * saves both on the home. Several photo checks can finish at once and each recomputes, so after
 * saving it reads the photo rows again: if another request changed them in between, this save may
 * be stale and the pass runs again.
 */
export async function recomputeHome(
  homeId: string,
  extra: Partial<HomeRow> = {},
): Promise<{ home: HomeRow; photos: PhotoRow[] }> {
  let saved = await recomputeOnce(homeId, extra);
  for (let pass = 1; pass < MAX_RECOMPUTE_PASSES; pass++) {
    const { data, error } = await getSupabase().from("photos").select("id, status").eq("home_id", homeId);
    if (error) throw new Error(`Load photos failed: ${error.message}`);
    if (photosFingerprint(data ?? []) === photosFingerprint(saved.photos)) break;
    console.log(`[recompute] home=${homeId} photos changed during pass ${pass}, recomputing`);
    saved = await recomputeOnce(homeId, extra);
  }
  return saved;
}

async function recomputeOnce(homeId: string, extra: Partial<HomeRow>): Promise<{ home: HomeRow; photos: PhotoRow[] }> {
  const loaded = await loadHome(homeId);
  if (!loaded) throw new Error(`Home ${homeId} not found`);
  const { home, photos } = loaded;
  const setupType = deriveSetupType(photos);
  const result = evaluate({
    inAustin: home.in_austin,
    hasSolar: home.has_solar,
    panelSameWallAnswer: home.panel_same_wall_answer,
    setupType,
    siteCheckStatus: home.site_check_status,
    extraSteps: home.extra_steps,
    photos: rulesPhotos(photos),
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
  return { home: data as HomeRow, photos };
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
