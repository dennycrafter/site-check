"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import { Banner, Button, Spinner } from "@/components/ui";
import { DECISION_LABELS } from "@/lib/labels";
import type { SurveyorDecision } from "@/lib/types";

const DECISIONS: Array<{ id: SurveyorDecision; label: string; active: string }> = [
  { id: "approved", label: "Approve", active: "border-pass bg-pass text-white" },
  { id: "rejected", label: "Reject", active: "border-fail bg-fail text-white" },
  { id: "needs_site_visit", label: "Needs site visit", active: "border-review bg-review text-white" },
];

/** Fixed to the bottom of the screen on mobile, sticky in the right column on desktop. */
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
    <section
      aria-label="Surveyor decision"
      className="fixed inset-x-0 bottom-0 z-30 border-t border-gray-200 bg-surface px-4 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] shadow-[0_-4px_16px_rgba(0,0,0,0.08)] lg:sticky lg:inset-auto lg:top-6 lg:rounded-2xl lg:border lg:p-5 lg:shadow-none"
    >
      <div className="flex items-baseline justify-between gap-2">
        <h2 className="text-sm font-bold text-gray-900 lg:text-lg">Surveyor decision</h2>
        <span className="text-xs text-gray-500">{decision ? DECISION_LABELS[decision] : "Undecided"}</span>
      </div>
      <label className="mt-2 block lg:mt-3">
        <span className="sr-only lg:not-sr-only lg:text-sm lg:text-gray-600">Note (optional)</span>
        <textarea
          value={draftNote}
          onChange={(e) => setDraftNote(e.target.value)}
          rows={1}
          maxLength={2000}
          placeholder="Note for the install team (optional)"
          className="mt-1 block max-h-40 min-h-11 w-full resize-y rounded-xl border border-gray-300 px-3 py-2 text-base focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/30 lg:min-h-24"
        />
      </label>
      <div className="mt-2 grid grid-cols-3 gap-2 lg:mt-3 lg:grid-cols-1">
        {DECISIONS.map((d) => (
          <button
            key={d.id}
            type="button"
            onClick={() => save(d.id)}
            disabled={saving !== null}
            aria-pressed={decision === d.id}
            className={`inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border-2 px-2 text-sm font-semibold leading-tight transition-colors disabled:opacity-60 lg:min-h-12 lg:px-4 lg:text-base ${
              decision === d.id ? d.active : "border-gray-300 bg-surface text-gray-800 hover:bg-gray-50"
            }`}
          >
            {saving === d.id && <Spinner className="h-4 w-4" />}
            {d.label}
          </button>
        ))}
      </div>
      {message && (
        <div className="mt-2 lg:mt-3">
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
      <Button variant="secondary" onClick={run} disabled={running || disabled} className="min-h-10 whitespace-nowrap px-3 text-sm">
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

function useEscape(active: boolean, onEscape: () => void) {
  useEffect(() => {
    if (!active) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onEscape();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [active, onEscape]);
}

function CloseIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth={2}>
      <path d="M6 6l12 12M18 6L6 18" strokeLinecap="round" />
    </svg>
  );
}

/** A photo that opens large in an overlay. Click outside the photo, the X, or press Escape to close. */
export function PhotoZoom({ src, alt, className = "" }: { src: string; alt: string; className?: string }) {
  const [open, setOpen] = useState(false);
  const close = useCallback(() => setOpen(false), []);
  useEscape(open, close);
  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className={`block cursor-zoom-in ${className}`} aria-label={`View ${alt} large`}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={src} alt={alt} className="h-full w-full object-cover" />
      </button>
      {open && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={alt}
          onClick={close}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 p-4"
        >
          <button
            type="button"
            onClick={close}
            aria-label="Close"
            className="absolute right-3 top-3 rounded-full bg-white/10 p-2 text-white hover:bg-white/20"
          >
            <CloseIcon />
          </button>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={src}
            alt={alt}
            onClick={(e) => e.stopPropagation()}
            className="max-h-full max-w-full rounded-lg object-contain"
          />
        </div>
      )}
    </>
  );
}

/** Three-dot menu in the page header. Holds "Delete home" behind a confirm dialog. */
export function HomeMenu({ homeId }: { homeId: string }) {
  const router = useRouter();
  const [menuOpen, setMenuOpen] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const closeConfirm = useCallback(() => setConfirming(false), []);
  useEscape(confirming && !deleting, closeConfirm);

  useEffect(() => {
    if (!menuOpen) return;
    const onClick = (e: MouseEvent) => {
      if (!menuRef.current?.contains(e.target as Node)) setMenuOpen(false);
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, [menuOpen]);

  async function remove() {
    setDeleting(true);
    setError(null);
    try {
      const res = await fetch(`/api/homes/${homeId}`, { method: "DELETE" });
      if (!res.ok) throw new Error();
      router.push("/review");
      router.refresh();
    } catch {
      setError("Could not delete this home. Please try again.");
      setDeleting(false);
    }
  }

  return (
    <div ref={menuRef} className="relative">
      <button
        type="button"
        onClick={() => setMenuOpen((v) => !v)}
        aria-label="More"
        aria-haspopup="menu"
        aria-expanded={menuOpen}
        className="inline-flex h-10 w-10 items-center justify-center rounded-full text-gray-500 hover:bg-gray-100 hover:text-gray-800"
      >
        <svg viewBox="0 0 24 24" aria-hidden="true" className="h-5 w-5" fill="currentColor">
          <circle cx="12" cy="5" r="1.8" />
          <circle cx="12" cy="12" r="1.8" />
          <circle cx="12" cy="19" r="1.8" />
        </svg>
      </button>
      {menuOpen && (
        <div role="menu" className="absolute right-0 z-40 mt-1 w-44 overflow-hidden rounded-xl border border-gray-200 bg-surface py-1 shadow-lg">
          <button
            type="button"
            role="menuitem"
            onClick={() => {
              setMenuOpen(false);
              setConfirming(true);
            }}
            className="block w-full px-4 py-2 text-left text-sm font-medium text-fail hover:bg-red-50"
          >
            Delete home
          </button>
        </div>
      )}
      {confirming && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
          onClick={() => !deleting && setConfirming(false)}
        >
          <div
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="delete-home-title"
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-sm rounded-2xl bg-surface p-5 shadow-xl"
          >
            <p id="delete-home-title" className="text-base font-semibold text-gray-900">
              Delete this home and all its photos? This can&apos;t be undone.
            </p>
            {error && <p className="mt-2 text-sm text-fail">{error}</p>}
            <div className="mt-5 flex justify-end gap-2">
              <Button variant="secondary" onClick={() => setConfirming(false)} disabled={deleting} className="min-h-10 text-sm">
                Cancel
              </Button>
              <button
                type="button"
                onClick={remove}
                disabled={deleting}
                className="inline-flex min-h-10 items-center justify-center gap-2 rounded-xl bg-fail px-5 text-sm font-semibold text-white hover:bg-red-800 disabled:opacity-60"
              >
                {deleting && <Spinner className="h-4 w-4" />}
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
