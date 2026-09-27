"use client";

import { useCallback, useEffect, useRef, useState, type ButtonHTMLAttributes, type ReactNode, type RefObject } from "react";
import { HelpButton, HelpSheet } from "@/components/help-sheet";
import { Outline } from "@/components/outline";
import { Spinner } from "@/components/ui";
import { useDialog } from "@/components/use-dialog";
import { captureVideoFrame, prepareUpload } from "@/lib/image";
import { getStep, MAX_ATTEMPTS } from "@/lib/steps";
import type { PhotoStatus, SetupType } from "@/lib/types";
import "@/styles/customer-flow.css";

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
    setup_type: SetupType;
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
  canKeep?: boolean;
};

type Local =
  | { kind: "ready" }
  | { kind: "confirm"; preview: string; base64: string }
  | { kind: "checking"; preview: string }
  | { kind: "accepted"; preview: string }
  | { kind: "retake"; preview: string; result: PhotoResult }
  | { kind: "held"; preview: string; result: PhotoResult }
  | { kind: "error"; message: string };

type Intro = "welcome" | "meter" | "breaker";

/** photo replaces the atlas tile when the atlas has no matching example. */
type Guide = { image: number; guide: number; angle: string; photo?: string };

const NETWORK_ERROR = "We couldn't send your photo. Check your connection and try again.";
const FILE_ERROR = "We couldn't read that file. Try a JPG or PNG photo.";

const SHOWN: Record<string, string> = {
  meter_area_wide: "Stand about 10 steps back. Show your meter and the whole wall around it.",
  left_of_meter: "Step back. Keep the meter at the right edge of the photo.",
  right_of_meter: "Step back. Keep the meter at the left edge of the photo.",
  panel_open: "Open the breaker box door. Show all the switches.",
  main_disconnect_closeup:
    "Open the lid. Get close enough that the number, like 150 or 200, is readable. If there is no big switch at the top of your breaker box, look in the gray box next to your meter.",
};

const GUIDE: Record<string, Guide> = {
  meter_closeup: { image: 1, guide: 0, angle: "Stand straight in front of the meter." },
  meter_area_wide: { image: 2, guide: 1, angle: "Walk back only as far as it is safe." },
  left_of_meter: { image: 4, guide: 2, angle: "Keep the meter at the right edge." },
  right_of_meter: { image: 3, guide: 3, angle: "Keep the meter at the left edge." },
  adjacent_wall: { image: 5, guide: 4, angle: "Stand back to fit the whole wall." },
  panel_wide: { image: 6, guide: 5, angle: "Stand straight in front of the panel." },
  panel_open: {
    image: 6,
    guide: 5,
    photo: "/find-breaker.webp",
    angle: "Open only the hinged door. Never remove screws or covers.",
  },
  main_disconnect_closeup: {
    image: 7,
    guide: 6,
    angle: "Open only the hinged door. Never remove screws or covers.",
  },
};

const FIND_COPY = {
  meter: {
    title: "Find your meter",
    lead: "Look on the outside wall of your home.",
    tip: "Keep the meter cover closed.",
    image: "/find-meter.webp",
    alt: "Person photographing an electric meter on the outside wall of a house",
    action: "Continue",
  },
  breaker: {
    title: "Find your breaker panel",
    lead: "It is often on an outside wall near the meter, or in a garage or utility room.",
    tip: "Leave the inner cover in place.",
    image: "/find-breaker.webp",
    alt: "Person photographing an open breaker panel in a garage",
    action: "I found it",
  },
} as const;

const COMBO_BREAKER_COPY = {
  title: "Find your main switch",
  lead: "It is under the lid below your meter.",
  image: "/find-meter.webp",
  alt: "Person photographing an all-in-one meter unit on the outside wall of a house",
} as const;

const GENERAL_HELP = [
  "Stay on this screen. It only takes a moment.",
  "Check your internet connection if it seems stuck.",
  "You can close this page and open your link again later.",
] as const;

const SCREEN_HELP = {
  welcome: [
    "You will take a few photos of your meter and breaker box.",
    "Daylight works best, so go outside while it is light if you can.",
    "You can stop and open your link again later.",
  ],
  meter: [
    "Meters are usually on an outside wall, near where the power line comes in.",
    "Look for a box with a round glass cover or a small screen.",
    "Keep the meter cover closed.",
  ],
  breaker: [
    "Look in the garage, a utility room, or on an outside wall near the meter.",
    "It is a gray metal box with a hinged door.",
    "Leave the inner cover in place.",
  ],
  combo: [
    "Your main switch is under the lid below your meter.",
    "Open only the hinged lid.",
    "Leave the inner cover in place.",
  ],
  review: [
    "Use the arrows to check each photo.",
    "Photos marked for a surveyor are fine to send.",
    "Tap Submit when you are ready.",
  ],
  question: [
    "Think about which outside wall your meter is on.",
    "If the breaker box is on the inside of that same wall, choose Yes.",
    "Not sure is a fine answer.",
  ],
} as const;

