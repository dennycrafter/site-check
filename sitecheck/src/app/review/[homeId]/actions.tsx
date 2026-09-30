"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState, useTransition, type ReactNode } from "react";
import { Button, Spinner } from "@/components/ui";
import { DECISION_LABELS } from "@/lib/labels";
import type { SurveyorDecision } from "@/lib/types";

const DECISIONS: Array<{ id: SurveyorDecision; label: string; primary?: boolean }> = [
  { id: "approved", label: "Approve", primary: true },
  { id: "rejected", label: "Reject" },
  { id: "needs_site_visit", label: "Site visit" },
];

const DECIDED_TONE: Record<SurveyorDecision, string> = {
  approved: "rv-decided-pass",
  rejected: "rv-decided-fail",
  needs_site_visit: "rv-decided-review",
};

/** Approve, Reject or Site visit, with an optional note. Once decided, the decision shows plainly with Undo. */
export function DecisionControls({
  homeId,
  decision: savedDecision,
  note: savedNote,
}: {
  homeId: string;
  decision: SurveyorDecision | null;
  note: string;
}) {
  const router = useRouter();
  const [decision, setDecision] = useState(savedDecision);
  const [note, setNote] = useState(savedNote);
  const [noteOpen, setNoteOpen] = useState(!savedDecision && savedNote.length > 0);
  const [saving, setSaving] = useState<SurveyorDecision | "undo" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  async function save(value: SurveyorDecision | null) {
    setSaving(value ?? "undo");
    setError(null);
    try {
      const res = await fetch(`/api/homes/${homeId}/decision`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(value ? { decision: value, note } : { decision: null }),
      });
      if (!res.ok) throw new Error();
      setDecision(value);
      if (!value) setNoteOpen(note.length > 0);
      startTransition(() => router.refresh());
    } catch {
      setError(value ? "Could not save the decision. Try again." : "Could not undo. Try again.");
    } finally {
      setSaving(null);
    }
  }

  if (decision) {
    return (
      <div className="rv-controls">
        <p className="rv-decided" role="status">
          <span className={DECIDED_TONE[decision]}>{DECISION_LABELS[decision]}</span>
          <button type="button" className="rv-link" onClick={() => save(null)} disabled={saving !== null}>
            {saving === "undo" ? "Undoing..." : "Undo"}
          </button>
        </p>
        {note && <p className="rv-note-text">{note}</p>}
        {error && <p className="rv-error">{error}</p>}
      </div>
    );
  }

  return (
    <div className="rv-controls">
      <div className="rv-buttons">
        {DECISIONS.map((d) => (
          <button
            key={d.id}
            type="button"
            onClick={() => save(d.id)}
            disabled={saving !== null}
            className={d.primary ? "rv-btn rv-btn-primary" : "rv-btn"}
          >
            {saving === d.id && <Spinner className="h-4 w-4" />}
            {d.label}
          </button>
        ))}
      </div>
      {noteOpen ? (
        <label className="rv-note">
          <span className="sr-only">Note</span>
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            rows={3}
            maxLength={2000}
            autoFocus
            placeholder="Note for the install team"
          />
        </label>
      ) : (
        <button type="button" className="rv-link" onClick={() => setNoteOpen(true)}>
          Add note
        </button>
      )}
      {error && <p className="rv-error">{error}</p>}
    </div>
  );
}

/** Everything below the decision, closed by default. */
export function DetailsToggle({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);
  return (
    <section className="rv-details">
      <button
        type="button"
        className="rv-toggle"
        aria-expanded={open}
        aria-controls="rv-details-body"
        onClick={() => setOpen((v) => !v)}
      >
        {open ? "Hide all photos and details" : "Show all photos and details"}
        <svg viewBox="0 0 24 24" aria-hidden="true" className={open ? "rv-chevron rv-chevron-open" : "rv-chevron"}>
          <path d="M6 9l6 6 6-6" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>
      <div id="rv-details-body" hidden={!open}>
        {children}
      </div>
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
      <Button variant="secondary" onClick={run} disabled={running || disabled} className="whitespace-nowrap">
        {running ? (
          <>
            <Spinner className="h-4 w-4" /> Re-running...
          </>
        ) : (
          "Re-run checks"
        )}
      </Button>
      {error && <p className="mt-1 text-sm text-fail">{error}</p>}
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
          className="fixed inset-0 z-50 flex items-center justify-center bg-ink/85 p-4"
        >
          <button
            type="button"
            onClick={close}
            aria-label="Close"
            className="absolute right-3 top-3 rounded-full bg-surface/10 p-2 text-surface hover:bg-surface/20"
          >
            <CloseIcon />
          </button>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={src}
            alt={alt}
            onClick={(e) => e.stopPropagation()}
            className="max-h-full max-w-full rounded-brand object-contain"
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
        className="inline-flex h-11 w-11 items-center justify-center rounded-full bg-lime-soft text-accent hover:bg-[color-mix(in_srgb,var(--brand-lime)_35%,var(--brand-lime-soft))]"
      >
        <svg viewBox="0 0 24 24" aria-hidden="true" className="h-5 w-5" fill="currentColor">
          <circle cx="12" cy="5" r="1.8" />
          <circle cx="12" cy="12" r="1.8" />
          <circle cx="12" cy="19" r="1.8" />
        </svg>
      </button>
      {menuOpen && (
        <div role="menu" className="absolute right-0 z-40 mt-1 w-44 overflow-hidden rounded-brand border border-line bg-surface py-1 shadow-[var(--brand-shadow)]">
          <button
            type="button"
            role="menuitem"
            onClick={() => {
              setMenuOpen(false);
              setConfirming(true);
            }}
            className="block min-h-12 w-full px-4 py-2 text-left text-base font-semibold text-fail hover:bg-red-50"
          >
            Delete home
          </button>
        </div>
      )}
      {confirming && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-ink/45 p-4"
          onClick={() => !deleting && setConfirming(false)}
        >
          <div
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="delete-home-title"
            onClick={(e) => e.stopPropagation()}
            className="ui-card w-full max-w-sm"
          >
            <p id="delete-home-title" className="ui-label">
              Delete this home and all its photos? This can&apos;t be undone.
            </p>
            {error && <p className="mt-2 text-sm text-fail">{error}</p>}
            <div className="mt-5 flex justify-end gap-2">
              <Button variant="secondary" onClick={() => setConfirming(false)} disabled={deleting}>
                Cancel
              </Button>
              <button
                type="button"
                onClick={remove}
                disabled={deleting}
                className="ui-button ui-button-danger min-h-12 text-lg"
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
