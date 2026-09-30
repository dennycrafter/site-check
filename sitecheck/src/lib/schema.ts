import { z } from "zod";

export const RETAKE_REASONS = [
  "none",
  "too_dark",
  "blurry",
  "too_close",
  "too_far",
  "wrong_subject",
  "lid_closed",
  "view_blocked",
  "text_unreadable",
] as const;

export const AI_SETUP_TYPES = [
  "separate_meter_and_panel_outdoors",
  "combo_meter_main_unit",
  "panel_not_visible",
  "unknown",
] as const;

export const LOCATIONS = ["outdoor", "garage", "closet", "indoor_other", "unknown"] as const;

export const GROUND_SPACE = ["none", "room_for_one", "room_for_two", "unclear"] as const;

export const PANEL_BRANDS = [
  "federal_pacific",
  "zinsco",
  "challenger",
  "sylvania",
  "westinghouse",
  "other",
  "not_visible",
] as const;

export const PHOTO_ANALYSIS_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: [
    "photo_matches_request",
    "usable",
    "retake_reason",
    "retake_instruction",
    "confidence",
    "setup_type",
    "amp_rating",
    "amp_rating_legible",
    "meter_number_legible",
    "meter_in_locked_cabinet",
    "location",
    "damage_visible",
    "gas_meter_near",
    "window_near",
    "ac_unit_near",
    "fence_present",
    "clutter_blocking",
    "clear_ground_space",
    "multiple_panels_visible",
    "meter_count",
    "meter_can_edges_visible",
    "ground_visible",
    "enough_wall_shown",
    "panel_context_visible",
    "panel_brand",
    "panel_label_legible",
    "heavy_rust",
    "notes",
  ],
  properties: {
    photo_matches_request: { type: "boolean" },
    usable: { type: "boolean" },
    retake_reason: { type: "string", enum: [...RETAKE_REASONS] },
    retake_instruction: { type: "string" },
    confidence: { type: "integer" },
    setup_type: { type: "string", enum: [...AI_SETUP_TYPES] },
    amp_rating: { type: "integer" },
    amp_rating_legible: { type: "boolean" },
    meter_number_legible: { type: "boolean" },
    meter_in_locked_cabinet: { type: "boolean" },
    location: { type: "string", enum: [...LOCATIONS] },
    damage_visible: { type: "boolean" },
    gas_meter_near: { type: "boolean" },
    window_near: { type: "boolean" },
    ac_unit_near: { type: "boolean" },
    fence_present: { type: "boolean" },
    clutter_blocking: { type: "boolean" },
    clear_ground_space: { type: "string", enum: [...GROUND_SPACE] },
    multiple_panels_visible: { type: "boolean" },
    meter_count: { type: "integer" },
    meter_can_edges_visible: { type: "boolean" },
    ground_visible: { type: "boolean" },
    enough_wall_shown: { type: "boolean" },
    panel_context_visible: { type: "boolean" },
    panel_brand: { type: "string", enum: [...PANEL_BRANDS] },
    panel_label_legible: { type: "boolean" },
    heavy_rust: { type: "boolean" },
    notes: { type: "string" },
  },
} as const;

export const PhotoAnalysisZod = z.object({
  photo_matches_request: z.boolean(),
  usable: z.boolean(),
  retake_reason: z.enum(RETAKE_REASONS),
  retake_instruction: z.string(),
  confidence: z.number(),
  setup_type: z.enum(AI_SETUP_TYPES),
  amp_rating: z.number(),
  amp_rating_legible: z.boolean(),
  meter_number_legible: z.boolean(),
  /** Added later: analyses saved before it existed read as false. */
  meter_in_locked_cabinet: z.boolean().default(false),
  location: z.enum(LOCATIONS),
  damage_visible: z.boolean(),
  gas_meter_near: z.boolean(),
  window_near: z.boolean(),
  ac_unit_near: z.boolean(),
  fence_present: z.boolean(),
  clutter_blocking: z.boolean(),
  clear_ground_space: z.enum(GROUND_SPACE),
  multiple_panels_visible: z.boolean(),
  meter_count: z.number(),
  meter_can_edges_visible: z.boolean(),
  ground_visible: z.boolean(),
  enough_wall_shown: z.boolean(),
  panel_context_visible: z.boolean(),
  panel_brand: z.enum(PANEL_BRANDS),
  panel_label_legible: z.boolean(),
  heavy_rust: z.boolean(),
  notes: z.string(),
});

export type PhotoAnalysis = z.infer<typeof PhotoAnalysisZod>;
export type AnalysisField = keyof PhotoAnalysis;

const ENUM_FIELDS = ["retake_reason", "setup_type", "location", "clear_ground_space", "panel_brand"] as const;

/**
 * JSON.parse, then lowercase enum fields (model casing is not guaranteed),
 * then validate, then clamp confidence. Throws on any failure.
 */
export function parseAnalysisText(text: string): PhotoAnalysis {
  const raw: unknown = JSON.parse(text);
  if (raw && typeof raw === "object") {
    const obj = raw as Record<string, unknown>;
    for (const field of ENUM_FIELDS) {
      if (typeof obj[field] === "string") obj[field] = (obj[field] as string).trim().toLowerCase();
    }
  }
  const parsed = PhotoAnalysisZod.parse(raw);
  return {
    ...parsed,
    confidence: Math.min(100, Math.max(0, Math.round(parsed.confidence))),
    amp_rating: Math.round(parsed.amp_rating),
    meter_count: Math.max(0, Math.round(parsed.meter_count)),
  };
}
