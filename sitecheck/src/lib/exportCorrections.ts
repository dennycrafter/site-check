import { applyCorrections, editableFields, latestCorrections, type CorrectionInput } from "./corrections";
import type { AnalysisField, PhotoAnalysis } from "./schema";
import type { PhotoStatus } from "./types";

type ExportPhoto = { id: string; step: string; status: PhotoStatus; analysis: PhotoAnalysis | null };

export type CorrectedExportPhoto<T extends ExportPhoto> = {
  /** The photo with surveyor corrections applied: corrected analysis, and accepted if it was kept for review. */
  photo: T;
  /** What the AI read, unchanged. */
  aiAnalysis: PhotoAnalysis | null;
  /** The editable readings the surveyor changed. Empty if none. */
  correctedFields: AnalysisField[];
};

/** Applies surveyor corrections to photos for the home export, keeping the AI reading and the corrected field names. */
export function correctPhotosForExport<T extends ExportPhoto>(
  photos: T[],
  corrections: CorrectionInput[],
): CorrectedExportPhoto<T>[] {
  const fixes = latestCorrections(corrections);
  const corrected = applyCorrections(photos, corrections);
  return photos.map((ai, i) => ({
    photo: corrected[i],
    aiAnalysis: ai.analysis,
    correctedFields: ai.analysis
      ? editableFields(ai.step).filter((f) => ai.analysis![f] !== undefined && fixes.get(ai.id)?.has(f))
      : [],
  }));
}
