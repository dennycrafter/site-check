"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { Banner, Button, Spinner } from "@/components/ui";

const inputClass =
  "mt-1 block min-h-12 w-full rounded-xl border border-gray-300 px-4 text-base text-gray-900 placeholder:text-gray-400 focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/30";

export function StartForm() {
  const router = useRouter();
  const [address, setAddress] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const ready = address.trim().length >= 5;

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!ready || submitting) return;
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch("/api/homes", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ address: address.trim() }),
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
        <span className="text-base font-medium text-gray-900">Home address</span>
        <input
          className={inputClass}
          value={address}
          onChange={(e) => setAddress(e.target.value)}
          autoComplete="street-address"
          placeholder="1234 Oak St, Austin, TX 78704"
          required
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
  );
}
