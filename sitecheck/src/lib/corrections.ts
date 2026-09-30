import { z } from "zod";
import { PHOTO_ANALYSIS_SCHEMA, PhotoAnalysisZod, type AnalysisField, type PhotoAnalysis } from "./schema";
import { getStep, isExtraStepId, isStepId, type StepId } from "./steps";

/**
 * The analysis fields rules.ts reads from each step's photo. Keep in sync with rules.ts.
 * Only fields that are also shown for the step (its `fields` list) are editable.
 */
const RULES_READS: Record<StepId | "extra", AnalysisField[]> = {
  meter_area_wide: [
    "meter_count",
    "multiple_panels_visible",
    "gas_meter_near",
    "window_near",
    "ac_unit_near",
    "clear_ground_space",
  ],
  meter_closeup: ["meter_count", "multiple_panels_visible", "damage_visible"],
  left_of_meter: ["multiple_panels_visible", "clear_ground_space"],
  right_of_meter: ["multiple_panels_visible", "clear_ground_space"],
  adjacent_wall: ["multiple_panels_visible", "clear_ground_space"],
  behind_fence: ["multiple_panels_visible", "clear_ground_space"],
  panel_wide: ["location", "multiple_panels_visible", "damage_visible", "heavy_rust"],
  panel_open: ["panel_brand", "panel_label_legible", "multiple_panels_visible", "damage_visible", "heavy_rust"],
  main_disconnect_closeup: ["amp_rating", "amp_rating_legible", "multiple_panels_visible", "damage_visible", "heavy_rust"],
  extra: ["multiple_panels_visible", "clear_ground_space"],
};

/** Readings a surveyor can correct on a step's photo, in the order the step shows them. */
export function editableFields(step: string): AnalysisField[] {
  const reads = isStepId(step) ? RULES_READS[step] : isExtraStepId(step) ? RULES_READS.extra : [];
  const shown = getStep(step, isExtraStepId(step) ? [{ id: step, instruction: "" }] : [])?.fields ?? [];
  return shown.filter((f) => reads.includes(f));
}

export function isAnalysisField(value: string): value is AnalysisField {
  return Object.hasOwn(PhotoAnalysisZod.shape, value);
}

export type FieldKind = "boolean" | "choice" | "number";

export function fieldKind(field: AnalysisField): FieldKind {
  const prop = PHOTO_ANALYSIS_SCHEMA.properties[field];
  if (prop.type === "boolean") return "boolean";
  if ("enum" in prop) return "choice";
  return "number";
}

/** The allowed values of a choice field. Empty for other fields. */
export function fieldOptions(field: AnalysisField): readonly string[] {
  const prop = PHOTO_ANALYSIS_SCHEMA.properties[field];
  return "enum" in prop ? prop.enum : [];
}

const NUMBER_LIMITS: Partial<Record<AnalysisField, number>> = { amp_rating: 1000, meter_count: 20 };

/** The schema type of the field, with whole, non-negative numbers only. */
export function correctionValueZod(field: AnalysisField): z.ZodType<PhotoAnalysis[AnalysisField]> {
  if (fieldKind(field) === "number") return z.number().int().min(0).max(NUMBER_LIMITS[field] ?? 1000);
  return PhotoAnalysisZod.shape[field] as z.ZodType<PhotoAnalysis[AnalysisField]>;
}

export const CorrectionBodyZod = z.object({
  photoId: z.uuid(),
  field: z.string().refine(isAnalysisField),
  value: z.unknown(),
});

export type CorrectionInput = {
  photo_id: string;
  field: string;
  corrected_value: unknown;
  created_at: string;
};

export type CorrectionRow = CorrectionInput & {
  id: string;
  home_id: string;
  step: string;
  ai_value: unknown;
};

const time = (iso: string) => new Date(iso).getTime() || 0;

/** Latest correction per photo and field. On equal times the later array item wins. */
export function latestCorrections<C extends CorrectionInput>(corrections: C[]): Map<string, Map<AnalysisField, C>> {
  const out = new Map<string, Map<AnalysisField, C>>();
  for (const c of corrections) {
    if (!isAnalysisField(c.field)) continue;
    let fields = out.get(c.photo_id);
    if (!fields) out.set(c.photo_id, (fields = new Map()));
    const current = fields.get(c.field);
    if (!current || time(c.created_at) >= time(current.created_at)) fields.set(c.field, c);
  }
  return out;
}

/**
 * The photos with the latest correction per photo and field applied. A corrected photo gets
 * confidence 100: a person confirmed it, so the low-confidence downgrade no longer applies.
 * Photos without an analysis are returned as they are. Inputs are not changed.
 */
export function applyCorrections<T extends { id: string; analysis: PhotoAnalysis | null }>(
  photos: T[],
  corrections: CorrectionInput[],
): T[] {
  const latest = latestCorrections(corrections);
  return photos.map((photo) => {
    const fields = latest.get(photo.id);
    if (!photo.analysis || !fields) return photo;
    const analysis: Record<string, unknown> = { ...photo.analysis };
    for (const [field, c] of fields) analysis[field] = c.corrected_value;
    analysis.confidence = 100;
    return { ...photo, analysis: analysis as PhotoAnalysis };
  });
}
