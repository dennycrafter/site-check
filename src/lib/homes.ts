import "server-only";
import {
  deriveSetupType,
  latestFinishedByStep,
  latestPhotoByStep,
  planSteps,
} from "./plan";
import { evaluate, type RulesPhoto } from "./rules";
import { STEP_BY_ID, type StepId } from "./steps";
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

/** Re-derives setup type and re-runs the rules engine, then saves both on the home. */
export async function recomputeHome(
  homeId: string,
  extra: Partial<HomeRow> = {},
): Promise<{ home: HomeRow; photos: PhotoRow[] }> {
  const loaded = await loadHome(homeId);
  if (!loaded) throw new Error(`Home ${homeId} not found`);
  const { home, photos } = loaded;
  const setupType = deriveSetupType(photos);
  const result = evaluate({
    inAustin: home.in_austin,
    hasSolar: home.has_solar,
    panelSameWallAnswer: home.panel_same_wall_answer,
    setupType,
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
  id: StepId;
  title: string;
  status: PhotoStatus | "pending";
  attempts: number;
  thumbnailUrl: string | null;
};

export async function buildStepViews(home: HomeRow, photos: PhotoRow[]): Promise<StepView[]> {
  const latest = latestPhotoByStep(photos);
  const steps = planSteps(home, photos);
  const urls = await signedUrls(steps.map((id) => latest.get(id)?.storage_path ?? ""));
  return steps.map((id) => {
    const photo = latest.get(id);
    return {
      id,
      title: STEP_BY_ID[id].title,
      status: photo?.status ?? "pending",
      attempts: photos.filter((p) => p.step === id).length,
      thumbnailUrl: photo ? (urls[photo.storage_path] ?? null) : null,
    };
  });
}

/** The homeowner-facing subset of a home. The verdict is for surveyors only. */
export function publicHome(home: HomeRow) {
  return {
    id: home.id,
    customer_name: home.customer_name,
    in_austin: home.in_austin,
    has_solar: home.has_solar,
    setup_type: home.setup_type,
    panel_same_wall_answer: home.panel_same_wall_answer,
    status: home.status,
    submitted_at: home.submitted_at,
  };
}