const PANEL_STEPS = new Set(["panel_wide", "panel_open", "main_disconnect_closeup"]);

function isPanelStep(id: string) {
  return PANEL_STEPS.has(id);
}

function shouldWelcome(data: HomeData) {
  if (data.home.status === "submitted" || !data.nextStep) return false;
  if (data.nextStep === "question_5" || data.nextStep === "site_check") return false;
  return data.steps.every((step) => step.status === "pending");
}

function shouldBreaker(data: HomeData) {
  if (!data.nextStep || !isPanelStep(data.nextStep)) return false;
  return !data.steps.some((step) => isPanelStep(step.id) && step.status !== "pending");
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

async function fetchHome(homeId: string): Promise<HomeData> {
  const res = await fetch(`/api/homes/${homeId}`, { cache: "no-store" });
  const body = await res.json().catch(() => ({}));
  if (res.status === 404) throw new Error("We couldn't find this photo check. Please start again.");
  if (!res.ok) throw new Error(body.error ?? "Could not load your photo check.");
  return body as HomeData;
}

export function CaptureFlow({ homeId }: { homeId: string }) {
  const [data, setData] = useState<HomeData | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [local, setLocal] = useState<Local>({ kind: "ready" });
  const [introChoice, setIntroChoice] = useState<Intro | null>(null);
  const [introLocked, setIntroLocked] = useState(false);
  const [safetyOpen, setSafetyOpen] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [cameraOpen, setCameraOpen] = useState(false);
  const [cameraReady, setCameraReady] = useState(false);
  const [cameraError, setCameraError] = useState("");
  const [cameraGeneration, setCameraGeneration] = useState(0);
  const [stageAspect, setStageAspect] = useState<number | null>(null);
  const [keeping, setKeeping] = useState(false);
  const [keepError, setKeepError] = useState<string | null>(null);
  const [reviewIndex, setReviewIndex] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const headingRef = useRef<HTMLHeadingElement>(null);
  const safetyPanel = useRef<HTMLDivElement>(null);
  const safetyHeading = useRef<HTMLHeadingElement>(null);
  const photoPanel = useRef<HTMLDivElement>(null);
  const photoHeading = useRef<HTMLHeadingElement>(null);
  const cameraPanel = useRef<HTMLDivElement>(null);
  const cameraHeading = useRef<HTMLHeadingElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const cameraSession = useRef(0);
  const suppressPhotoFocusRestore = useRef(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const alive = useRef(true);
  const sendToken = useRef(0);

  const closeSafety = useCallback(() => setSafetyOpen(false), []);
  const closePicker = useCallback(() => setPickerOpen(false), []);
  const closeCamera = useCallback(() => {
    cameraSession.current += 1;
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
    setCameraReady(false);
    setCameraError("");
    setCameraOpen(false);
  }, []);

  useDialog(safetyOpen, safetyPanel, safetyHeading, closeSafety);
  useDialog(pickerOpen, photoPanel, photoHeading, closePicker, suppressPhotoFocusRestore);
  useDialog(cameraOpen, cameraPanel, cameraHeading, closeCamera);

  const load = useCallback(async () => {
    try {
      const fresh = await fetchHome(homeId);
      setData(fresh);
      setLoadError(null);
      return fresh;
    } catch (err) {
      const message = err instanceof Error ? err.message : "Could not load your photo check.";
      setLoadError(message);
      return null;
    }
  }, [homeId]);

  useEffect(() => {
    let cancelled = false;
    fetchHome(homeId).then(
      (fresh) => {
        if (!cancelled) setData(fresh);
      },
      (err) => {
        if (!cancelled) setLoadError(err instanceof Error ? err.message : "Could not load your photo check.");
      },
    );
    return () => {
      cancelled = true;
    };
  }, [homeId]);

  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
      streamRef.current?.getTracks().forEach((track) => track.stop());
    };
  }, []);

  useEffect(() => {
    const video = videoRef.current;
    const stream = streamRef.current;
    if (!cameraOpen || !video || !stream) return;
    if (video.srcObject !== stream) video.srcObject = stream;
    let cancelled = false;
    const markReady = () => {
      if (!cancelled) setCameraReady(true);
    };
    video.addEventListener("playing", markReady);
    video.play().catch(() => {
      if (!cancelled && video.paused) setCameraError("The camera preview couldn't start. Try again.");
    });
    return () => {
      cancelled = true;
      video.removeEventListener("playing", markReady);
    };
  }, [cameraOpen, cameraGeneration]);

  useEffect(() => {
    const stage = stageRef.current;
    if (!cameraOpen || !stage) return;
    const measure = () => {
      if (stage.clientWidth && stage.clientHeight) setStageAspect(stage.clientWidth / stage.clientHeight);
    };
    const observer = new ResizeObserver(measure);
    observer.observe(stage);
    return () => observer.disconnect();
  }, [cameraOpen]);

  const intro = !data ? null : introLocked ? introChoice : shouldWelcome(data) ? "welcome" : shouldBreaker(data) ? "breaker" : null;
  const onReview = data?.home.status !== "submitted" && data?.nextStep === null && intro === null;

  useEffect(() => {
    if (!onReview) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
      if (event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement) return;
      event.preventDefault();
      setReviewIndex((current) => {
        const total = data?.steps.length ?? 1;
        return event.key === "ArrowLeft" ? (current + total - 1) % total : (current + 1) % total;
      });
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onReview, data?.steps.length]);

  const modalOpen = safetyOpen || pickerOpen || cameraOpen;
  const viewKey = `${intro ?? "flow"}:${data?.nextStep ?? ""}:${local.kind}:${data?.home.status ?? ""}`;
  useEffect(() => {
    if (modalOpen) return;
    headingRef.current?.closest(".sc-content")?.scrollTo(0, 0);
    headingRef.current?.focus({ preventScroll: true });
  }, [viewKey, modalOpen]);

  function goIntro(next: Intro | null) {
    setIntroChoice(next);
    setIntroLocked(true);
    setLocal({ kind: "ready" });
    setSafetyOpen(false);
    setPickerOpen(false);
    setKeepError(null);
    closeCamera();
  }

  function handoff(fromStep: string, fresh: HomeData) {
    setData(fresh);
    setLocal({ kind: "ready" });
    setKeepError(null);
    if (!isPanelStep(fromStep) && fresh.nextStep && isPanelStep(fresh.nextStep)) {
      setIntroChoice("breaker");
      setIntroLocked(true);
    }
  }

  function openCamera() {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    const session = ++cameraSession.current;
    suppressPhotoFocusRestore.current = true;
    setCameraError("");
    setCameraReady(false);
    setPickerOpen(false);
    setCameraOpen(true);
    if (!navigator.mediaDevices?.getUserMedia) {
      setCameraError("The camera couldn't open in this browser. You can choose a photo from your library instead.");
      return;
    }
    navigator.mediaDevices
      .getUserMedia({
        audio: false,
        video: { facingMode: { ideal: "environment" }, width: { ideal: 1920 }, height: { ideal: 1080 } },
      })
      .then((stream) => {
        if (cameraSession.current !== session) {
          stream.getTracks().forEach((track) => track.stop());
          return;
        }
        streamRef.current = stream;
        setCameraGeneration((current) => current + 1);
      })
      .catch((error: unknown) => {
        if (cameraSession.current !== session) return;
        const name = error instanceof DOMException ? error.name : "";
        setCameraError(
          name === "NotAllowedError" || name === "PermissionDeniedError"
            ? "Camera access was blocked. Allow the camera in your browser, then try again."
            : name === "NotFoundError" || name === "DevicesNotFoundError" || name === "OverconstrainedError"
              ? "No camera was found on this device."
              : "The camera couldn't open. You can choose a photo from your library instead.",
        );
      });
  }

  async function onPickedFile(file: File) {
    setPickerOpen(false);
    closeCamera();
    if (file.type && !file.type.startsWith("image/")) {
      setLocal({ kind: "error", message: "Choose a photo, then try again." });
      return;
    }
    if (file.size > 20 * 1024 * 1024) {
      setLocal({ kind: "error", message: "This photo is too large. Choose one under 20 MB." });
      return;
    }
    try {
      const { base64, dataUrl } = await prepareUpload(file);
      if (!alive.current) return;
      setLocal({ kind: "confirm", preview: dataUrl, base64 });
    } catch {
      if (!alive.current) return;
      setLocal({ kind: "error", message: FILE_ERROR });
    }
  }

  function capture() {
    const video = videoRef.current;
    if (!video?.videoWidth || !video.videoHeight) {
      setCameraError("The camera isn't ready yet. Try again.");
      return;
    }
    try {
      const stage = stageRef.current;
      const crop = stage?.clientWidth && stage.clientHeight ? stage.clientWidth / stage.clientHeight : undefined;
      const shot = captureVideoFrame(video, { crop });
      closeCamera();
      setLocal({ kind: "confirm", preview: shot.dataUrl, base64: shot.base64 });
    } catch {
      setCameraError("We couldn't save that picture. Try again.");
    }
  }

  async function sendPhoto(step: string, base64: string, preview: string) {
    const token = ++sendToken.current;
    setLocal({ kind: "checking", preview });
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
      if (token === sendToken.current) setLocal({ kind: "error", message: NETWORK_ERROR });
      return;
    }
    if (!alive.current || token !== sendToken.current) return;
    if (res.status === 409) {
      const fresh = await fetchHome(homeId).catch(() => null);
      if (!alive.current || !fresh) return;
      setData(fresh);
      setIntroLocked(false);
      setLocal({ kind: "ready" });
      return;
    }
    if (!res.ok || !body.status || !body.message || body.attempt == null) {
      setLocal({ kind: "error", message: body.error ?? NETWORK_ERROR });
      return;
    }
    const result = body as PhotoResult;
    if (result.status === "retake") {
      setLocal({ kind: "retake", preview, result });
      const fresh = await fetchHome(homeId).catch(() => null);
      if (alive.current && fresh) setData(fresh);
      return;
    }
    if (result.status === "accepted") {
      setLocal({ kind: "accepted", preview });
      await sleep(900);
      if (!alive.current || token !== sendToken.current) return;
      try {
        handoff(step, await fetchHome(homeId));
      } catch {
        setLocal({ kind: "error", message: "Your photo was saved, but the next step didn't load. Try again." });
      }
      return;
    }
    setLocal({ kind: "held", preview, result });
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
      const body = await res.json().catch(() => ({}));
      if (!res.ok && res.status !== 409) throw new Error(body.error ?? NETWORK_ERROR);
      const fresh = await fetchHome(homeId);
      if (!alive.current) return;
      handoff(step, fresh);
    } catch (err) {
      if (alive.current) setKeepError(err instanceof Error ? err.message : NETWORK_ERROR);
    } finally {
      if (alive.current) setKeeping(false);
    }
  }

  async function continueHeld(step: string) {
    try {
      const fresh = await fetchHome(homeId);
      if (!alive.current) return;
      handoff(step, fresh);
    } catch {
      if (!alive.current) return;
      setLocal({ kind: "error", message: "Your photo was saved, but the next step didn't load. Try again." });
    }
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

  const stepId = data?.nextStep && data.nextStep !== "question_5" && data.nextStep !== "site_check" ? data.nextStep : null;
  const step = data && stepId ? getStep(stepId, data.home.extra_steps) : null;
  const guide = step ? GUIDE[step.id] : undefined;

  let back: (() => void) | null = null;
  if (data && step && intro === null) {
    if (local.kind === "confirm" || local.kind === "retake" || local.kind === "held" || local.kind === "error") {
      back = () => {
        setKeepError(null);
        setLocal({ kind: "ready" });
      };
    } else if (local.kind === "ready") {
      const firstPanel = data.steps.find((item) => isPanelStep(item.id));
      if (firstPanel && step.id === firstPanel.id) back = () => goIntro("breaker");
      else if (data.steps[0]?.id === step.id) back = () => goIntro("meter");
    }
  }

  const photoStage =
    local.kind === "confirm" || local.kind === "checking" || local.kind === "accepted" || local.kind === "retake" || local.kind === "held"
      ? "confirm"
      : "photo";

  const fileInput = (
    <input
      ref={fileRef}
      type="file"
      accept="image/*"
      className="sc-file-offscreen"
      aria-hidden="true"
      onChange={(event) => {
        const file = event.target.files?.[0];
        event.target.value = "";
        if (file) void onPickedFile(file);
      }}
    />
  );

  if (loadError && !data) {
    return (
      <Frame stage="flow" headingRef={headingRef} title="Photo check" actions={<Primary onClick={() => void load()}>Try again</Primary>}>
        <p className="sc-error" role="alert">
          {loadError}
        </p>
      </Frame>
    );
  }

  if (!data) {
    return (
      <Frame stage="flow">
        <p>Loading your photo check...</p>
      </Frame>
    );
  }

  if (data.home.status === "submitted") {
    return (
      <Frame stage="result" headingRef={headingRef} title="Thanks! A Base surveyor will review your home.">
        <div className="sc-result-icon" aria-hidden="true">
          ✓
        </div>
        <p>We have everything we need from you for now. The survey team will be in touch.</p>
      </Frame>
    );
  }

  if (intro === "welcome") {
    return (
      <Frame
        stage="welcome"
        inert={safetyOpen}
        headingRef={headingRef}
        title="Let's check your home"
        help={{ tips: SCREEN_HELP.welcome }}
        actions={<Primary onClick={() => setSafetyOpen(true)}>Start</Primary>}
        overlay={
          safetyOpen ? (
            <SafetyDialog
              panelRef={safetyPanel}
              headingRef={safetyHeading}
              onClose={closeSafety}
              onAccept={() => goIntro("meter")}
            />
          ) : null
        }
      >
        {data.home.address ? <p>{data.home.address}</p> : null}
        <div className="sc-welcome-pair">
          <img src="/find-meter.webp" alt="Person photographing an electric meter on the outside wall of a house" />
          <img src="/find-breaker.webp" alt="Person photographing an open breaker panel in a garage" />
        </div>
        <div className="sc-facts">
          <span>About 5 minutes</span>
          <span>About {data.steps.length} photos</span>
        </div>
      </Frame>
    );
  }

  if (intro === "meter" || intro === "breaker") {
    const copy = FIND_COPY[intro];
    const combo = data.home.setup_type === "combo_meter_main_unit";
    return (
      <Frame
        stage="find"
        headingRef={headingRef}
        back={intro === "meter" ? () => goIntro("welcome") : null}
        help={{ tips: intro === "meter" ? SCREEN_HELP.meter : combo ? SCREEN_HELP.combo : SCREEN_HELP.breaker }}
        actions={<Primary onClick={() => goIntro(null)}>{copy.action}</Primary>}
      >
        <FindEquipment subject={intro} combo={combo} headingRef={headingRef} />
      </Frame>
    );
  }

  if (data.nextStep === "question_5") return <Question5 homeId={homeId} onDone={load} />;
  if (data.nextStep === "site_check") return <SiteCheckScreen homeId={homeId} onDone={load} />;

  if (data.nextStep === null) {
    const total = data.steps.length;
    const index = total === 0 ? 0 : reviewIndex % total;
    const current = data.steps[index];
    return (
      <Frame
        stage="review"
        headingRef={headingRef}
        title="Review"
        help={{ tips: SCREEN_HELP.review }}
        actions={
          <Primary onClick={() => void submitHome()} disabled={submitting}>
            {submitting ? (
              <>
                <Spinner /> Submitting...
              </>
            ) : (
              "Submit"
            )}
          </Primary>
        }
      >
        <p>Check your photos, then submit them to the survey team.</p>
        {current && (
          <div className="sc-review">
            <div className="sc-review-viewer">
              <IconButton label="Previous photo" direction="left" onClick={() => setReviewIndex((currentIndex) => (currentIndex + total - 1) % total)} />
              <div className="sc-review-photo">
                {current.thumbnailUrl ? (
                  <img src={current.thumbnailUrl} alt={current.title} />
                ) : (
                  <div className="sc-review-empty" role="img" aria-label={`${current.title} is missing`} />
                )}
              </div>
              <IconButton label="Next photo" direction="right" onClick={() => setReviewIndex((currentIndex) => (currentIndex + 1) % total)} />
            </div>
            <p className="sc-review-caption" aria-live="polite">
              <strong>{current.title}</strong>
              <span>
                {index + 1} of {total}
              </span>
              <span>{current.status === "accepted" ? "Looks good" : "A surveyor will check this one"}</span>
            </p>
          </div>
        )}
        {submitError && (
          <p className="sc-error" role="alert">
            {submitError}
          </p>
        )}
      </Frame>
    );
  }

  if (!step) {
    return (
      <Frame stage="flow" headingRef={headingRef} title="Photo check" actions={<Primary onClick={() => void load()}>Try again</Primary>}>
        <p className="sc-error" role="alert">
          Something went wrong loading this step.
        </p>
      </Frame>
    );
  }

  const shown = SHOWN[step.id] ?? step.instruction;
  const preview = "preview" in local ? local.preview : null;
  const title =
    local.kind === "confirm"
      ? "Use this photo?"
      : local.kind === "checking"
        ? "Checking your photo"
        : local.kind === "accepted"
          ? "Looks good"
          : local.kind === "retake"
            ? "Let's try that photo again"
            : step.title;

  const stepNumber = data.steps.findIndex((item) => item.id === step.id) + 1;
  const stepCount = data.steps.length;
  const progress =
    stepNumber > 0 ? (
      <div className="sc-progress">
        <p className="sc-progress-label">
          Step {stepNumber} of {stepCount}
        </p>
        <div
          className="sc-progress-track"
          role="progressbar"
          aria-label={`Step ${stepNumber} of ${stepCount}`}
          aria-valuemin={1}
          aria-valuemax={stepCount}
          aria-valuenow={stepNumber}
        >
          <div className="sc-progress-fill" style={{ width: `${(stepNumber / stepCount) * 100}%` }} />
        </div>
      </div>
    ) : null;

  return (
    <Frame
      stage={photoStage}
      inert={modalOpen}
      headingRef={headingRef}
      title={title}
      back={back}
      progress={progress}
      help={{
        tips: step.help,
        extra:
          local.kind === "retake" && local.result.canKeep === true
            ? (close) => (
                <button
                  type="button"
                  className="sc-primary"
                  disabled={keeping}
                  onClick={() => {
                    close();
                    void keepPhoto(step.id);
                  }}
                >
                  My photo is fine, continue
                </button>
              )
            : undefined,
      }}
      overlay={
        <>
          {fileInput}
          {pickerOpen && (
            <div
              className="sc-modal-backdrop"
              onClick={(event) => {
                if (event.target === event.currentTarget) closePicker();
              }}
            >
              <div className="sc-photo-modal" role="dialog" aria-modal="true" aria-labelledby="photo-source-title" ref={photoPanel}>
                <TopBack onClick={closePicker} />
                <h2 id="photo-source-title" ref={photoHeading} tabIndex={-1}>
                  Add a photo
                </h2>
                <p>Take a new picture, or choose one from your library.</p>
                <button type="button" className="sc-primary" onClick={openCamera}>
                  Take picture
                </button>
                <button type="button" className="sc-option" onClick={() => fileRef.current?.click()}>
                  Select from library
                </button>
              </div>
            </div>
          )}
          {cameraOpen && (
            <div className="sc-camera-backdrop">
              <div className="sc-camera" role="dialog" aria-modal="true" aria-labelledby="camera-title" ref={cameraPanel}>
                <div className="sc-camera-bar">
                  <TopBack onClick={closeCamera} />
                  <h2 id="camera-title" ref={cameraHeading} tabIndex={-1}>
                    {step.title}
                  </h2>
                </div>
                <p className="sc-camera-hint">{shown}</p>
                <div className="sc-camera-stage" ref={stageRef}>
                  <video ref={videoRef} autoPlay playsInline muted disablePictureInPicture aria-label="Camera preview" />
                  {stageAspect && <Outline id={step.outline} aspect={stageAspect} />}
                  {!cameraReady && !cameraError && <p className="sc-camera-status">Opening camera…</p>}
                </div>
                {cameraError && (
                  <p className="sc-error" role="alert">
                    {cameraError}
                  </p>
                )}
                <footer className="sc-actions">
                  {cameraError ? (
                    <>
                      <button type="button" className="sc-primary" onClick={openCamera}>
                        Try again
                      </button>
                      <button type="button" className="sc-option" onClick={() => fileRef.current?.click()}>
                        Select from library
                      </button>
                    </>
                  ) : (
                    <button type="button" className="sc-primary" onClick={capture} disabled={!cameraReady}>
                      Take picture
                    </button>
                  )}
                </footer>
              </div>
            </div>
          )}
        </>
      }
      actions={
          local.kind === "ready" ? (
            <Primary onClick={() => setPickerOpen(true)}>Take photo</Primary>
          ) : local.kind === "confirm" ? (
            <Primary onClick={() => void sendPhoto(step.id, local.base64, local.preview)}>Use this photo</Primary>
          ) : local.kind === "checking" ? (
            <Primary disabled>
              <Spinner /> Checking your photo...
            </Primary>
          ) : local.kind === "retake" ? (
            <Primary
              disabled={keeping}
              onClick={() => {
                setKeepError(null);
                setLocal({ kind: "ready" });
              }}
            >
              Retake photo
            </Primary>
          ) : local.kind === "held" ? (
            <Primary onClick={() => void continueHeld(step.id)}>Continue</Primary>
          ) : local.kind === "error" ? (
            <Primary
              onClick={() => {
                const saved = local.message.startsWith("Your photo was saved");
                if (!saved) {
                  setLocal({ kind: "ready" });
                  return;
                }
                void fetchHome(homeId)
                  .then((fresh) => {
                    if (!alive.current) return;
                    setData(fresh);
                    setIntroLocked(false);
                    setLocal({ kind: "ready" });
                  })
                  .catch(() => {});
              }}
            >
              Try again
            </Primary>
          ) : null
        }
      >
        {local.kind === "ready" && (
          <>
            <p>{shown}</p>
            {guide && <Example guide={guide} title={step.title} />}
            {guide && <div className="sc-angle">{guide.angle}</div>}
          </>
        )}
        {local.kind === "confirm" && (
          <>
            <p>{step.id === "main_disconnect_closeup" ? "Can you see the main switch number clearly?" : "Can you see the equipment and area clearly?"}</p>
            <img className="sc-upload" src={local.preview} alt={`Your photo: ${step.title}`} />
            <p className="sc-muted">We&apos;ll check it when you continue.</p>
            <button type="button" className="sc-option" onClick={() => setLocal({ kind: "ready" })}>
              Retake photo
            </button>
          </>
        )}
        {local.kind === "checking" && preview && (
          <>
            <img className="sc-upload" src={preview} alt="Your photo" />
            <p className="sc-muted">Looking at the equipment and the framing.</p>
          </>
        )}
        {local.kind === "accepted" && preview && (
          <>
            <div className="sc-accepted">
              <img className="sc-upload" src={preview} alt="Your photo" />
              <div className="sc-accepted-badge" aria-hidden="true">
                <span className="sc-accepted-check">
                  <svg width="44" height="44" viewBox="0 0 24 24" fill="none">
                    <path d="M5 12.5 10 17.5 19 7" stroke="currentColor" strokeWidth="2.75" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </span>
                <p className="sc-accepted-text">Looks good</p>
              </div>
            </div>
            <p>That photo is in.</p>
          </>
        )}
        {local.kind === "retake" && (
          <>
            <p className="sc-warning" role="alert">
              {local.result.message}
            </p>
            <img className="sc-upload" src={local.preview} alt="Your photo" />
            <p className="sc-muted">
              Attempt {local.result.attempt} of {MAX_ATTEMPTS}
            </p>
            {local.result.canKeep === true && (
              <button type="button" className="sc-text-button" onClick={() => void keepPhoto(step.id)} disabled={keeping}>
                {keeping ? "Saving..." : "Use this photo anyway"}
              </button>
            )}
            {keepError && (
              <p className="sc-error" role="alert">
                {keepError}
              </p>
            )}
          </>
        )}
        {local.kind === "held" && (
          <>
            <img className="sc-upload" src={local.preview} alt="Your photo" />
            <div className="sc-result-message">
              <p>{local.result.message}</p>
            </div>
          </>
        )}
        {local.kind === "error" && (
          <p className="sc-error" role="alert">
            {local.message}
          </p>
        )}
      </Frame>
  );
}

