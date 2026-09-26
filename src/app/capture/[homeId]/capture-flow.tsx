"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { Outline } from "@/components/outline";
import { Banner, Button, buttonClass, Spinner } from "@/components/ui";
import { captureVideoFrame, prepareUpload } from "@/lib/image";
import { getStep, MAX_ATTEMPTS } from "@/lib/steps";
import type { PhotoStatus } from "@/lib/types";

type StepView = {
  id: string;
  title: string;
  status: PhotoStatus | "pending";
  attempts: number;
  thumbnailUrl: string | null;
};

type HomeData = {
  home: {
    id: string;
    address: string | null;
    status: "in_progress" | "submitted";
    extra_steps: { id: string; instruction: string }[];
  };
  steps: StepView[];
  /** A step id, "question_5", "site_check" or null when everything is done. */
  nextStep: string | null;
};

type PhotoResult = {
  status: PhotoStatus;
  message: string;
  attempt: number;
  nextStep: string | null;
};

type Phase =
  | { kind: "ready" }
  | { kind: "checking"; preview: string }
  | { kind: "result"; result: PhotoResult; preview: string }
  | { kind: "error"; message: string };

type CameraState = "off" | "starting" | "on" | "unavailable";

const NETWORK_ERROR = "We couldn't send your photo. Check your connection and try again.";

