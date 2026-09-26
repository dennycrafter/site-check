import { latestPhotoByStep, planSteps } from "./plan";
import type { PhotoAnalysis } from "./schema";
import { isExtraStepId, SPACE_STEPS, stepTitle } from "./steps";
import type {
  ExtraStep,
  FinishedPhotoStatus,
  Outcome,
  PanelSameWallAnswer,
  Reason,
  SetupType,
  SiteCheckStatus,
} from "./types";

export const CONFIDENCE_MIN = 80;
export const AMP_MIN_AUSTIN = 150; // keep unless the team says otherwise
export const AMP_MIN_ELSEWHERE = 100;
export const AMP_FOR_TWO_NO_SOLAR = 150;
export const AMP_FOR_TWO_WITH_SOLAR = 200;
export const AMP_MAX_KNOWN_RULES = 200;

export type RulesPhoto = {
  step: string;
  status: FinishedPhotoStatus;
  analysis: PhotoAnalysis | null;
};

export type RulesInput = {
  /** null means not asked yet; rules that depend on it go to REVIEW. */
  inAustin: boolean | null;
  hasSolar: boolean | null;
  panelSameWallAnswer: PanelSameWallAnswer;
  setupType: SetupType;
  siteCheckStatus: SiteCheckStatus;
  extraSteps?: Pick<ExtraStep, "id">[];
  photos: RulesPhoto[];
};

export type RulesResult = { verdict: Outcome; batteryCount: 0 | 1 | 2; reasons: Reason[] };

const OUTCOME_ORDER: Record<Outcome, number> = { FAIL: 0, REVIEW: 1, PASS: 2 };
const SPACE_RANK = { none: 0, room_for_one: 1, room_for_two: 2 } as const;
const RECALLED_BRANDS: Partial<Record<string, string>> = {
  federal_pacific: "Federal Pacific",
  zinsco: "Zinsco",
  challenger: "Challenger",
  sylvania: "Sylvania",
};

function batteries(n: number): string {
  return n === 1 ? "1 battery" : `${n} batteries`;
}

