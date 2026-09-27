"use client";

import QRCode from "qrcode";
import { useState, type FormEvent } from "react";
import { Spinner } from "@/components/ui";
import { BRAND } from "@/lib/brand";
import "@/styles/customer-flow.css";

const CREATE_ERROR = "Could not create the link. Please try again.";

type Created = { url: string; qrSvg: string | null };

function YesNo({ label, value, onChange }: { label: string; value: boolean; onChange: (v: boolean) => void }) {
  const option = (next: boolean, text: string) => (
    <button
      type="button"
      aria-pressed={value === next}
      onClick={() => onChange(next)}
      className={value === next ? "sc-option selected" : "sc-option"}
    >
      {text}
    </button>
  );
  return (
    <fieldset className="sc-choice">
      <legend>{label}</legend>
      <div className="sc-yesno">
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
        color: { dark: BRAND.ink, light: "#ffffff" },
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
      <div className="sc-root sc-embed">
        <div className="sc-shell">
          <p className="sc-demo-note">Demo only: stands in for Base&apos;s system</p>
          <section className="sc-content">
            <h2 className="sc-section-title">Customer link ready</h2>
            <div className="sc-link-row">
              <input readOnly value={created.url} onFocus={(e) => e.currentTarget.select()} aria-label="Customer photo link" />
              <button type="button" className="sc-option" onClick={() => void copy()}>
                {copied ? "Copied" : "Copy"}
              </button>
            </div>
            {created.qrSvg && (
              <div className="sc-qr">
                <div
                  role="img"
                  aria-label="QR code of the customer link"
                  className="sc-qr-frame"
                  dangerouslySetInnerHTML={{ __html: created.qrSvg }}
                />
                <p className="sc-muted">Scan with a phone to take the photos as the customer.</p>
              </div>
            )}
            <div className="sc-text-row">
              <a href={created.url} className="sc-text-button">
                Open link here
              </a>
              <button type="button" className="sc-text-button" onClick={reset}>
                Create another
              </button>
            </div>
          </section>
        </div>
      </div>
    );
  }

  return (
    <div className="sc-root sc-embed">
      <form className="sc-shell" onSubmit={onSubmit}>
        <p className="sc-demo-note">Demo only: stands in for Base&apos;s system</p>
        <section className="sc-content">
          <h2 className="sc-section-title">Customer photo link</h2>
          <p className="sc-muted">Sent by Base after signup</p>
          <div className="sc-fields">
            <label>
              Address
              <input
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                placeholder="1234 Oak St, Austin, TX 78704"
                autoComplete="street-address"
                maxLength={300}
                required
              />
            </label>
            <label>
              Customer name
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Jane Doe"
                autoComplete="name"
                maxLength={200}
                required
              />
            </label>
            <div className="sc-split">
              <YesNo label="In Austin" value={inAustin} onChange={setInAustin} />
              <YesNo label="Has solar" value={hasSolar} onChange={setHasSolar} />
            </div>
          </div>
          {error && (
            <p className="sc-error" role="alert">
              {error}
            </p>
          )}
        </section>
        <footer className="sc-actions">
          <button type="submit" className="sc-primary" disabled={!ready || submitting}>
            {submitting ? (
              <>
                <Spinner /> Creating...
              </>
            ) : (
              "Create customer link"
            )}
          </button>
        </footer>
      </form>
    </div>
  );
}