async function fetchHome(homeId: string): Promise<HomeData> {
  const res = await fetch(`/api/homes/${homeId}`, { cache: "no-store" });
  const body = await res.json().catch(() => ({}));
  if (res.status === 404) throw new Error("We couldn't find this photo check. Please start again.");
  if (!res.ok) throw new Error(body.error ?? "Could not load your photo check.");
  return body as HomeData;
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export function CaptureFlow({ homeId }: { homeId: string }) {
  const [data, setData] = useState<HomeData | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [phase, setPhase] = useState<Phase>({ kind: "ready" });
  const [camera, setCamera] = useState<CameraState>("off");
  const [aspect, setAspect] = useState(3 / 4);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [continuing, setContinuing] = useState(false);
  const [keeping, setKeeping] = useState(false);
  const [keepError, setKeepError] = useState<string | null>(null);

  const streamRef = useRef<MediaStream | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const load = useCallback(async () => {
    try {
      setData(await fetchHome(homeId));
      setLoadError(null);
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : "Could not load your photo check.");
    }
  }, [homeId]);

  useEffect(() => {
    let cancelled = false;
    fetchHome(homeId).then(
      (fresh) => !cancelled && setData(fresh),
      (err) => !cancelled && setLoadError(err instanceof Error ? err.message : "Could not load your photo check."),
    );
    return () => {
      cancelled = true;
    };
  }, [homeId]);

  useEffect(() => {
    return () => streamRef.current?.getTracks().forEach((t) => t.stop());
  }, []);

  const allDone = data !== null && (data.nextStep === null || data.home.status === "submitted");
  useEffect(() => {
    if (allDone) streamRef.current?.getTracks().forEach((t) => t.stop());
  }, [allDone]);

  const attachVideo = useCallback((el: HTMLVideoElement | null) => {
    videoRef.current = el;
    if (el && streamRef.current && el.srcObject !== streamRef.current) {
      el.srcObject = streamRef.current;
      el.play().catch(() => {});
    }
  }, []);

  async function startCamera() {
    if (!navigator.mediaDevices?.getUserMedia) {
      setCamera("unavailable");
      return;
    }
    setCamera("starting");
    try {
      streamRef.current = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: "environment" }, width: { ideal: 1920 }, height: { ideal: 1080 } },
        audio: false,
      });
      setCamera("on");
    } catch {
      setCamera("unavailable");
    }
  }

  async function sendPhoto(step: string, base64: string, preview: string) {
    setPhase({ kind: "checking", preview });
    setKeepError(null);
    let res: Response;
    let body: Partial<PhotoResult> & { error?: string };
    try {
      res = await fetch("/api/photos", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ homeId, step, imageBase64: base64 }),
      });
      body = await res.json().catch(() => ({}));
    } catch {
      setPhase({ kind: "error", message: NETWORK_ERROR });
      return;
    }
    if (res.status === 409) {
      await load();
      setPhase({ kind: "ready" });
      return;
    }
    if (!res.ok) {
      setPhase({ kind: "error", message: body.error ?? NETWORK_ERROR });
      return;
    }
    const result = body as PhotoResult;
    setPhase({ kind: "result", result, preview });
    if (result.status === "accepted") {
      const [fresh] = await Promise.allSettled([fetchHome(homeId), sleep(1000)]);
      if (fresh.status === "fulfilled") setData(fresh.value);
      else await load();
      setPhase({ kind: "ready" });
    }
  }

  function onShutter(step: string) {
    const video = videoRef.current;
    if (!video || !video.videoWidth || phase.kind !== "ready") return;
    const { base64, dataUrl } = captureVideoFrame(video);
    sendPhoto(step, base64, dataUrl);
  }

  async function onFile(step: string, file: File) {
    try {
      const { base64, dataUrl } = await prepareUpload(file);
      await sendPhoto(step, base64, dataUrl);
    } catch {
      setPhase({ kind: "error", message: "We couldn't read that file. Try a JPG or PNG photo." });
    }
  }

  async function keepPhoto(step: string) {
    setKeeping(true);
    setKeepError(null);
    try {
      const res = await fetch("/api/photos/keep", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ homeId, step }),
      });
      if (!res.ok && res.status !== 409) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? NETWORK_ERROR);
      }
      await load();
      setPhase({ kind: "ready" });
    } catch (err) {
      setKeepError(err instanceof Error ? err.message : NETWORK_ERROR);
    } finally {
      setKeeping(false);
    }
  }

  async function continueAfterResult() {
    setContinuing(true);
    await load();
    setContinuing(false);
    setPhase({ kind: "ready" });
  }

  async function submitHome() {
    setSubmitting(true);
    setSubmitError(null);
    try {
      const res = await fetch(`/api/homes/${homeId}/submit`, { method: "POST" });
      const body = await res.json().catch(() => ({}));
      if (res.status === 409) {
        await load();
        return;
      }
      if (!res.ok) throw new Error(body.error ?? "Could not submit. Please try again.");
      await load();
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : "Could not submit. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  if (loadError && !data) {
    return (
      <Shell>
        <div className="mt-10 space-y-4">
          <Banner tone="error">{loadError}</Banner>
          <div className="flex gap-3">
            <Button onClick={load}>Try again</Button>
            <Link href="/start" className={buttonClass("secondary")}>
              Start over
            </Link>
          </div>
        </div>
      </Shell>
    );
  }

  if (!data) {
    return (
      <Shell>
        <div className="mt-16 flex flex-col items-center gap-3 text-gray-600">
          <Spinner className="h-8 w-8 text-accent" />
          <p>Loading your photo check...</p>
        </div>
      </Shell>
    );
  }

  if (data.home.status === "submitted") {
    return (
      <Shell>
        <div className="mt-16 text-center">
          <CheckIcon className="mx-auto h-16 w-16 text-pass" />
          <h1 className="mt-4 text-2xl font-bold text-gray-900">Thanks! A Base surveyor will review your home.</h1>
          <p className="mt-3 text-gray-600">
            We have everything we need from you for now. The survey team will be in touch.
          </p>
        </div>
      </Shell>
    );
  }

  if (data.nextStep === "question_5") {
    return <Question5 homeId={homeId} onDone={load} />;
  }

  if (data.nextStep === "site_check") {
    return <SiteCheckScreen homeId={homeId} onDone={load} />;
  }

  if (data.nextStep === null) {
    return (
      <Shell>
        <h1 className="mt-4 text-2xl font-bold text-gray-900">All photos done</h1>
        <p className="mt-2 text-gray-600">Check your photos below, then submit them to the survey team.</p>
        <ul className="mt-6 divide-y divide-gray-100 rounded-2xl border border-gray-200">
          {data.steps.map((s) => (
            <li key={s.id} className="flex items-center gap-4 p-3">
              {s.thumbnailUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={s.thumbnailUrl} alt={s.title} className="h-16 w-16 rounded-lg object-cover" />
              ) : (
                <div className="h-16 w-16 rounded-lg bg-gray-100" />
              )}
              <div className="min-w-0 flex-1">
                <p className="font-semibold text-gray-900">{s.title}</p>
                <p className={`text-sm ${s.status === "accepted" ? "text-pass" : "text-gray-500"}`}>
                  {s.status === "accepted" ? "Looks good" : "A surveyor will check this one"}
                </p>
              </div>
            </li>
          ))}
        </ul>
        {submitError && (
          <div className="mt-4">
            <Banner tone="error">{submitError}</Banner>
          </div>
        )}
        <Button onClick={submitHome} disabled={submitting} className="mt-6 w-full text-lg">
          {submitting ? (
            <>
              <Spinner /> Submitting...
            </>
          ) : (
            "Submit"
          )}
        </Button>
      </Shell>
    );
  }

  const stepId = data.nextStep;
  const step = getStep(stepId, data.home.extra_steps);
  if (!step) {
    return (
      <Shell>
        <div className="mt-10 space-y-4">
          <Banner tone="error">Something went wrong loading this step.</Banner>
          <Button onClick={load}>Try again</Button>
        </div>
      </Shell>
    );
  }
  const index = Math.max(0, data.steps.findIndex((s) => s.id === stepId));
  const total = data.steps.length;
  const preview = phase.kind === "checking" || phase.kind === "result" ? phase.preview : null;
  const canCapture = phase.kind === "ready";

  return (
    <Shell>
      <div className="mt-2">
        <div className="flex items-center justify-between text-sm font-medium text-gray-600">
          <span>
            Step {index + 1} of {total}
          </span>
          <span className="truncate pl-4">{data.home.address}</span>
        </div>
        <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-gray-200">
          <div
            className="h-full rounded-full bg-accent transition-all duration-500"
            style={{ width: `${((index + (phase.kind === "result" && phase.result.status !== "retake" ? 1 : 0)) / total) * 100}%` }}
          />
        </div>
      </div>

      <h1 className="mt-4 text-xl font-bold text-gray-900 sm:text-2xl">{step.title}</h1>
      <p className="mt-1 text-base text-gray-700">{step.instruction}</p>

      <div
        className="relative mx-auto mt-4 overflow-hidden rounded-2xl bg-gray-900"
        style={{ aspectRatio: `${aspect}`, width: `min(100%, calc(55vh * ${aspect}))` }}
      >
        {camera === "on" && (
          <video
            ref={attachVideo}
            autoPlay
            playsInline
            muted
            onLoadedMetadata={(e) => {
              const v = e.currentTarget;
              if (v.videoWidth && v.videoHeight) setAspect(v.videoWidth / v.videoHeight);
            }}
            className="absolute inset-0 h-full w-full object-cover"
          />
        )}
        <Outline id={step.outline} aspect={aspect} />

        {camera !== "on" && !preview && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-gray-900/60 p-6 text-center">
            {camera === "unavailable" ? (
              <>
                <p className="text-base font-medium text-white">Camera not available. You can upload photos instead.</p>
                <Button onClick={() => fileRef.current?.click()} disabled={!canCapture}>
                  Upload a photo
                </Button>
              </>
            ) : (
              <Button onClick={startCamera} disabled={camera === "starting"}>
                {camera === "starting" ? (
                  <>
                    <Spinner /> Starting camera...
                  </>
                ) : (
                  "Start camera"
                )}
              </Button>
            )}
          </div>
        )}

        {preview && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={preview} alt="Your photo" className="absolute inset-0 h-full w-full bg-gray-900 object-contain" />
        )}

        {phase.kind === "checking" && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-black/50 text-white">
            <Spinner className="h-10 w-10" />
            <p className="text-lg font-semibold">Checking your photo...</p>
          </div>
        )}

        {phase.kind === "result" && phase.result.status === "accepted" && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-black/40 text-white">
            <CheckIcon className="h-16 w-16 rounded-full bg-pass p-3" />
            <p className="text-xl font-bold">Looks good</p>
          </div>
        )}
      </div>

      <div aria-live="polite" className="mt-4 min-h-0">
        {phase.kind === "result" && phase.result.status === "retake" && (
          <div className="space-y-3">
            <Banner tone="warning">
              <p className="font-semibold">{phase.result.message}</p>
            </Banner>
            <div className="flex items-center justify-between gap-3">
              <Button onClick={() => setPhase({ kind: "ready" })} disabled={keeping} className="flex-1">
                Retake
              </Button>
              <span className="text-sm text-gray-500">
                Attempt {phase.result.attempt + 1} of {MAX_ATTEMPTS}
              </span>
            </div>
            <button
              type="button"
              onClick={() => keepPhoto(stepId)}
              disabled={keeping}
              className="flex min-h-12 w-full items-center justify-center gap-2 text-base font-semibold text-gray-600 underline underline-offset-4 hover:text-gray-900 disabled:opacity-60"
            >
              {keeping ? (
                <>
                  <Spinner /> Saving...
                </>
              ) : (
                "Use this photo anyway"
              )}
            </button>
            {keepError && <p className="text-center text-sm text-fail">{keepError}</p>}
          </div>
        )}
        {phase.kind === "result" &&
          (phase.result.status === "check_failed" || phase.result.status === "accepted_after_max_attempts") && (
            <div className="space-y-3">
              <Banner tone="neutral">{phase.result.message}</Banner>
              <Button onClick={continueAfterResult} disabled={continuing} className="w-full">
                {continuing ? <Spinner /> : "Continue"}
              </Button>
            </div>
          )}
        {phase.kind === "error" && (
          <div className="space-y-3">
            <Banner tone="error">{phase.message}</Banner>
            <Button onClick={() => setPhase({ kind: "ready" })} className="w-full">
              Try again
            </Button>
          </div>
        )}
      </div>

      {canCapture && (
        <div className="mt-2 flex flex-col items-center gap-3">
          {camera === "on" && (
            <button
              type="button"
              onClick={() => onShutter(stepId)}
              aria-label="Take photo"
              className="h-20 w-20 rounded-full border-4 border-accent bg-white shadow-lg ring-4 ring-white transition-transform active:scale-95"
            />
          )}
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            className="min-h-12 px-4 text-base font-semibold text-accent underline-offset-4 hover:underline"
          >
            Upload a photo instead
          </button>
        </div>
      )}

      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          e.target.value = "";
          if (file) onFile(stepId, file);
        }}
      />
    </Shell>
  );
}