export function evaluate(input: RulesInput): RulesResult {
  const reasons: Reason[] = [];
  const add = (code: string, outcome: Outcome, message: string, step: string | null) =>
    reasons.push({ code, outcome, message, step });

  /** G4: a FAIL backed by a low-confidence photo becomes REVIEW. Returns the outcome used. */
  const failUnlessUnsure = (
    code: string,
    message: string,
    confidence: number,
    step: string | null,
  ): Outcome => {
    if (confidence < CONFIDENCE_MIN) {
      add(code, "REVIEW", `${message} (low confidence)`, step);
      return "REVIEW";
    }
    add(code, "FAIL", message, step);
    return "FAIL";
  };

  const byStep = latestPhotoByStep(input.photos);
  const accepted = new Map<string, PhotoAnalysis>();
  for (const [step, photo] of byStep) {
    if (photo.status === "accepted" && photo.analysis) accepted.set(step, photo.analysis);
  }

  // Global rules over the steps that apply to this home.
  const required = planSteps(
    {
      setup_type: input.setupType,
      panel_same_wall_answer: input.panelSameWallAnswer,
      extra_steps: input.extraSteps ?? [],
    },
    input.photos,
  );
  for (const step of required) {
    const photo = byStep.get(step);
    const title = stepTitle(step);
    if (!photo) {
      add("STEP_MISSING", "REVIEW", `Missing photo: ${title}.`, step);
    } else if (photo.status === "accepted_after_max_attempts") {
      add("STEP_UNCLEAR", "REVIEW", `The ${title} photo was flagged for a retake and kept for review.`, step);
    } else if (photo.status === "check_failed" || !photo.analysis) {
      add("CHECK_FAILED", "REVIEW", `Automatic check failed for ${title}. Needs manual review.`, step);
    }
  }

  if (input.siteCheckStatus === "failed") {
    add("SITE_CHECK_FAILED", "REVIEW", "Whole-site check could not run. Check photo coverage manually.", null);
  }

  // Amp rules. null means unknown (counts as 1 for a provisional REVIEW count).
  let ampMaxBatteries: number | null = null;
  const amp = accepted.get("main_disconnect_closeup");
  if (amp) {
    const step = "main_disconnect_closeup";
    const x = amp.amp_rating;
    if (!amp.amp_rating_legible || x <= 0) {
      add("AMP_UNREADABLE", "REVIEW", "Could not read the main breaker amp rating.", step);
    } else {
      // Unknown location: only the lowest minimum can FAIL; the Austin gap goes to a human.
      const min = input.inAustin ? AMP_MIN_AUSTIN : AMP_MIN_ELSEWHERE;
      const outcomes: Outcome[] = [];
      if (x < min) {
        outcomes.push(
          failUnlessUnsure("AMP_TOO_LOW", `Main breaker is ${x}A. Minimum here is ${min}A.`, amp.confidence, step),
        );
      } else if (input.inAustin === null && x < AMP_MIN_AUSTIN) {
        outcomes.push("REVIEW");
        add(
          "AMP_LOCATION_UNKNOWN",
          "REVIEW",
          `Main breaker is ${x}A. Austin homes need ${AMP_MIN_AUSTIN}A. Confirm whether the home is in Austin.`,
          step,
        );
      }
      // Solar only changes the count between these two thresholds.
      if (input.hasSolar === null && x >= AMP_FOR_TWO_NO_SOLAR && x < AMP_FOR_TWO_WITH_SOLAR) {
        outcomes.push("REVIEW");
        add(
          "SOLAR_UNKNOWN",
          "REVIEW",
          `Main breaker is ${x}A. Solar homes need 200A for 2 batteries. Confirm whether the home has solar.`,
          step,
        );
      }
      if (x > AMP_MAX_KNOWN_RULES) {
        add(
          "AMP_ABOVE_200",
          "REVIEW",
          `Service is ${x}A, above the published 100-200A range. Check with engineering.`,
          step,
        );
      } else if (outcomes.length === 0) {
        ampMaxBatteries = input.hasSolar ? (x >= AMP_FOR_TWO_WITH_SOLAR ? 2 : 1) : x >= AMP_FOR_TWO_NO_SOLAR ? 2 : 1;
        add("AMP_OK", "PASS", `Main breaker ${x}A supports up to ${batteries(ampMaxBatteries)}.`, step);
        if (input.hasSolar && x < AMP_FOR_TWO_WITH_SOLAR) {
          add(
            "SOLAR_LIMITS_TO_ONE",
            "PASS",
            `Solar homes need 200A for 2 batteries. This one is ${x}A, so 1 battery.`,
            step,
          );
        }
      } else if (outcomes.includes("FAIL")) {
        ampMaxBatteries = 0;
      }
    }
  }

  // Setup and layout rules.
  if (input.setupType === "unknown") {
    add("SETUP_UNCLEAR", "REVIEW", "Could not tell the meter and breaker box setup from the photos.", null);
  }

  const panel = accepted.get("panel_wide");
  if (panel && (panel.location === "closet" || panel.location === "indoor_other")) {
    failUnlessUnsure(
      "PANEL_IN_LIVING_SPACE",
      "Breaker box is inside the living space. It must be outdoors or in a garage.",
      panel.confidence,
      "panel_wide",
    );
  }

  if (input.setupType === "panel_indoors") {
    if (input.panelSameWallAnswer === "no") {
      add(
        "PANEL_NOT_SAME_WALL",
        "REVIEW",
        "Homeowner says the breaker box is not behind the meter wall. Needs review.",
        null,
      );
    } else if (input.panelSameWallAnswer === "not_sure") {
      add(
        "PANEL_WALL_UNSURE",
        "REVIEW",
        "Homeowner is not sure if the breaker box is on the same wall as the meter.",
        null,
      );
    } else if (input.panelSameWallAnswer === "not_asked") {
      add(
        "PANEL_WALL_UNSURE",
        "REVIEW",
        "Homeowner has not yet said where the indoor breaker box is.",
        null,
      );
    }
  }

  const multipleMetersStep = ["meter_closeup", "meter_area_wide"].find((step) => {
    const count = accepted.get(step)?.meter_count;
    return count !== undefined && count > 1;
  });
  if (multipleMetersStep) {
    add(
      "MULTIPLE_METERS",
      "REVIEW",
      "More than one electric meter visible. Confirm which one belongs to this home.",
      multipleMetersStep,
    );
  }

  const multiplePanelsStep = [...accepted].find(([, a]) => a.multiple_panels_visible)?.[0];
  if (multiplePanelsStep) {
    add(
      "MULTIPLE_PANELS",
      "REVIEW",
      "More than one breaker box visible. Base requires a single main breaker box.",
      multiplePanelsStep,
    );
  }

  // Damage, rust and recalled brands can be repaired before install, so a person decides.
  for (const step of ["meter_closeup", "panel_wide", "panel_open", "main_disconnect_closeup"]) {
    if (accepted.get(step)?.damage_visible) {
      add(
        "DAMAGE",
        "REVIEW",
        `Needs repair before install: visible damage on ${stepTitle(step)}. Meter and conduit must be secure and undamaged.`,
        step,
      );
    }
  }

  // Older analyses have no brand or rust fields, so only explicit values count.
  const open = accepted.get("panel_open");
  if (open) {
    const recalled = RECALLED_BRANDS[open.panel_brand];
    if (recalled) {
      add(
        "PANEL_RECALLED_BRAND",
        "REVIEW",
        `Needs repair before install: breaker box brand is ${recalled}, which needs replacing.`,
        "panel_open",
      );
    } else if (open.panel_brand === "westinghouse") {
      add("PANEL_BRAND_CHECK", "REVIEW", "Westinghouse panel. Needs a person to verify.", "panel_open");
    }
    if (open.panel_label_legible === false || open.panel_brand === "not_visible") {
      add("PANEL_BRAND_UNREADABLE", "REVIEW", "Could not read the breaker box brand.", "panel_open");
    }
  }

  for (const step of ["panel_open", "panel_wide", "main_disconnect_closeup"]) {
    if (accepted.get(step)?.heavy_rust === true) {
      add("HEAVY_RUST", "REVIEW", `Needs repair before install: heavy rust on ${stepTitle(step)}.`, step);
    }
  }

  const wide = accepted.get("meter_area_wide");
  if (wide) {
    const near = [
      wide.gas_meter_near && "gas meter",
      wide.window_near && "window",
      wide.ac_unit_near && "A/C unit",
    ].filter(Boolean);
    if (near.length > 0) {
      add(
        "OBSTACLE_NEAR_METER",
        "REVIEW",
        `Near the meter: ${near.join(", ")}. Battery must be 3 ft from gas meters and not in front of windows.`,
        "meter_area_wide",
      );
    }
  }

  // Space rules.
  let spaceMaxBatteries: number | null = null;
  const spaceSteps = [...SPACE_STEPS, ...[...accepted.keys()].filter(isExtraStepId)];
  const spacePhotos = spaceSteps.flatMap((step) => {
    const a = accepted.get(step);
    return a ? [{ step, analysis: a }] : [];
  });
  const ranked = spacePhotos.filter((p) => p.analysis.clear_ground_space !== "unclear");
  const anyUnclear = spacePhotos.length > ranked.length;
  if (ranked.length === 0) {
    add("SPACE_UNCLEAR", "REVIEW", "Could not judge the ground space from the photos.", null);
  } else {
    const spaceMax = Math.max(
      ...ranked.map((p) => SPACE_RANK[p.analysis.clear_ground_space as keyof typeof SPACE_RANK]),
    );
    if (spaceMax === 0 && !anyUnclear) {
      const minConfidence = Math.min(...ranked.map((p) => p.analysis.confidence));
      failUnlessUnsure("NO_SPACE", "No clear ground space found next to the meter.", minConfidence, null);
    } else if (spaceMax === 0) {
      add("SPACE_UNCLEAR", "REVIEW", "No clear space in some photos, others unclear.", null);
    } else {
      spaceMaxBatteries = spaceMax;
      const best = ranked.find(
        (p) => SPACE_RANK[p.analysis.clear_ground_space as keyof typeof SPACE_RANK] === spaceMax,
      );
      add("SPACE_OK", "PASS", `Ground space fits up to ${batteries(spaceMax)}.`, best?.step ?? null);
      if (spaceMax === 1 && ampMaxBatteries === 2) {
        add("CAPPED_BY_SPACE", "PASS", "Panel supports 2 batteries, space fits 1.", null);
      }
    }
  }

  // Verdict.
  reasons.sort((a, b) => OUTCOME_ORDER[a.outcome] - OUTCOME_ORDER[b.outcome]);
  let verdict: Outcome;
  let batteryCount: number;
  if (reasons.some((r) => r.outcome === "FAIL")) {
    verdict = "FAIL";
    batteryCount = 0;
  } else if (reasons.some((r) => r.outcome === "REVIEW")) {
    verdict = "REVIEW";
    batteryCount = Math.min(ampMaxBatteries || 1, spaceMaxBatteries || 1);
  } else {
    verdict = "PASS";
    batteryCount = Math.min(ampMaxBatteries ?? 1, spaceMaxBatteries ?? 1);
  }
  return { verdict, batteryCount: batteryCount as 0 | 1 | 2, reasons };
}
