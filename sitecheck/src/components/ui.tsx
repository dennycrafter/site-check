import type { ButtonHTMLAttributes, ReactNode } from "react";
import { decisionLabel, verdictLabel } from "@/lib/review";
import type { Outcome, SurveyorDecision } from "@/lib/types";

type Variant = "primary" | "secondary" | "ghost";

const VARIANTS: Record<Variant, string> = {
  primary: "ui-button",
  secondary: "ui-button-secondary",
  ghost: "ui-button-ghost",
};

export function buttonClass(variant: Variant = "primary", extra = "") {
  return extra ? `${VARIANTS[variant]} ${extra}` : VARIANTS[variant];
}

export function Button({
  variant = "primary",
  className = "",
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant }) {
  return <button type="button" className={buttonClass(variant, className)} {...props} />;
}

export function Spinner({ className = "h-5 w-5" }: { className?: string }) {
  return <span role="status" aria-label="Loading" className={`ui-spinner ${className}`} />;
}

export type BadgeTone = "pass" | "review" | "fail" | "neutral";

export const BADGE_CLASS: Record<BadgeTone, string> = {
  pass: "ui-badge-pass",
  review: "ui-badge-review",
  fail: "ui-badge-fail",
  neutral: "ui-badge-neutral",
};

const VERDICT_TONES: Record<Outcome, BadgeTone> = {
  PASS: "pass",
  FAIL: "fail",
  REVIEW: "review",
};

export function VerdictBadge({ verdict }: { verdict: Outcome | null }) {
  return <span className={BADGE_CLASS[verdict ? VERDICT_TONES[verdict] : "neutral"]}>{verdictLabel(verdict)}</span>;
}

const DECISION_TONES: Record<SurveyorDecision, BadgeTone> = {
  approved: "pass",
  rejected: "fail",
  needs_site_visit: "review",
};

export function DecisionBadge({ decision }: { decision: SurveyorDecision }) {
  return <span className={BADGE_CLASS[DECISION_TONES[decision]]}>{decisionLabel(decision)}</span>;
}

/** Decision as the main badge when there is one, with the AI verdict small and muted. */
export function StatusBadges({ verdict, decision }: { verdict: Outcome | null; decision: SurveyorDecision | null }) {
  if (!decision) return <VerdictBadge verdict={verdict} />;
  return (
    <span className="inline-flex flex-wrap items-center gap-x-2 gap-y-1">
      <DecisionBadge decision={decision} />
      <span className="whitespace-nowrap text-xs text-muted">AI: {verdictLabel(verdict)}</span>
    </span>
  );
}

export function Banner({
  tone,
  children,
}: {
  tone: "success" | "warning" | "neutral" | "error";
  children: ReactNode;
}) {
  return <div className={`ui-banner ui-banner-${tone}`}>{children}</div>;
}