export type HelpConfig = {
  tips: readonly string[];
  /** Extra buttons for the sheet. Call close before moving to another screen. */
  extra?: (close: () => void) => ReactNode;
};

function Frame({
  stage,
  title,
  headingRef,
  back,
  inert = false,
  progress,
  actions,
  overlay,
  help,
  children,
}: {
  stage: string;
  title?: string;
  headingRef?: RefObject<HTMLHeadingElement | null>;
  back?: (() => void) | null;
  inert?: boolean;
  progress?: ReactNode;
  actions?: ReactNode;
  overlay?: ReactNode;
  help?: HelpConfig;
  children: ReactNode;
}) {
  const [helpOpen, setHelpOpen] = useState(false);
  const closeHelp = useCallback(() => setHelpOpen(false), []);
  const helpButton = useRef<HTMLButtonElement>(null);
  const tips = help?.tips ?? GENERAL_HELP;
  return (
    <main className="sc-root">
      <div className={`sc-shell sc-stage-${stage}`} inert={inert || helpOpen || undefined}>
        <section className={stage === "find" ? "sc-content sc-find" : "sc-content"}>
          <div className="sc-topbar">
            {back && <TopBack onClick={back} />}
            {progress}
            <HelpButton ref={helpButton} onClick={() => setHelpOpen(true)} />
          </div>
          {title && (
            <h1 ref={headingRef} tabIndex={-1}>
              {title}
            </h1>
          )}
          {children}
        </section>
        {actions ? <footer className="sc-actions">{actions}</footer> : null}
      </div>
      {overlay}
      {helpOpen && (
        <HelpSheet tips={[...tips]} onClose={closeHelp} returnFocus={helpButton}>
          {help?.extra?.(closeHelp)}
        </HelpSheet>
      )}
    </main>
  );
}

