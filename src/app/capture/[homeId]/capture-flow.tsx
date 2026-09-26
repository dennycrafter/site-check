"use client";

import { useRef, useState } from "react";
import { Banner, Button, Spinner } from "@/components/ui";
import { prepareUpload } from "@/lib/image";
import { STEP_BY_ID } from "@/lib/steps";

type Result = { status: string; message: string; attempt: number; nextStep: string | null };

export function CaptureFlow({ homeId }: { homeId: string }) {
  const step = STEP_BY_ID.main_disconnect_closeup;
  const fileRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<Result | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function onFile(file: File) {
    setBusy(true);
    setError(null);
    try {
      const { base64 } = await prepareUpload(file);
      const res = await fetch("/api/photos", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ homeId, step: step.id, imageBase64: base64 }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Upload failed");
      setResult(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="mx-auto w-full max-w-lg space-y-4 px-5 py-6">
      <h1 className="text-2xl font-bold">{step.title}</h1>
      <p className="text-gray-600">{step.instruction}</p>
      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          e.target.value = "";
          if (f) onFile(f);
        }}
      />
      <Button onClick={() => fileRef.current?.click()} disabled={busy} className="w-full">
        {busy ? (
          <>
            <Spinner /> Checking your photo...
          </>
        ) : (
          "Upload a photo"
        )}
      </Button>
      {result && (
        <Banner tone={result.status === "accepted" ? "success" : result.status === "retake" ? "warning" : "neutral"}>
          {result.message} (attempt {result.attempt}, status {result.status})
        </Banner>
      )}
      {error && <Banner tone="error">{error}</Banner>}
    </main>
  );
}
