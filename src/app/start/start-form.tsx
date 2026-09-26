"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { Banner, Button, Spinner } from "@/components/ui";

function YesNo({
  label,
  value,
  onChange,
}: {
  label: string;
  value: boolean | null;
  onChange: (v: boolean) => void;
}) {
  const option = (v: boolean, text: string) => (
    <button
      type="button"
      role="radio"
      aria-checked={value === v}
      onClick={() => onChange(v)}
      className={`min-h-14 flex-1 rounded-xl border-2 text-lg font-semibold transition-colors ${
        value === v
          ? "border-accent bg-accent-soft text-accent"
          : "border-gray-200 bg-white text-gray-700 hover:border-gray-300"
      }`}
    >
      {text}
    </button>
  );
  return (
    <fieldset>
      <legend className="mb-2 text-base font-medium text-gray-900">{label}</legend>
      <div role="radiogroup" aria-label={label} className="flex gap-3">
        {option(true, "Yes")}
        {option(false, "No")}
      </div>
    </fieldset>
  );
}

const inputClass =
  "mt-1 block min-h-12 w-full rounded-xl border border-gray-300 px-4 text-base text-gray-900 placeholder:text-gray-400 focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/30";

export function StartForm() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [inAustin, setInAustin] = useState<boolean | null>(null);
  const [hasSolar, setHasSolar] = useState<boolean | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const ready = name.trim() && /\S+@\S+\.\S+/.test(email.trim()) && inAustin !== null && hasSolar !== null;

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
          customerName: name.trim(),
          customerEmail: email.trim(),
          inAustin,
          hasSolar,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.id) throw new Error(data.error ?? "Could not start. Please try again.");
      router.push(`/capture/${data.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not start. Please try again.");
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="mt-8 space-y-6">
      <label className="block">
        <span className="text-base font-medium text-gray-900">Full name</span>
        <input
          className={inputClass}
          value={name}
          onChange={(e) => setName(e.target.value)}
          autoComplete="name"
          placeholder="Jordan Rivera"
          required
        />
      </label>
      <label className="block">
        <span className="text-base font-medium text-gray-900">Email</span>
        <input
          className={inputClass}
          type="email"
          inputMode="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          autoComplete="email"
          placeholder="jordan@example.com"
          required
        />
      </label>
      <YesNo label="Is the home in Austin?" value={inAustin} onChange={setInAustin} />
      <YesNo label="Does the home have solar panels?" value={hasSolar} onChange={setHasSolar} />
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
  );
}
