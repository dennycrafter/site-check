"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Banner, Button, Spinner } from "@/components/ui";
import { DECISION_LABELS } from "@/lib/labels";
import type { SurveyorDecision } from "@/lib/types";

const DECISIONS: Array<{ id: SurveyorDecision; active: string }> = [
  { id: "approved", active: "border-pass bg-pass text-white" },
  { id: "rejected", active: "border-fail bg-fail text-white" },
  { id: "needs_site_visit", active: "border-review bg-review text-white" },
];

export function DecisionPanel({
  homeId,
  decision,
  note,
}: {
  homeId: string;
  decision: SurveyorDecision | null;
  note: string;
}) {
  const router = useRouter();
  const [draftNote, setDraftNote] = useState(note);
  const [saving, setSaving] = useState<SurveyorDecision | null>(null);
  const [message, setMessage] = useState<{ tone: "success" | "error"; text: string } | null>(null);
  const [, startTransition] = useTransition();

  async function save(value: SurveyorDecision) {
    setSaving(value);
    setMessage(null);
    try {
      const res = await fetch(`/api/homes/${homeId}/decision`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ decision: value, note: draftNote }),
      });
      if (!res.ok) throw new Error();
      setMessage({ tone: "success", text: `Saved: ${DECISION_LABELS[value]}` });
      startTransition(() => router.refresh());
    } catch {
      setMessage({ tone: "error", text: "Could not save the decision. Please try again." });
    } finally {
      setSaving(null);
    }
  }

  return (
    <section className="rounded-2xl border border-gray-200 p-5">
      <h2 className="text-lg font-bold text-gray-900">Surveyor decision</h2>
      <label className="mt-3 block">
        <span className="text-sm text-gray-600">Note (optional)</span>
        <textarea
          value={draftNote}
          onChange={(e) => setDraftNote(e.target.value)}
          rows={3}
          maxLength={2000}
          placeholder="Anything the install team should know"
          className="mt-1 block w-full rounded-xl border border-gray-300 px-3 py-2 text-base focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/30"
        />
      </label>
      <div className="mt-3 grid gap-2">
        {DECISIONS.map((d) => (
          <button
            key={d.id}
            type="button"
            onClick={() => save(d.id)}
            disabled={saving !== null}
            aria-pressed={decision === d.id}
            className={`inline-flex min-h-12 items-center justify-center gap-2 rounded-xl border-2 px-4 text-base font-semibold transition-colors disabled:opacity-60 ${
              decision === d.id ? d.active : "border-gray-300 bg-white text-gray-800 hover:bg-gray-50"
            }`}
          >
            {saving === d.id && <Spinner className="h-4 w-4" />}
            {d.id === "approved" ? "Approve" : d.id === "rejected" ? "Reject" : "Needs site visit"}
          </button>
        ))}
      </div>
      {message && (
        <div className="mt-3">
          <Banner tone={message.tone}>{message.text}</Banner>
        </div>
      )}
    </section>
  );
}

export function RecheckButton({ homeId, disabled }: { homeId: string; disabled: boolean }) {
  const router = useRouter();
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  async function run() {
    setRunning(true);
    setError(null);
    try {
      const res = await fetch(`/api/homes/${homeId}/recheck`, { method: "POST" });
      if (!res.ok) throw new Error();
      startTransition(() => router.refresh());
    } catch {
      setError("Re-run failed. Try again.");
    } finally {
      setRunning(false);
    }
  }

  return (
    <div className="flex flex-col items-end">
      <Button variant="secondary" onClick={run} disabled={running || disabled} className="min-h-10 px-3 text-sm">
        {running ? (
          <>
            <Spinner className="h-4 w-4" /> Re-running...
          </>
        ) : (
          "Re-run checks"
        )}
      </Button>
      {error && <p className="mt-1 text-xs text-fail">{error}</p>}
    </div>
  );
}
