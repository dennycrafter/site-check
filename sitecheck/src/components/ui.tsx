import type { ButtonHTMLAttributes, ReactNode } from "react";
import type { Outcome } from "@/lib/types";

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

export function VerdictBadge({ verdict }: { verdict: Outcome | null }) {
  if (!verdict) {
    return (
      <span className="inline-flex rounded-md bg-gray-200 px-2 py-0.5 text-xs font-bold text-gray-600">
        PENDING
      </span>
    );
  }
  return (
    <span
      className={`inline-flex rounded-md px-2 py-0.5 text-xs font-bold tracking-wide ${VERDICT_STYLES[verdict]}`}
    >
      {verdict}
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
