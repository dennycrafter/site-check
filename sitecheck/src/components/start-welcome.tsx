"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Spinner } from "@/components/ui";
import { PHASE_TITLES } from "@/lib/steps";
import type { StartLink } from "@/lib/startLink";
import "@/styles/customer-flow.css";

const TIPS = ["Go out in daylight.", "Unlock any gate near your meter.", "Be ready to open your breaker box lid."];
const CREATE_ERROR = "We couldn't start your photo check. Check your connection and try again.";

function CheckIcon() {
  return (
    <svg className="sc-tip-icon" width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle cx="12" cy="12" r="11" fill="var(--brand-lime-soft)" />
      <path d="M7 12.5 10.5 16 17 8.5" stroke="var(--brand-green)" strokeWidth="2.25" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

/** First screen for a customer who arrived from Base's link. Simulates a link that already carries what Base knows. */
export function StartWelcome({ link }: { link: StartLink }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function begin() {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/homes", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          customerName: link.name,
          customerEmail: link.email,
          inAustin: link.inAustin,
          hasSolar: link.hasSolar,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.id) throw new Error(data.error ?? CREATE_ERROR);
      router.push(`/capture/${data.id}${link.extra ? `?${link.extra}` : ""}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : CREATE_ERROR);
      setBusy(false);
    }
  }

  return (
    <main className="sc-root">
      <div className="sc-shell sc-stage-welcome">
        <section className="sc-content">
          <h1>Hi {link.firstName}.</h1>
          <p>Let&apos;s photograph your meter and breaker box. About 5 minutes.</p>
          <ul className="sc-tips">
            {TIPS.map((tip) => (
              <li key={tip}>
                <CheckIcon />
                {tip}
              </li>
            ))}
          </ul>
          <ol className="sc-phase-list" aria-label="The three parts">
            {Object.values(PHASE_TITLES).map((title) => (
              <li key={title}>{title}</li>
            ))}
          </ol>
          {error && (
            <p className="sc-error" role="alert">
              {error}
            </p>
          )}
        </section>
        <footer className="sc-actions">
          <button type="button" className="sc-primary" onClick={() => void begin()} disabled={busy}>
            {busy ? (
              <>
                <Spinner /> Starting...
              </>
            ) : (
              "Begin"
            )}
          </button>
        </footer>
      </div>
    </main>
  );
}