function FindEquipment({
  subject,
  combo,
  headingRef,
}: {
  subject: "meter" | "breaker";
  combo: boolean;
  headingRef: RefObject<HTMLHeadingElement | null>;
}) {
  const text = subject === "breaker" && combo ? { ...FIND_COPY.breaker, ...COMBO_BREAKER_COPY } : FIND_COPY[subject];
  return (
    <>
      <h1 ref={headingRef} tabIndex={-1}>
        {text.title}
      </h1>
      <div className="sc-find-art">
        <img src={text.image} alt={text.alt} />
      </div>
      <p className="sc-find-lead">{text.lead}</p>
      <p className="sc-find-tip">
        <InfoIcon />
        {text.tip}
      </p>
    </>
  );
}

function Example({ guide, title }: { guide: Guide; title: string }) {
  if (guide.photo) {
    return (
      <div role="img" aria-label={`Example: ${title}. ${guide.angle}`} className="sc-example sc-example-photo">
        <img src={guide.photo} alt="" />
        <span className="sc-example-label">Example photo</span>
      </div>
    );
  }
  return (
    <div role="img" aria-label={`Example: ${title}. ${guide.angle}`} className={`sc-example sc-example-${guide.image}`}>
      <span className="sc-example-label">Example photo</span>
      <div className={`sc-guide sc-guide-${guide.guide}`} />
    </div>
  );
}

