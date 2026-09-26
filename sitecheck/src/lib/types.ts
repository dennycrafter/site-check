import type { PhotoAnalysis } from "./schema";

export type SetupType =
  | "separate_meter_and_panel_outdoors"
  | "combo_meter_main_unit"
  | "panel_indoors"
  | "unknown";

export type PanelSameWallAnswer = "yes" | "no" | "not_sure" | "not_asked";

export type PhotoStatus = "accepted" | "retake" | "check_failed" | "accepted_after_max_attempts";
export type FinishedPhotoStatus = Exclude<PhotoStatus, "retake">;

export type Outcome = "PASS" | "FAIL" | "REVIEW";
export type Reason = { code: string; outcome: Outcome; message: string; step: string | null };

export type SurveyorDecision = "approved" | "rejected" | "needs_site_visit";

export type HomeRow = {
  id: string;
  created_at: string;
  address: string | null;
  customer_name: string | null;
  customer_email: string | null;
  /** null means not asked yet. */
  in_austin: boolean | null;
  has_solar: boolean | null;
  panel_same_wall_answer: PanelSameWallAnswer;
  setup_type: SetupType;
  status: "in_progress" | "submitted";
  verdict: Outcome | null;
  battery_count: number | null;
  reasons: Reason[];
  surveyor_decision: SurveyorDecision | null;
  surveyor_note: string | null;
  submitted_at: string | null;
};

export type PhotoRow = {
  id: string;
  created_at: string;
  home_id: string;
  step: string;
  attempt: number;
  storage_path: string;
  status: PhotoStatus;
  analysis: PhotoAnalysis | null;
  error: string | null;
  model: string | null;
  latency_ms: number | null;
  ai_attempts: number;
};
