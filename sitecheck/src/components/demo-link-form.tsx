"use client";

import QRCode from "qrcode";
import { useRef, useState, type FormEvent } from "react";
import { AddressSuggestions } from "@/components/address-suggestions";
import { Spinner } from "@/components/ui";
import { BRAND } from "@/lib/brand";
import { MAPS_API_KEY, useAddressSuggestions, type AddressSuggestion } from "@/lib/maps-client";
import "@/styles/customer-flow.css";

const CREATE_ERROR = "Could not create the link. Please try again.";

type Created = { url: string; qrSvg: string | null };
type Picked = { address: string; placeId: string; lat: number; lng: number };

function YesNo({ label, value, onChange }: { label: string; value: boolean; onChange: (v: boolean) => void }) {
  const option = (next: boolean, text: string) => (
    <button type="button" aria-pressed={value === next} onClick={() => onChange(next)} className="ui-button-secondary flex-1">
      {text}
    </button>
  );
  return (
    <fieldset className="m-0 min-w-0 border-0 p-0">
      <legend className="ui-label mb-2 p-0">{label}</legend>
      <div className="flex gap-2">
        {option(true, "Yes")}
        {option(false, "No")}
      </div>
    </fieldset>
  );
}

function CardIntro() {
  return (
    <div>
      <p className="ui-eyebrow">For homeowners</p>
      <h2 className="ui-title">Customer photo check</h2>
      <p className="ui-lead ui-landing-intro">Guided photos with an instant AI check on every shot.</p>
      <p className="ui-card-note ui-landing-intro">Demo only: stands in for Base&apos;s system</p>
    </div>
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
  const [picked, setPicked] = useState<Picked | null>(null);
  const addressInput = useRef<HTMLInputElement>(null);
  const suggest = useAddressSuggestions(addressInput);

  async function chooseSuggestion(item: AddressSuggestion) {
    setAddress(item.label);
    try {
      const found = await suggest.choose(item);
      setAddress(found.address);
      setPicked(found.point ? { address: found.address, placeId: found.placeId, ...found.point } : null);
    } catch (err) {
      console.error("[demo] could not load the chosen address", err);
      setPicked(null);
    }
  }

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
        body: JSON.stringify({
          address: address.trim(),
          customerName: name.trim(),
          inAustin,
          hasSolar,
          ...(picked && picked.address === address.trim() ? { placeId: picked.placeId, lat: picked.lat, lng: picked.lng } : {}),
        }),
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
    setPicked(null);
    setName("");
    setInAustin(true);
    setHasSolar(false);
  }

  if (created) {
    return (
      <section className="ui-card flex h-full flex-col">
        <CardIntro />
        <div className="ui-landing-section flex flex-1 flex-col">
          <h3 className="ui-subtitle">Customer link ready</h3>
          <div className="mt-2 flex items-center gap-2">
            <input
              readOnly
              value={created.url}
              onFocus={(e) => e.currentTarget.select()}
              aria-label="Customer photo link"
              className="ui-input ui-input-mono min-w-0 flex-1"
            />
            <button type="button" className="ui-button-secondary whitespace-nowrap" onClick={() => void copy()}>
              {copied ? "Copied" : "Copy"}
            </button>
          </div>
          {created.qrSvg && (
            <div className="mt-3 flex flex-col items-center gap-1">
              <div
                role="img"
                aria-label="QR code of the customer link"
                className="ui-qr"
                dangerouslySetInnerHTML={{ __html: created.qrSvg }}
              />
              <p className="ui-muted text-center">Scan with a phone to take the photos as the customer.</p>
            </div>
          )}
          <div className="mt-auto flex flex-wrap items-center justify-between gap-2 pt-1">
            <a href={created.url} className="ui-button-ghost">
              Open link here
            </a>
            <button type="button" className="ui-button-ghost" onClick={reset}>
              Create another
            </button>
          </div>
        </div>
      </section>
    );
  }

  return (
    <section className="ui-card flex h-full flex-col">
      <CardIntro />
      <form className="ui-landing-section flex flex-1 flex-col" onSubmit={onSubmit}>
        <div className="ui-landing-fields">
          <div className="pl-address-field">
            <label className="ui-label">
              Address
              <input
                className="ui-input ui-landing-field-input"
                ref={addressInput}
                value={address}
                onChange={(e) => {
                  setAddress(e.target.value);
                  setPicked(null);
                  suggest.onQueryChange(e.target.value);
                }}
                onKeyDown={(e) => {
                  const pick = suggest.onKeyDown(e);
                  if (pick) void chooseSuggestion(pick);
                }}
                onBlur={suggest.close}
                placeholder="1234 Oak St, Austin, TX 78704"
                autoComplete={MAPS_API_KEY ? "off" : "street-address"}
                maxLength={300}
                required
                {...(MAPS_API_KEY
                  ? {
                      role: "combobox",
                      "aria-autocomplete": "list" as const,
                      "aria-expanded": suggest.open,
                      "aria-controls": "demo-address-list",
                      "aria-activedescendant":
                        suggest.open && suggest.active >= 0 ? `demo-address-list-option-${suggest.active}` : undefined,
                    }
                  : {})}
              />
            </label>
            {suggest.open && suggest.box && (
              /* The dropdown keeps the exact look it has in the customer flow. */
              <div className="sc-root sc-embed">
                <AddressSuggestions
                  id="demo-address-list"
                  suggestions={suggest.suggestions}
                  active={suggest.active}
                  box={suggest.box}
                  onChoose={(item) => void chooseSuggestion(item)}
                  onHover={suggest.setActive}
                />
              </div>
            )}
          </div>
          <label className="ui-label">
            Customer name
            <input
              className="ui-input ui-landing-field-input"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Jane Doe"
              autoComplete="name"
              maxLength={200}
              required
            />
          </label>
          <div className="grid grid-cols-2 gap-4">
            <YesNo label="In Austin" value={inAustin} onChange={setInAustin} />
            <YesNo label="Has solar" value={hasSolar} onChange={setHasSolar} />
          </div>
        </div>
        {error && (
          <p className="ui-banner ui-banner-error mt-4" role="alert">
            {error}
          </p>
        )}
        <div className="ui-landing-actions mt-auto">
          <button type="submit" className="ui-button w-full" disabled={!ready || submitting}>
            {submitting ? (
              <>
                <Spinner /> Creating...
              </>
            ) : (
              "Create customer link"
            )}
          </button>
        </div>
      </form>
    </section>
  );
}
