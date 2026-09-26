"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { Banner, Button, Spinner } from "@/components/ui";

const inputClass =
  "mt-1 block min-h-12 w-full rounded-xl border border-gray-300 px-4 text-base text-gray-900 placeholder:text-gray-400 focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/30";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const START_ERROR = "Could not start. Please try again.";

export type Prefill = {
  name?: string;
  email?: string;
  austin?: boolean;
  solar?: boolean;
  ref?: string;
  address?: string;
};

type Mode = "auto" | "details" | "address";

async function createHome(body: Record<string, unknown>): Promise<string> {
  const res = await fetch("/api/homes", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || !data.id) throw new Error(data.error ?? START_ERROR);
  return data.id as string;
}

function prefillBody(p: Prefill) {
  return {
    customerName: p.name,
    customerEmail: p.email,
    inAustin: p.austin,
    hasSolar: p.solar,
    externalRef: p.ref,
    address: p.address && p.address.length >= 5 ? p.address : undefined,
  };
}

export function StartForm({ mode: initialMode, prefill }: { mode: Mode; prefill: Prefill }) {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>(initialMode);
  const [name, setName] = useState(prefill.name ?? "");
  const [email, setEmail] = useState(prefill.email ?? "");
  const [austin, setAustin] = useState<boolean | undefined>(prefill.austin);
  const [solar, setSolar] = useState<boolean | undefined>(prefill.solar);
  const [address, setAddress] = useState(prefill.address ?? "");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const autoStarted = useRef(false);

  useEffect(() => {
    if (initialMode !== "auto" || autoStarted.current) return;
    autoStarted.current = true;
    createHome(prefillBody(prefill)).then(
      (id) => router.replace(`/capture/${id}`),
      (err) => {
        setError(err instanceof Error ? err.message : START_ERROR);
        setMode("details");
      },
    );
  }, [initialMode, prefill, router]);

  const detailsReady =
    name.trim().length > 0 &&
    EMAIL_RE.test(email.trim()) &&
    austin !== undefined &&
    solar !== undefined &&
    (address.trim().length === 0 || address.trim().length >= 5);
  const ready = mode === "details" ? detailsReady : address.trim().length >= 5;

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!ready || submitting) return;
    setSubmitting(true);
    setError(null);
    const body =
      mode === "details"
        ? prefillBody({ name: name.trim(), email: email.trim(), austin, solar, ref: prefill.ref, address: address.trim() })
        : { address: address.trim(), externalRef: prefill.ref };
    try {
      router.push(`/capture/${await createHome(body)}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : START_ERROR);
      setSubmitting(false);
    }
  }

  if (mode === "auto") {
    return (
      <div className="mt-24 flex flex-col items-center gap-4 text-center text-gray-700">
        <Spinner className="h-10 w-10 text-accent" />
        <p className="text-lg font-medium">Setting up your photo check...</p>
      </div>
    );
  }

  return (
    <>
      <h1 className="mt-4 text-2xl font-bold text-gray-900">
        {mode === "details" ? "Check your details" : "Where is the home?"}
      </h1>
      <p className="mt-2 text-base text-gray-600">
        Takes about 5 minutes. You&apos;ll be outside next to your electric meter.
      </p>
      <form onSubmit={onSubmit} className="mt-8 space-y-6">
        {mode === "details" && (
          <>
            <label className="block">
              <span className="text-base font-medium text-gray-900">Full name</span>
              <input
                className={inputClass}
                value={name}
                onChange={(e) => setName(e.target.value)}
                autoComplete="name"
                required
              />
            </label>
            <label className="block">
              <span className="text-base font-medium text-gray-900">Email</span>
              <input
                className={inputClass}
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoComplete="email"
                inputMode="email"
                required
              />
            </label>
            <YesNo label="Is the home in Austin?" value={austin} onChange={setAustin} />
            <YesNo label="Does the home have solar panels?" value={solar} onChange={setSolar} />
          </>
        )}
        <label className="block">
          <span className="text-base font-medium text-gray-900">
            Home address{mode === "details" && <span className="font-normal text-gray-500"> (optional)</span>}
          </span>
          <input
            className={inputClass}
            value={address}
            onChange={(e) => setAddress(e.target.value)}
            autoComplete="street-address"
            placeholder="1234 Oak St, Austin, TX 78704"
            required={mode === "address"}
          />
        </label>
        {error && <Banner tone="error">{error}</Banner>}
        <Button type="submit" disabled={!ready || submitting} className="w-full text-lg">
          {submitting ? (
            <>
              <Spinner /> Starting...
            </>
          ) : (
            "Continue"
          )}
        </Button>
      </form>
    </>
  );
}

function YesNo({
  label,
  value,
  onChange,
}: {
  label: string;
  value: boolean | undefined;
  onChange: (v: boolean) => void;
}) {
  const option = (v: boolean, text: string) => (
    <button
      type="button"
      aria-pressed={value === v}
      onClick={() => onChange(v)}
      className={`min-h-12 flex-1 rounded-xl border text-base font-semibold transition-colors ${
        value === v
          ? "border-accent bg-accent-soft text-accent"
          : "border-gray-300 bg-white text-gray-800 hover:bg-gray-50"
      }`}
    >
      {text}
    </button>
  );
  return (
    <fieldset>
      <legend className="text-base font-medium text-gray-900">{label}</legend>
      <div className="mt-2 flex gap-3">
        {option(true, "Yes")}
        {option(false, "No")}
      </div>
    </fieldset>
  );
}
