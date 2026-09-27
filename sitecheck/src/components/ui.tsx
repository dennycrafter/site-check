import type { ButtonHTMLAttributes, ReactNode } from "react";
import { decisionLabel, verdictLabel } from "@/lib/review";
import type { Outcome, SurveyorDecision } from "@/lib/types";

type Variant = "primary" | "secondary" | "ghost";

const VARIANTS: Record<Variant, string> = {
  primary: "bg-accent text-white hover:bg-accent-dark disabled:bg-gray-300 disabled:text-gray-500",
  secondary:
    "border border-gray-300 bg-white text-gray-800 hover:bg-gray-50 disabled:text-gray-400",
  ghost: "text-accent underline-offset-4 hover:underline disabled:text-gray-400",
};

export function buttonClass(variant: Variant = "primary", extra = "") {
  return `inline-flex min-h-12 items-center justify-center gap-2 rounded-xl px-5 text-base font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent disabled:cursor-not-allowed ${VARIANTS[variant]} ${extra}`;
}

export function Button({
  variant = "primary",
  className = "",
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant }) {
  return <button type="button" className={buttonClass(variant, className)} {...props} />;
}

export function Spinner({ className = "h-5 w-5" }: { className?: string }) {
  return (
    <span
      role="status"
      aria-label="Loading"
      className={`inline-block animate-spin rounded-full border-2 border-current border-r-transparent ${className}`}
    />
  );
}

const VERDICT_STYLES: Record<Outcome, string> = {
  PASS: "bg-pass text-white",
  FAIL: "bg-fail text-white",
  REVIEW: "bg-review text-white",
};

const BADGE = "inline-flex whitespace-nowrap rounded-md px-2 py-0.5 text-xs font-bold";

export function VerdictBadge({ verdict }: { verdict: Outcome | null }) {
  const style = verdict ? VERDICT_STYLES[verdict] : "bg-gray-200 text-gray-600";
  return <span className={`${BADGE} ${style}`}>{verdictLabel(verdict)}</span>;
}

const DECISION_STYLES: Record<SurveyorDecision, string> = {
  approved: "bg-pass text-white",
  rejected: "bg-fail text-white",
  needs_site_visit: "bg-review text-white",
};

export function DecisionBadge({ decision }: { decision: SurveyorDecision }) {
  return <span className={`${BADGE} ${DECISION_STYLES[decision]}`}>{decisionLabel(decision)}</span>;
}

/** Decision as the main badge when there is one, with the AI verdict small and grey. */
export function StatusBadges({ verdict, decision }: { verdict: Outcome | null; decision: SurveyorDecision | null }) {
  if (!decision) return <VerdictBadge verdict={verdict} />;
  return (
    <span className="inline-flex flex-wrap items-center gap-x-2 gap-y-1">
      <DecisionBadge decision={decision} />
      <span className="whitespace-nowrap text-xs text-gray-400">AI: {verdictLabel(verdict)}</span>
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
  const styles = {
    success: "border-pass/30 bg-green-50 text-pass",
    warning: "border-review/30 bg-amber-50 text-review",
    neutral: "border-gray-200 bg-gray-50 text-gray-700",
    error: "border-fail/30 bg-red-50 text-fail",
  }[tone];
  return <div className={`rounded-xl border px-4 py-3 text-base ${styles}`}>{children}</div>;
}
