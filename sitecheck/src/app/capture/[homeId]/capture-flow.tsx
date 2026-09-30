"use client";

import { useCallback, useEffect, useRef, useState, type ButtonHTMLAttributes, type ReactNode, type RefObject } from "react";
import { HelpButton, HelpSheet } from "@/components/help-sheet";
import { Outline } from "@/components/outline";
import PropertyLocator, { type PropertyContext } from "@/components/property-locator";
import { Spinner } from "@/components/ui";
import { useDialog } from "@/components/use-dialog";
import { guideFor, type Guide } from "@/lib/guides";
import {
  checkpointState,
  followUpStep,
  rowFromResult,
  SENT_FAILED_MESSAGE,
  SURVEYOR_MESSAGE,
  type CheckpointRow,
} from "@/lib/checkpoint";
import { captureVideoFrame, prepareUpload } from "@/lib/image";
import { instantCheck, type GrayImage } from "@/lib/instantCheck";
import { phaseProgress, phaseSegments, plannedForPhase, stepLabel, type ShotStatus } from "@/lib/phases";
import { isFinished } from "@/lib/plan";
import { getStep, isStepId, MAX_ATTEMPTS, PHASE_COUNT, PHASE_TITLES, phaseOf, type Phase } from "@/lib/steps";
import { welcomedKey } from "@/lib/startLink";
import type { HomeProperty, PhotoStatus, SetupType } from "@/lib/types";
import "@/styles/customer-flow.css";

type StepView = {
  id: string;
  title: string;
  status: PhotoStatus | "pending";
  attempts: number;
  thumbnailUrl: string | null;
  saw?: string;
};