type SiteCheckState = { kind: "running" } | { kind: "covered" } | { kind: "extra"; count: number } | { kind: "error" };

function SiteCheckScreen({ homeId, onDone }: { homeId: string; onDone: () => Promise<void> }) {
  const [state, setState] = useState<SiteCheckState>({ kind: "running" });
  const [run, setRun] = useState(0);
  const [continuing, setContinuing] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      let res: Response;
      let body: { status?: string; covered?: boolean; extraSteps?: unknown[] };
      try {
        res = await fetch(`/api/homes/${homeId}/site-check`, { method: "POST" });
        body = await res.json().catch(() => ({}));
      } catch {
        if (!cancelled) setState({ kind: "error" });
        return;
      }
      if (cancelled) return;
      if (res.status === 409 || (res.ok && body.status === "failed")) return onDone();
      if (!res.ok) return setState({ kind: "error" });
      if (body.covered) {
        setState({ kind: "covered" });
        await sleep(1000);
        if (!cancelled) await onDone();
        return;
      }
      setState({ kind: "extra", count: body.extraSteps?.length ?? 1 });
    })();
    return () => {
      cancelled = true;
    };
  }, [homeId, onDone, run]);

  return (
    <Shell>
      <div aria-live="polite" className="mt-16 flex flex-col items-center gap-4 text-center">
        {state.kind === "running" && (
          <>
            <Spinner className="h-10 w-10 text-accent" />
            <p className="text-lg font-semibold text-gray-900">Checking your whole site...</p>
            <p className="text-sm text-gray-500">This takes a few seconds. Please stay by your meter.</p>
          </>
        )}
        {state.kind === "covered" && (
          <>
            <CheckIcon className="h-16 w-16 rounded-full bg-pass p-3 text-white" />
            <p className="text-lg font-semibold text-gray-900">All set. Your photos cover everything.</p>
          </>
        )}
        {state.kind === "extra" && (
          <div className="w-full space-y-4 text-left">
            <Banner tone="warning">
              <p className="font-semibold">
                Almost done. We need {state.count === 1 ? "1 more photo" : `${state.count} more photos`}.
              </p>
            </Banner>
            <Button
              onClick={async () => {
                setContinuing(true);
                await onDone();
              }}
              disabled={continuing}
              className="w-full text-lg"
            >
              {continuing ? <Spinner /> : "Continue"}
            </Button>
          </div>
        )}
        {state.kind === "error" && (
          <div className="w-full space-y-4 text-left">
            <Banner tone="error">We couldn&apos;t check your site. Check your connection and try again.</Banner>
            <Button
              onClick={() => {
                setState({ kind: "running" });
                setRun((n) => n + 1);
              }}
              className="w-full"
            >
              Try again
            </Button>
          </div>
        )}
      </div>
    </Shell>
  );
}

