"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";
import { Spinner } from "@/components/ui";
import { fieldKind, fieldOptions } from "@/lib/corrections";
import { valueLabel } from "@/lib/review";
import type { AnalysisField } from "@/lib/schema";

type Value = string | number | boolean;

/** One AI reading the surveyor can set. Every pick is saved right away, even when it matches the current value. */
export function EditableReading({
  homeId,
  photoId,
  field,
  label,
  value,
  aiValue,
  corrected,
  tone,
}: {
  homeId: string;
  photoId: string;
  field: AnalysisField;
  label: string;
  value: Value;
  aiValue: unknown;
  corrected: boolean;
  tone: string;
}) {
  const router = useRouter();
  const [current, setCurrent] = useState<Value>(value);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [, startTransition] = useTransition();
  const kind = fieldKind(field);

  async function save(next: Value) {
    const previous = current;
    setCurrent(next);
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/homes/${homeId}/corrections`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ photoId, field, value: next }),
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => null)) as { error?: string } | null;
        throw new Error(body?.error ?? "Not saved. Try again.");
      }
      startTransition(() => router.refresh());
    } catch (err) {
      setCurrent(previous);
      setError(err instanceof Error ? err.message : "Not saved. Try again.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className={`col-span-2 grid grid-cols-subgrid items-center rounded-md px-2 py-1 ${tone}`}>
      <dt className={tone ? "" : "text-muted"}>{label}</dt>
      <dd className="rv-reading">
        {kind === "boolean" && (
          <button
            type="button"
            role="switch"
            aria-checked={current === true}
            aria-label={label}
            onClick={() => save(current !== true)}
            disabled={saving}
            className="rv-switch"
          >
            <span className="rv-switch-track">
              <span className="rv-switch-knob" />
            </span>
            <span className="rv-switch-text">{current === true ? "Yes" : "No"}</span>
          </button>
        )}
        {kind === "choice" && (
          <Choice field={field} label={label} value={String(current)} disabled={saving} onPick={save} />
        )}
        {kind === "number" && (
          <NumberField field={field} label={label} value={Number(current)} disabled={saving} onSave={save} />
        )}
        {saving && <Spinner className="h-3.5 w-3.5 text-muted" />}
        {corrected && !saving && (
          <>
            <span className="rv-corrected">Corrected</span>
            <span className="rv-ai-value">AI: {valueLabel(field, aiValue)}</span>
          </>
        )}
        {error && (
          <span className="rv-reading-error" role="alert">
            {error}
          </span>
        )}
      </dd>
    </div>
  );
}

function Choice({
  field,
  label,
  value,
  disabled,
  onPick,
}: {
  field: AnalysisField;
  label: string;
  value: string;
  disabled: boolean;
  onPick: (value: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", onDown);
    window.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      window.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div ref={ref} className="rv-choice">
      <button
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={`${label}: ${valueLabel(field, value)}`}
        onClick={() => setOpen((v) => !v)}
        disabled={disabled}
        className="rv-choice-button"
      >
        {valueLabel(field, value)}
        <svg viewBox="0 0 24 24" aria-hidden="true" className="h-4 w-4 shrink-0">
          <path d="M6 9l6 6 6-6" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>
      {open && (
        <div role="menu" aria-label={label} className="rv-choice-menu">
          {fieldOptions(field).map((option) => (
            <button
              key={option}
              type="button"
              role="menuitemradio"
              aria-checked={option === value}
              onClick={() => {
                setOpen(false);
                onPick(option);
              }}
            >
              {valueLabel(field, option)}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

/** Saves on Enter (always) or when leaving the field with a changed number. */
function NumberField({
  field,
  label,
  value,
  disabled,
  onSave,
}: {
  field: AnalysisField;
  label: string;
  value: number;
  disabled: boolean;
  onSave: (value: number) => void;
}) {
  const [text, setText] = useState(String(value));

  function commit(force: boolean) {
    const n = Number(text);
    if (text.trim() === "" || !Number.isInteger(n) || n < 0) {
      setText(String(value));
      return;
    }
    if (force || n !== value) onSave(n);
  }

  return (
    <span className="rv-number">
      <input
        type="number"
        inputMode="numeric"
        min={0}
        step={1}
        value={text}
        aria-label={label}
        disabled={disabled}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            commit(true);
          }
        }}
        onBlur={() => commit(false)}
      />
      {field === "amp_rating" && <span aria-hidden="true">A</span>}
    </span>
  );
}