type HomeData = {
  home: {
    id: string;
    address: string | null;
    status: "in_progress" | "submitted";
    extra_steps: { id: string; instruction: string }[];
    setup_type: SetupType;
    property?: HomeProperty | null;
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
  /** One short "what we saw" line for an accepted photo. */
  saw?: string;
};

type Local =
  | { kind: "ready" }
  | { kind: "confirm"; preview: string; base64: string }
  | { kind: "saved"; preview: string }
  | { kind: "checking"; preview: string }
  | { kind: "accepted"; preview: string; saw: string }
  | { kind: "retake"; preview: string; result: PhotoResult }
  | { kind: "held"; preview: string; result: PhotoResult }
  /** Turned away on the phone (too dark or blurry) before anything was sent. No attempt is used. */
  | { kind: "instant"; preview: string; message: string }
  | { kind: "error"; message: string };

type Intro = "welcome" | "meter" | "breaker";

type Shot = {
  /** Increases with every photo sent, so a late response never overwrites a newer photo of the same step. */
  seq: number;
  preview: string;
  row: CheckpointRow;
};

/**
 * One phase shot without waiting. Photos are sent as they are taken and checked at the checkpoint
 * that follows the last one. Lives in page state only: after a reload the server decides where to resume.
 */
type Batch = {
  phase: Phase;
  /** Steps shot back to back, without waiting for their checks. */
  queue: string[];
  index: number;
  /** Checkpoint rows, in order. */
  rows: string[];
  shots: Record<string, Shot>;
  /** A step opened from the checkpoint (retake or follow-up). It is checked right away. */
  focus: string | null;
  /** Bumped whenever a result changes, so the checkpoint settles again. */
  gen: number;
  settled: { gen: number; next: string | null; error: boolean } | null;
};

const SAVED_MS = 500;

function withShot(batch: Batch, step: string, shot: Shot): Batch {
  return { ...batch, shots: { ...batch.shots, [step]: shot }, gen: batch.gen + 1 };
}

function withoutShot(batch: Batch, step: string, seq?: number): Batch {
  if (seq !== undefined && batch.shots[step]?.seq !== seq) return batch;
  const shots = { ...batch.shots };
  delete shots[step];
  return { ...batch, shots, gen: batch.gen + 1 };
}

const NETWORK_ERROR = "We couldn't send your photo. Check your connection and try again.";
const FILE_ERROR = "We couldn't read that file. Try a JPG or PNG photo.";

const SHOWN: Record<string, string> = {
  meter_area_wide: "Stand about 10 steps back. Show your meter and the whole wall around it.",
  left_of_meter: "Step back. Keep the meter at the right edge of the photo.",
  right_of_meter: "Step back. Keep the meter at the left edge of the photo.",
  panel_open: "Open the breaker box door. Show all the switches.",
  main_disconnect_closeup:
    "Find the number on your main switch, like 150 or 200. It's often inside the breaker box lid. It can also be printed on the outside of a gray box next to your meter.",
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
  checkpoint: [
    "We check each photo here, so you only wait once per part.",
    "Tap Retake on any photo that needs a quick fix.",
    "Photos marked for a surveyor are fine to send.",
  ],
  question: [
    "Think about which outside wall your meter is on.",
    "If the breaker box is on the inside of that same wall, choose the first one.",
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

type PhasePlans = Partial<Record<Phase, string[]>>;

const plansKey = (homeId: string) => `sc-phase-plans:${homeId}`;

/** The photos planned when each phase started. Kept for the tab session so a reload does not change the counts. */
function loadPlans(homeId: string): PhasePlans {
  if (typeof window === "undefined") return {};
  try {
    const raw: unknown = JSON.parse(window.sessionStorage.getItem(plansKey(homeId)) ?? "{}");
    const plans: PhasePlans = {};
    for (const phase of [1, 2, 3] as const) {
      const list = raw && typeof raw === "object" ? (raw as Record<string, unknown>)[phase] : undefined;
      if (Array.isArray(list) && list.every((id) => typeof id === "string")) plans[phase] = list;
    }
    return plans;
  } catch {
    return {};
  }
}

/** True when the customer came through the /start welcome screen, which already did the welcoming. */
function readWelcomed(homeId: string): boolean {
  if (typeof window === "undefined") return false;
  try {
    return window.sessionStorage.getItem(welcomedKey(homeId)) === "1";
  } catch {
    return false;
  }
}

function savePlans(homeId: string, plans: PhasePlans) {
  try {
    window.sessionStorage.setItem(plansKey(homeId), JSON.stringify(plans));
  } catch {
    // Private mode or storage full: the counts just stay in memory.
  }
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
  const [mapClosed, setMapClosed] = useState(false);
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
  const [plans, setPlans] = useState<PhasePlans>(() => loadPlans(homeId));
  const [redoStep, setRedoStep] = useState<string | null>(null);
  const [welcomed] = useState(() => readWelcomed(homeId));
  const [batch, setBatch] = useState<Batch | null>(null);
  const shotSeq = useRef(0);
  const instantFails = useRef(new Map<string, number>());

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

  const serverNext = data?.nextStep ?? null;
  if (data && !batch && redoStep === null && data.home.status !== "submitted" && serverNext && isStepId(serverNext)) {
    const phase = phaseOf(serverNext);
    const plan = plans[phase] ?? plannedForPhase(data.steps.map((item) => item.id), phase);
    if (!plans[phase]) setPlans({ ...plans, [phase]: plan });
    const statusById = new Map(data.steps.map((item) => [item.id, item.status]));
    const rows = plan.filter((id) => statusById.has(id));
    const queue = rows.filter((id) => {
      const status = statusById.get(id);
      return status === undefined || status === "pending" || !isFinished(status);
    });
    setBatch({ phase, queue, index: 0, rows, shots: {}, focus: null, gen: 0, settled: null });
  }

  const inCheckpoint = batch !== null && batch.focus === null && batch.index >= batch.queue.length;
  /** Inside a phase: the shutter sends the photo and moves on without waiting for the check. */
  const quick = batch !== null && batch.focus === null && !inCheckpoint;
  const flowStep = batch ? (batch.focus ?? batch.queue[batch.index] ?? null) : data ? (data.nextStep ?? redoStep) : null;
  const stepId = flowStep && flowStep !== "question_5" && flowStep !== "site_check" ? flowStep : null;
  const stepPhase = stepId ? phaseOf(stepId) : null;
  const frozenPlan = stepPhase ? plans[stepPhase] : undefined;

  if (data && stepPhase && !frozenPlan) {
    setPlans({ ...plans, [stepPhase]: plannedForPhase(data.steps.map((item) => item.id), stepPhase) });
  }

  const views = new Map((data?.steps ?? []).map((item) => [item.id, item]));
  const shotStatus = (id: string): ShotStatus => (batch?.shots[id] ? "sent" : (views.get(id)?.status ?? "pending"));
  const checkpointRows = batch
    ? batch.rows.map((id) => {
        const shot = batch.shots[id];
        const view = views.get(id);
        return {
          id,
          title: (data && getStep(id, data.home.extra_steps)?.title) ?? view?.title ?? id,
          thumbnail: shot?.preview ?? view?.thumbnailUrl ?? null,
          row: shot?.row ?? rowFromResult(view?.status ?? "pending", view?.saw, undefined),
        };
      })
    : [];
  const checkpoint = batch ? checkpointState(batch.phase, checkpointRows.map((item) => item.row)) : null;
  const settle = batch?.settled && batch.settled.gen === batch.gen ? batch.settled : null;
  const readyToSettle = inCheckpoint && checkpoint !== null && checkpoint.settled;
  const settleGen = batch?.gen ?? -1;

  useEffect(() => {
    if (!readyToSettle) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`/api/homes/${homeId}/evaluate`, { method: "POST" });
        if (!res.ok) console.error("[checkpoint] evaluate failed", res.status);
      } catch (err) {
        console.error("[checkpoint] evaluate failed", err);
      }
      const fresh = await fetchHome(homeId).catch(() => null);
      if (cancelled || !alive.current) return;
      if (fresh) setData(fresh);
      setBatch((current) =>
        current && current.gen === settleGen
          ? {
              ...current,
              settled: { gen: settleGen, next: fresh ? followUpStep(fresh.nextStep, current.phase) : null, error: !fresh },
            }
          : current,
      );
    })();
    return () => {
      cancelled = true;
    };
  }, [readyToSettle, settleGen, homeId]);

  useEffect(() => {
    savePlans(homeId, plans);
  }, [homeId, plans]);

  const intro = !data ? null : introLocked ? introChoice : shouldWelcome(data) ? "welcome" : shouldBreaker(data) ? "breaker" : null;
  const onReview =
    data?.home.status !== "submitted" && data?.nextStep === null && redoStep === null && batch === null && intro === null;

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

  const skipWelcome = welcomed && intro === "welcome";
  const safetyShown = safetyOpen || skipWelcome;
  useDialog(safetyShown, safetyPanel, safetyHeading, closeSafety);

  const modalOpen = safetyShown || pickerOpen || cameraOpen;
  const flowKey = batch ? `${batch.phase}:${batch.index}:${batch.focus ?? ""}:${inCheckpoint}` : `${data?.nextStep ?? ""}:${redoStep ?? ""}`;
  const viewKey = `${intro ?? "flow"}:${flowKey}:${local.kind}:${data?.home.status ?? ""}`;
  useEffect(() => {
    if (modalOpen) return;
    headingRef.current?.closest(".sc-content")?.scrollTo(0, 0);
    headingRef.current?.focus({ preventScroll: true });
  }, [viewKey, modalOpen]);

  /** Saves the map answers in the background. The customer moves on to the welcome screen either way. */
  function finishMap(value: PropertyContext | null) {
    setMapClosed(true);
    if (!value) return;
    const property: HomeProperty = { ...value, mapDone: true };
    setData((current) => (current ? { ...current, home: { ...current.home, property } } : current));
    fetch(`/api/homes/${homeId}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ property }),
    })
      .then(async (res) => {
        if (!res.ok) console.error("[map] could not save the map answers", res.status, await res.text().catch(() => ""));
      })
      .catch((err) => console.error("[map] could not save the map answers", err));
  }

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
    setRedoStep(null);
    setLocal({ kind: "ready" });
    setKeepError(null);
    if (!isPanelStep(fromStep) && fresh.nextStep && isPanelStep(fresh.nextStep)) {
      setIntroChoice("breaker");
      setIntroLocked(true);
    }
  }

  function startRedo(id: string) {
    setRedoStep(id);
    setLocal({ kind: "ready" });
    setKeepError(null);
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
      const { base64, dataUrl, gray } = await prepareUpload(file);
      if (!alive.current) return;
      takeShot(base64, dataUrl, gray);
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
      takeShot(shot.base64, shot.dataUrl, shot.gray);
    } catch {
      setCameraError("We couldn't save that picture. Try again.");
    }
  }

  /** Every photo, from the camera or the library, passes through here before it can be sent. */
  function takeShot(base64: string, preview: string, gray: GrayImage) {
    if (stepId) {
      const check = instantCheck(stepId, gray, instantFails.current);
      if (!check.pass) {
        setKeepError(null);
        setLocal({ kind: "instant", preview, message: check.message });
        return;
      }
    }
    if (quick && stepId) queueShot(stepId, base64, preview);
    else setLocal({ kind: "confirm", preview, base64 });
  }

  /** Records a result for the checkpoint row of a step. A no-op outside a phase. */
  function recordShot(step: string, preview: string, row: CheckpointRow) {
    const seq = ++shotSeq.current;
    setBatch((current) => (current ? withShot(current, step, { seq, preview, row }) : current));
  }

  /** Sends a photo without waiting for its check, shows "Saved" briefly, then moves to the next step of the phase. */
  function queueShot(step: string, base64: string, preview: string) {
    const seq = ++shotSeq.current;
    setBatch((current) => (current ? withShot(current, step, { seq, preview, row: { kind: "checking" } }) : current));
    setLocal({ kind: "saved", preview });
    setKeepError(null);

    const settle = (row: CheckpointRow) =>
      setBatch((current) => (current && current.shots[step]?.seq === seq ? withShot(current, step, { seq, preview, row }) : current));

    void (async () => {
      let res: Response;
      let body: Partial<PhotoResult> & { error?: string };
      try {
        res = await fetch("/api/photos", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ homeId, step, imageBase64: base64 }),
        });
        body = await res.json().catch(() => ({}));
      } catch (err) {
        console.error(`[checkpoint] step=${step} request failed`, err);
        if (alive.current) settle({ kind: "failed" });
        return;
      }
      if (!alive.current) return;
      if (res.status === 409) {
        // The server already has a finished photo for this step, or no longer needs it: show what it has.
        const fresh = await fetchHome(homeId).catch(() => null);
        if (!alive.current) return;
        if (!fresh) return settle({ kind: "failed" });
        setData(fresh);
        const planned = new Set(fresh.steps.map((item) => item.id));
        setBatch((current) => {
          if (!current) return current;
          const next = withoutShot(current, step, seq);
          return { ...next, rows: next.rows.filter((id) => planned.has(id)) };
        });
        return;
      }
      if (!res.ok || !body.status || !body.message || body.attempt == null) {
        console.error(`[checkpoint] step=${step} status=${res.status}`, body.error ?? "");
        return settle({ kind: "failed" });
      }
      settle(rowFromResult(body.status, body.saw, body.message));
    })();

    setTimeout(() => {
      if (!alive.current) return;
      setBatch((current) =>
        current && current.focus === null && current.queue[current.index] === step ? { ...current, index: current.index + 1 } : current,
      );
      setLocal((current) => (current.kind === "saved" ? { kind: "ready" } : current));
    }, SAVED_MS);
  }

  /** Back to the checkpoint from a step opened there. */
  function leaveFocus() {
    setBatch((current) => (current ? { ...current, focus: null } : current));
    setLocal({ kind: "ready" });
    setKeepError(null);
  }

  function openFocus(step: string) {
    setBatch((current) =>
      current ? { ...current, focus: step, rows: current.rows.includes(step) ? current.rows : [...current.rows, step] } : current,
    );
    setLocal({ kind: "ready" });
    setKeepError(null);
  }

  /** Leaves a settled checkpoint for whatever the server says comes next. */
  function continuePhase() {
    if (!batch || !data) return;
    const last = batch.rows[batch.rows.length - 1] ?? batch.queue[batch.queue.length - 1] ?? "";
    setBatch(null);
    handoff(last, data);
  }

  async function sendPhoto(step: string, base64: string, preview: string) {
    const token = ++sendToken.current;
    const focused = batch?.focus === step;
    setLocal({ kind: "checking", preview });
    setKeepError(null);
    let res: Response;
    let body: Partial<PhotoResult> & { error?: string };
    try {
      res = await fetch("/api/photos", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ homeId, step, imageBase64: base64, ...(redoStep === step ? { redo: true } : {}) }),
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
      if (focused) {
        setBatch((current) => (current ? { ...withoutShot(current, step), focus: null } : current));
        setLocal({ kind: "ready" });
        return;
      }
      setRedoStep(null);
      setIntroLocked(false);
      setLocal({ kind: "ready" });
      return;
    }
    if (!res.ok || !body.status || !body.message || body.attempt == null) {
      setLocal({ kind: "error", message: body.error ?? NETWORK_ERROR });
      return;
    }
    const result = body as PhotoResult;
    if (focused) recordShot(step, preview, rowFromResult(result.status, result.saw, result.message));
    if (result.status === "retake") {
      setLocal({ kind: "retake", preview, result });
      const fresh = await fetchHome(homeId).catch(() => null);
      if (alive.current && fresh) setData(fresh);
      return;
    }
    if (result.status === "accepted") {
      setLocal({ kind: "accepted", preview, saw: result.saw ?? "Got it." });
      await sleep(1400);
      if (!alive.current || token !== sendToken.current) return;
      if (focused) {
        leaveFocus();
        return;
      }
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
      if (batch?.focus === step) {
        setData(fresh);
        setBatch((current) => (current ? withoutShot(current, step) : current));
        leaveFocus();
        return;
      }
      handoff(step, fresh);
    } catch (err) {
      if (alive.current) setKeepError(err instanceof Error ? err.message : NETWORK_ERROR);
    } finally {
      if (alive.current) setKeeping(false);
    }
  }

  async function continueHeld(step: string) {
    if (batch?.focus === step) {
      leaveFocus();
      return;
    }
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

  const step = data && stepId ? getStep(stepId, data.home.extra_steps) : null;
  const guide = step ? guideFor(step.id) : undefined;

  let back: (() => void) | null = null;
  if (data && step && intro === null) {
    if (
      local.kind === "confirm" ||
      local.kind === "retake" ||
      local.kind === "held" ||
      local.kind === "instant" ||
      local.kind === "error"
    ) {
      back = () => {
        setKeepError(null);
        setLocal({ kind: "ready" });
      };
    } else if (local.kind === "ready" && batch?.focus === step.id) {
      back = leaveFocus;
    } else if (local.kind === "ready" && redoStep !== null && data.nextStep === null) {
      back = () => setRedoStep(null);
    } else if (local.kind === "ready") {
      const firstPanel = data.steps.find((item) => isPanelStep(item.id));
      if (firstPanel && step.id === firstPanel.id) back = () => goIntro("breaker");
      else if (data.steps[0]?.id === step.id) back = () => goIntro("meter");
    }
  }

  const photoStage =
    local.kind === "confirm" ||
    local.kind === "saved" ||
    local.kind === "checking" ||
    local.kind === "accepted" ||
    local.kind === "retake" ||
    local.kind === "held" ||
    local.kind === "instant"
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

  if (intro === "welcome" && !mapClosed && !data.home.property?.mapDone) {
    return (
      <main className="sc-root">
        <div className="sc-shell sc-stage-map">
          <PropertyLocator
            initial={data.home.property ?? null}
            startAddress={data.home.address}
            onDone={finishMap}
            onFail={() => finishMap(null)}
          />
        </div>
      </main>
    );
  }

  if (skipWelcome) {
    return (
      <Frame
        stage="welcome"
        inert
        overlay={
          <SafetyDialog panelRef={safetyPanel} headingRef={safetyHeading} onAccept={() => goIntro("meter")} />
        }
      >
        {null}
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
        back={intro === "meter" && !welcomed ? () => goIntro("welcome") : null}
        help={{ tips: intro === "meter" ? SCREEN_HELP.meter : combo ? SCREEN_HELP.combo : SCREEN_HELP.breaker }}
        actions={<Primary onClick={() => goIntro(null)}>{copy.action}</Primary>}
      >
        <FindEquipment subject={intro} combo={combo} headingRef={headingRef} />
      </Frame>
    );
  }

  if (!batch && data.nextStep === "question_5") return <Question5 homeId={homeId} onDone={load} />;
  if (!batch && data.nextStep === "site_check") return <SiteCheckScreen homeId={homeId} onDone={load} />;

  if (batch && inCheckpoint && checkpoint) {
    const next = settle?.next ?? null;
    const nextTitle = next ? (getStep(next, data.home.extra_steps)?.title ?? next) : "";
    return (
      <Frame
        stage="checkpoint"
        headingRef={headingRef}
        title={checkpoint.title}
        progress={
          <PhaseHeader phase={batch.phase} segments={phaseSegments(batch.phase, plans[batch.phase] ?? batch.rows, shotStatus)} />
        }
        help={{ tips: SCREEN_HELP.checkpoint }}
        actions={
          settle?.error ? (
            <Primary onClick={() => setBatch((current) => (current ? { ...current, gen: current.gen + 1, settled: null } : current))}>
              Try again
            </Primary>
          ) : next ? (
            <Primary onClick={() => openFocus(next)}>Next: {nextTitle}</Primary>
          ) : (
            <Primary onClick={continuePhase} disabled={!checkpoint.settled || !settle}>
              Continue
            </Primary>
          )
        }
      >
        <ul className="sc-checkpoint" aria-live="polite">
          {checkpointRows.map((item) => (
            <li key={item.id} className="sc-checkpoint-row">
              {item.thumbnail ? (
                <img className="sc-checkpoint-thumb" src={item.thumbnail} alt="" />
              ) : (
                <div className="sc-checkpoint-thumb" aria-hidden="true" />
              )}
              <div className="sc-checkpoint-body">
                <strong>{item.title}</strong>
                <CheckpointStatus row={item.row} />
                {(item.row.kind === "retake" || item.row.kind === "failed") && (
                  <button type="button" className="sc-option sc-checkpoint-retake" onClick={() => openFocus(item.id)}>
                    Retake
                  </button>
                )}
              </div>
            </li>
          ))}
        </ul>
        {settle?.error && (
          <p className="sc-error" role="alert">
            We couldn&apos;t load the next part. Check your connection and try again.
          </p>
        )}
      </Frame>
    );
  }

  if (!batch && data.nextStep === null && redoStep === null) {
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
              {current.thumbnailUrl && current.attempts < MAX_ATTEMPTS ? (
                <button type="button" className="sc-review-photo sc-review-redo" aria-label={`Retake ${current.title}`} onClick={() => startRedo(current.id)}>
                  <img src={current.thumbnailUrl} alt={current.title} />
                  <span className="sc-review-redo-chip" aria-hidden="true">
                    Tap to retake
                  </span>
                </button>
              ) : (
                <div className="sc-review-photo sc-review-final">
                  {current.thumbnailUrl ? (
                    <img src={current.thumbnailUrl} alt={current.title} />
                  ) : (
                    <div className="sc-review-empty" role="img" aria-label={`${current.title} is missing`} />
                  )}
                  {current.attempts >= MAX_ATTEMPTS && <span className="sc-review-redo-chip sc-review-final-chip">No retakes left</span>}
                </div>
              )}
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
  const planned = frozenPlan ?? plannedForPhase(data.steps.map((item) => item.id), phaseOf(step.id));
  const progressInfo = phaseProgress(step.id, planned, shotStatus, !batch && redoStep === step.id && data.nextStep === null);
  const stepName = stepLabel(step.id, step.title, progressInfo.extra);
  const title =
    local.kind === "confirm"
      ? "Use this photo?"
      : local.kind === "saved"
        ? "Saved"
        : local.kind === "checking"
        ? "Checking your photo"
        : local.kind === "accepted"
          ? local.saw
          : local.kind === "retake" || local.kind === "instant"
            ? "Let's try that photo again"
            : stepName;

  const progress = (
    <PhaseHeader phase={progressInfo.phase} segments={progressInfo.segments} />
  );

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
                    {stepName}
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
          ) : local.kind === "retake" || local.kind === "instant" ? (
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
                    setRedoStep(null);
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
        {local.kind === "saved" && (
          <div className="sc-accepted">
            <img className="sc-upload" src={local.preview} alt="Your photo" />
            <div className="sc-accepted-badge" aria-hidden="true">
              <span className="sc-accepted-check">
                <CheckIcon size={44} />
              </span>
            </div>
          </div>
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
                  <CheckIcon size={44} />
                </span>
              </div>
            </div>
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
        {local.kind === "instant" && (
          <>
            <p className="sc-warning" role="alert">
              {local.message}
            </p>
            <img className="sc-upload" src={local.preview} alt="Your photo" />
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

function PhaseHeader({ phase, segments }: { phase: Phase; segments: number[] }) {
  return (
    <div className="sc-progress">
      <p className="sc-progress-phase">{PHASE_TITLES[phase]}</p>
      <div
        className="sc-progress-bar"
        role="progressbar"
        aria-label={`Part ${phase} of ${PHASE_COUNT}`}
        aria-valuemin={0}
        aria-valuemax={PHASE_COUNT}
        aria-valuenow={Math.round(segments.reduce((sum, value) => sum + value, 0) * 100) / 100}
      >
        {segments.map((fill, index) => (
          <div key={index} className="sc-progress-seg">
            <div className="sc-progress-fill" style={{ width: `${fill * 100}%` }} />
          </div>
        ))}
      </div>
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

function CheckIcon({ size }: { size: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M5 12.5 10 17.5 19 7" stroke="currentColor" strokeWidth="2.75" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function CheckpointStatus({ row }: { row: CheckpointRow }) {
  switch (row.kind) {
    case "checking":
      return (
        <span className="sc-checkpoint-status">
          <Spinner />
        </span>
      );
    case "accepted":
      return (
        <span className="sc-checkpoint-status sc-checkpoint-ok">
          <span className="sc-checkpoint-icon" aria-hidden="true">
            <CheckIcon size={16} />
          </span>
          {row.saw}
        </span>
      );
    case "retake":
      return <span className="sc-checkpoint-status sc-checkpoint-fix">{row.message}</span>;
    case "failed":
      return <span className="sc-checkpoint-status sc-checkpoint-fix">{SENT_FAILED_MESSAGE}</span>;
    case "surveyor":
      return <span className="sc-checkpoint-status">{SURVEYOR_MESSAGE}</span>;
  }
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
  /** Left out when there is no screen behind the dialog to go back to. */
  onClose?: () => void;
  onAccept: () => void;
}) {
  return (
    <div
      className="sc-modal-backdrop"
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose?.();
      }}
    >
      <div className="sc-safety-modal" role="dialog" aria-modal="true" aria-labelledby="safety-title" ref={panelRef}>
        {onClose && <TopBack onClick={onClose} />}
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
    ["yes", "Inside, right behind the meter wall"],
    ["no", "Inside, somewhere else"],
    ["not_sure", "Not sure"],
  ];

  return (
    <Frame
      stage="flow"
      headingRef={headingRef}
      title="Where's your breaker box?"
      progress={<PhaseHeader phase={3} segments={[1, 1, 0]} />}
      help={{ tips: SCREEN_HELP.question }}
    >
      <p>We couldn&apos;t see it next to your meter.</p>
      {options.map(([value, label]) => (
        <button key={value} type="button" className="sc-option sc-option-large" onClick={() => void answer(value)} disabled={busy !== null}>
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
