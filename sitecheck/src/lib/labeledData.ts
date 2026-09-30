import { applyCorrections, editableFields, latestCorrections, type CorrectionInput } from "./corrections";
import { latestPhotoByStep } from "./plan";
import type { AnalysisField, PhotoAnalysis } from "./schema";
import type { HomeRow, Outcome, PhotoRow, SurveyorDecision } from "./types";

export type LabelHome = Pick<HomeRow, "id" | "surveyor_decision" | "verdict">;
export type LabelPhoto = Pick<PhotoRow, "id" | "home_id" | "step" | "attempt" | "storage_path" | "status" | "analysis">;

export type LabelEntry = {
  photoId: string;
  homeId: string;
  step: string;
  storagePath: string;
  aiAnalysis: PhotoAnalysis | null;
  /** The editable readings after surveyor corrections. */
  finalValues: Partial<Record<AnalysisField, unknown>>;
  correctedFields: AnalysisField[];
  surveyorDecision: SurveyorDecision;
  verdict: Outcome | null;
};

type Latest = { home: LabelHome & { surveyor_decision: SurveyorDecision }; photo: LabelPhoto; fields: AnalysisField[] };

/** The latest photo of every step of every decided home, with the readings a surveyor can correct on it. */
function latestOfDecided(homes: LabelHome[], photos: LabelPhoto[]): Latest[] {
  const byHome = new Map<string, LabelPhoto[]>();
  for (const p of photos) byHome.set(p.home_id, [...(byHome.get(p.home_id) ?? []), p]);
  return homes.flatMap((home) => {
    if (!home.surveyor_decision) return [];
    const decided = home as Latest["home"];
    return [...latestPhotoByStep(byHome.get(home.id) ?? []).values()].map((photo) => ({
      home: decided,
      photo,
      fields: photo.analysis ? editableFields(photo.step).filter((f) => photo.analysis![f] !== undefined) : [],
    }));
  });
}

/** M: editable readings on the latest photos of decided homes. N: how many of them a surveyor corrected. */
export function correctionStats(
  homes: LabelHome[],
  photos: LabelPhoto[],
  corrections: CorrectionInput[],
): { corrected: number; total: number } {
  const fixes = latestCorrections(corrections);
  let corrected = 0;
  let total = 0;
  for (const { photo, fields } of latestOfDecided(homes, photos)) {
    total += fields.length;
    corrected += fields.filter((f) => fixes.get(photo.id)?.has(f)).length;
  }
  return { corrected, total };
}

/** One entry per latest photo of each decided home. Carries no names or emails. */
export function labelEntries(homes: LabelHome[], photos: LabelPhoto[], corrections: CorrectionInput[]): LabelEntry[] {
  const fixes = latestCorrections(corrections);
  return latestOfDecided(homes, photos).map(({ home, photo, fields }) => {
    const [final] = applyCorrections([photo], corrections);
    return {
      photoId: photo.id,
      homeId: home.id,
      step: photo.step,
      storagePath: photo.storage_path,
      aiAnalysis: photo.analysis,
      finalValues: Object.fromEntries(fields.map((f) => [f, final.analysis?.[f]])),
      correctedFields: fields.filter((f) => fixes.get(photo.id)?.has(f)),
      surveyorDecision: home.surveyor_decision,
      verdict: home.verdict,
    };
  });
}