function Primary({ children, ...props }: ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button type="button" className="sc-primary" {...props}>
      {children}
    </button>
  );
}

function TopBack({ onClick }: { onClick: () => void }) {
  return (
    <button type="button" className="pl-top-back" aria-label="Back" onClick={onClick}>
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <path d="M19 12H6M11 6.5 5.5 12 11 17.5" stroke="currentColor" strokeWidth="2.25" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </button>
  );
}

function IconButton({ label, direction, onClick }: { label: string; direction: "left" | "right"; onClick: () => void }) {
  const path = direction === "left" ? "M14.5 6.5 9 12l5.5 5.5" : "M9.5 6.5 15 12l-5.5 5.5";
  return (
    <button type="button" className="sc-review-nav" aria-label={label} onClick={onClick}>
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <path d={path} stroke="currentColor" strokeWidth="2.25" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </button>
  );
}

function InfoIcon() {
  return (
    <svg className="sc-find-info" width="22" height="22" viewBox="0 0 22 22" aria-hidden="true">
      <circle cx="11" cy="11" r="9" fill="none" stroke="currentColor" strokeWidth="1.6" />
      <circle cx="11" cy="7.2" r="1.05" fill="currentColor" />
      <path d="M11 10.2v5.6" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}

function SafetyDialog({
  panelRef,
  headingRef,
  onClose,
  onAccept,
}: {
  panelRef: RefObject<HTMLDivElement | null>;
  headingRef: RefObject<HTMLHeadingElement | null>;
  onClose: () => void;
  onAccept: () => void;
}) {
  return (
    <div
      className="sc-modal-backdrop"
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div className="sc-safety-modal" role="dialog" aria-modal="true" aria-labelledby="safety-title" ref={panelRef}>
        <TopBack onClick={onClose} />
        <h2 id="safety-title" ref={headingRef} tabIndex={-1}>
          A quick safety check
        </h2>
        <p>Only photograph what you can reach safely.</p>
        <div className="sc-safety">
          <p>Open hinged doors only.</p>
          <p>Never remove screws or covers.</p>
          <p>Do not touch wires or switches.</p>
        </div>
        <p>Every photo helps. Stop if a location is unsafe.</p>
        <button type="button" className="sc-primary" onClick={onAccept}>
          I understand
        </button>
      </div>
    </div>
  );
}

type SiteCheckState = { kind: "running" } | { kind: "covered" } | { kind: "extra"; count: number } | { kind: "error" };

function SiteCheckScreen({ homeId, onDone }: { homeId: string; onDone: () => Promise<HomeData | null> }) {
  const [state, setState] = useState<SiteCheckState>({ kind: "running" });
  const [run, setRun] = useState(0);
  const [continuing, setContinuing] = useState(false);
  const headingRef = useRef<HTMLHeadingElement>(null);

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

  useEffect(() => {
    headingRef.current?.focus();
  }, [state.kind]);

  return (
    <Frame
      stage="result"
      headingRef={headingRef}
      title={
        state.kind === "running"
          ? "Checking your whole site"
          : state.kind === "covered"
            ? "All set"
            : state.kind === "extra"
              ? "Almost done"
              : "Photo check"
      }
      actions={
        state.kind === "extra" ? (
          <Primary
            disabled={continuing}
            onClick={() => {
              setContinuing(true);
              void onDone();
            }}
          >
            {continuing ? <Spinner /> : "Continue"}
          </Primary>
        ) : state.kind === "error" ? (
          <Primary
            onClick={() => {
              setState({ kind: "running" });
              setRun((n) => n + 1);
            }}
          >
            Try again
          </Primary>
        ) : null
      }
    >
      {state.kind === "running" && (
        <>
          <Spinner className="h-10 w-10" />
          <p>This takes a few seconds. Please stay by your meter.</p>
        </>
      )}
      {state.kind === "covered" && (
        <>
          <div className="sc-result-icon" aria-hidden="true">
            ✓
          </div>
          <p>Your photos cover everything.</p>
        </>
      )}
      {state.kind === "extra" && (
        <p className="sc-warning">
          We need {state.count === 1 ? "1 more photo" : `${state.count} more photos`}.
        </p>
      )}
      {state.kind === "error" && (
        <p className="sc-error" role="alert">
          We couldn&apos;t check your site. Check your connection and try again.
        </p>
      )}
    </Frame>
  );
}

function Question5({ homeId, onDone }: { homeId: string; onDone: () => Promise<HomeData | null> }) {
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const headingRef = useRef<HTMLHeadingElement>(null);

  useEffect(() => {
    headingRef.current?.focus();
  }, []);

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
      const fresh = await onDone();
      if (!fresh) throw new Error();
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
    <Frame stage="flow" headingRef={headingRef} title="One quick question" help={{ tips: SCREEN_HELP.question }}>
      <p>Your breaker box looks like it is inside the house.</p>
      <p>Is your breaker box on the other side of the same wall as your meter?</p>
      {options.map(([value, label]) => (
        <button key={value} type="button" className="sc-option" onClick={() => void answer(value)} disabled={busy !== null}>
          {busy === value ? "Saving..." : label}
        </button>
      ))}
      {error && (
        <p className="sc-error" role="alert">
          {error}
        </p>
      )}
    </Frame>
  );
}
