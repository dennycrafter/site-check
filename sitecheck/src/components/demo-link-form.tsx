"use client";

import QRCode from "qrcode";
import { useState, type FormEvent } from "react";
import { Banner, Button, Spinner } from "@/components/ui";

const inputClass =
  "mt-1 block min-h-11 w-full rounded-xl border border-gray-300 px-3 text-base text-gray-900 placeholder:text-gray-400 focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/30";

const CREATE_ERROR = "Could not create the link. Please try again.";

type Created = { url: string; qrSvg: string | null };

function YesNo({ label, value, onChange }: { label: string; value: boolean; onChange: (v: boolean) => void }) {
  const option = (v: boolean, text: string) => (
    <button
      type="button"
      aria-pressed={value === v}
      onClick={() => onChange(v)}
      className={`min-h-10 flex-1 rounded-lg border text-sm font-semibold transition-colors ${
        value === v ? "border-accent bg-accent-soft text-accent" : "border-gray-300 bg-white text-gray-700 hover:bg-gray-50"
      }`}
    >
      {text}
    </button>
  );
  return (
    <fieldset>
      <legend className="text-sm font-medium text-gray-700">{label}</legend>
      <div className="mt-1 flex gap-2">
        {option(true, "Yes")}
        {option(false, "No")}
      </div>
    </fieldset>
  );
}

/** Stands in for Base's signup system: creates the home with known customer facts and shows the photo link. */
export function DemoLinkForm() {
  const [address, setAddress] = useState("");
  const [name, setName] = useState("");
  const [inAustin, setInAustin] = useState(true);
  const [hasSolar, setHasSolar] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [created, setCreated] = useState<Created | null>(null);
  const [copied, setCopied] = useState(false);

  const ready = address.trim().length >= 5 && name.trim().length > 0;

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!ready || submitting) return;
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch("/api/homes", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ address: address.trim(), customerName: name.trim(), inAustin, hasSolar }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.id) throw new Error(data.error ?? CREATE_ERROR);
      const url = `${window.location.origin}/capture/${data.id}`;
      const qrSvg = await QRCode.toString(url, {
        type: "svg",
        margin: 1,
        width: 200,
        color: { dark: "#111827", light: "#ffffff" },
      }).catch(() => null);
      setCreated({ url, qrSvg });
      setCopied(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : CREATE_ERROR);
    } finally {
      setSubmitting(false);
    }
  }

  async function copy() {
    if (!created) return;
    try {
      await navigator.clipboard.writeText(created.url);
      setCopied(true);
    } catch {
      setCopied(false);
    }
  }

  function reset() {
    setCreated(null);
    setAddress("");
    setName("");
    setInAustin(true);
    setHasSolar(false);
  }

  if (created) {
    return (
      <div className="space-y-4">
        <p className="text-sm font-semibold text-pass">Customer link ready</p>
        <div className="flex items-stretch gap-2">
          <input
            readOnly
            value={created.url}
            onFocus={(e) => e.currentTarget.select()}
            aria-label="Customer photo link"
            className="min-h-11 min-w-0 flex-1 rounded-xl border border-gray-300 bg-gray-50 px-3 font-mono text-sm text-gray-800"
          />
          <Button variant="secondary" onClick={copy} className="min-h-11 shrink-0 px-4 text-sm">
            {copied ? "Copied" : "Copy"}
          </Button>
        </div>
        {created.qrSvg && (
          <div className="flex flex-col items-center gap-2">
            <div
              role="img"
              aria-label="QR code of the customer link"
              className="h-[200px] w-[200px] overflow-hidden rounded-xl border border-gray-200 bg-white p-2 [&>svg]:h-full [&>svg]:w-full"
              dangerouslySetInnerHTML={{ __html: created.qrSvg }}
            />
            <p className="text-xs text-gray-500">Scan with a phone to take the photos as the customer.</p>
          </div>
        )}
        <div className="flex flex-wrap items-center justify-between gap-2">
          <a href={created.url} className="text-sm font-semibold text-accent hover:underline">
            Open link here
          </a>
          <button type="button" onClick={reset} className="text-sm font-semibold text-gray-600 hover:text-gray-900">
            Create another
          </button>
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <p className="rounded-lg bg-gray-50 px-3 py-2 text-xs font-medium text-gray-500">
        Demo only: stands in for Base&apos;s system
      </p>
      <label className="block">
        <span className="text-sm font-medium text-gray-700">Address</span>
        <input
          className={inputClass}
          value={address}
          onChange={(e) => setAddress(e.target.value)}
          placeholder="1234 Oak St, Austin, TX 78704"
          maxLength={300}
          required
        />
      </label>
      <label className="block">
        <span className="text-sm font-medium text-gray-700">Customer name</span>
        <input
          className={inputClass}
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Jane Doe"
          maxLength={200}
          required
        />
      </label>
      <div className="grid grid-cols-2 gap-3">
        <YesNo label="In Austin" value={inAustin} onChange={setInAustin} />
        <YesNo label="Has solar" value={hasSolar} onChange={setHasSolar} />
      </div>
      {error && <Banner tone="error">{error}</Banner>}
      <Button type="submit" disabled={!ready || submitting} className="w-full">
        {submitting ? (
          <>
            <Spinner /> Creating...
          </>
        ) : (
          "Create customer link"
        )}
      </Button>
    </form>
  );
}