function Question5({ homeId, onDone }: { homeId: string; onDone: () => Promise<void> }) {
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function answer(value: "yes" | "no" | "not_sure") {
    setBusy(value);
    setError(null);
    try {
      const res = await fetch(`/api/homes/${homeId}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ panelSameWallAnswer: value }),
      });
      if (!res.ok) throw new Error();
      await onDone();
    } catch {
      setError("Could not save your answer. Please try again.");
      setBusy(null);
    }
  }

  const options: Array<["yes" | "no" | "not_sure", string]> = [
    ["yes", "Yes"],
    ["no", "No"],
    ["not_sure", "Not sure"],
  ];

  return (
    <Shell>
      <h1 className="mt-6 text-2xl font-bold text-gray-900">One quick question</h1>
      <p className="mt-2 text-gray-600">Your breaker box looks like it is inside the house.</p>
      <p className="mt-6 text-lg font-medium text-gray-900">
        Is your breaker box on the other side of the same wall as your meter?
      </p>
      <div className="mt-4 grid gap-3">
        {options.map(([value, label]) => (
          <Button
            key={value}
            variant="secondary"
            onClick={() => answer(value)}
            disabled={busy !== null}
            className="min-h-14 text-lg"
          >
            {busy === value ? <Spinner /> : label}
          </Button>
        ))}
      </div>
      {error && (
        <div className="mt-4">
          <Banner tone="error">{error}</Banner>
        </div>
      )}
    </Shell>
  );
}

function Shell({ children }: { children: ReactNode }) {
  return (
    <main className="mx-auto w-full max-w-lg flex-1 px-4 pb-10 pt-4 sm:px-5">
      <Link href="/" className="text-sm font-semibold text-accent">
        SiteCheck
      </Link>
      {children}
    </main>
  );
}

function CheckIcon({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={3} className={className} aria-hidden="true">
      <path d="M5 13l4 4L19 7" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
