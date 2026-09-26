import { latestPhotoByStep, planSteps } from "./plan";
import type { PhotoAnalysis } from "./schema";
import { SPACE_STEPS, stepTitle } from "./steps";
import type { FinishedPhotoStatus, Outcome, PanelSameWallAnswer, Reason, SetupType } from "./types";

export const CONFIDENCE_MIN = 80;
export const AMP_MIN_AUSTIN = 150;
export const AMP_MIN_ELSEWHERE = 100;
export const AMP_FOR_TWO_BATTERIES = 200;
export const AMP_REQUIRED_WITH_SOLAR = 200;
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
  photos: RulesPhoto[];
};

export type RulesResult = { verdict: Outcome; batteryCount: 0 | 1 | 2; reasons: Reason[] };

const OUTCOME_ORDER: Record<Outcome, number> = { FAIL: 0, REVIEW: 1, PASS: 2 };
const SPACE_RANK = { none: 0, room_for_one: 1, room_for_two: 2 } as const;

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
    { setup_type: input.setupType, panel_same_wall_answer: input.panelSameWallAnswer },
    input.photos,
  );
  for (const step of required) {
    const photo = byStep.get(step);
    const title = stepTitle(step);
    if (!photo) {
      add("STEP_MISSING", "REVIEW", `Missing photo: ${title}.`, step);
    } else if (photo.status === "accepted_after_max_attempts") {
      add("STEP_UNCLEAR", "REVIEW", `Homeowner could not get a clear ${title} photo.`, step);
    } else if (photo.status === "check_failed" || !photo.analysis) {
      add("CHECK_FAILED", "REVIEW", `Automatic check failed for ${title}. Needs manual review.`, step);
    }
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
      if (input.hasSolar === null && x >= AMP_MIN_ELSEWHERE && x < AMP_REQUIRED_WITH_SOLAR) {
        outcomes.push("REVIEW");
        add(
          "SOLAR_UNKNOWN",
          "REVIEW",
          `Main breaker is ${x}A. Homes with solar need 200A. Confirm whether the home has solar.`,
          step,
        );
      }
      if (input.hasSolar && x < AMP_REQUIRED_WITH_SOLAR) {
        outcomes.push(
          failUnlessUnsure(
            "SOLAR_NEEDS_200A",
            `Homes with solar need a 200A panel. This one is ${x}A.`,
            amp.confidence,
            step,
          ),
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
        ampMaxBatteries = x >= AMP_FOR_TWO_BATTERIES ? 2 : 1;
        add("AMP_OK", "PASS", `Main breaker ${x}A supports up to ${batteries(ampMaxBatteries)}.`, step);
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
  if (panel && panel.location === "closet") {
    failUnlessUnsure(
      "PANEL_IN_CLOSET",
      "Breaker box is in a closet. It must be away from flammable materials.",
      panel.confidence,
      "panel_wide",
    );
  }

  if (input.setupType === "panel_indoors") {
    if (input.panelSameWallAnswer === "no") {
      add(
        "PANEL_NOT_SAME_WALL",
        "FAIL",
        "Breaker box is indoors and not on the same wall as the meter.",
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

  const multiplePanelsStep = [...accepted].find(([, a]) => a.multiple_panels_visible)?.[0];
  if (multiplePanelsStep) {
    add(
      "MULTIPLE_PANELS",
      "REVIEW",
      "More than one breaker box visible. Base requires a single main breaker box.",
      multiplePanelsStep,
    );
  }

  for (const step of ["meter_closeup", "panel_wide", "main_disconnect_closeup"]) {
    const a = accepted.get(step);
    if (a?.damage_visible) {
      failUnlessUnsure(
        "DAMAGE",
        `Visible damage on ${stepTitle(step)}. Meter and conduit must be secure and undamaged.`,
        a.confidence,
        step,
      );
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
  const spacePhotos = SPACE_STEPS.flatMap((step) => {
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
