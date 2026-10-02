"use client";

import QRCode from "qrcode";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import { useDialog } from "@/components/use-dialog";
import { BRAND } from "@/lib/brand";
import { FAILURE_RATE_KEY, HOME_MESSAGE, MOBILE_DEMO_PATH, OUTAGE_RATE, storedFailureRate } from "@/lib/demo";
import "@/styles/demo.css";

export type DemoChoice = { id: string; label: string; startPath: string };

const REVIEW_START = "/review?live=1";
const PHONE = { width: 390, height: 844, bezel: 12 };
const FRAME_WIDTH = PHONE.width + PHONE.bezel * 2;
const FRAME_HEIGHT = PHONE.height + PHONE.bezel * 2;
/** Room under the phone for the "Try it on your own phone" link. */
const LINK_SPACE = 44;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const WIDE_QUERY = "(min-width: 900px)";

function subscribeWide(onChange: () => void) {
  const query = window.matchMedia(WIDE_QUERY);
  query.addEventListener("change", onChange);
  return () => query.removeEventListener("change", onChange);
}

const outageListeners = new Set<() => void>();

function subscribeOutage(onChange: () => void) {
  outageListeners.add(onChange);
  window.addEventListener("storage", onChange);
  return () => {
    outageListeners.delete(onChange);
    window.removeEventListener("storage", onChange);
  };
}

function readOutage(): boolean {
  try {
    return storedFailureRate(window.localStorage.getItem(FAILURE_RATE_KEY)) > 0;
  } catch {
    return false;
  }
}

function writeOutage(on: boolean) {
  try {
    window.localStorage.setItem(FAILURE_RATE_KEY, on ? String(OUTAGE_RATE) : "0");
  } catch {
    // Without storage the switch cannot reach the phone.
  }
  outageListeners.forEach((listener) => listener());
}

/** Homeowner phone on the left, surveyor view on the right, for recording the whole product on one screen. */
export function DemoScreen({ scenarios }: { scenarios: DemoChoice[] }) {
  const wide = useSyncExternalStore(subscribeWide, () => window.matchMedia(WIDE_QUERY).matches, () => null);
  const outage = useSyncExternalStore(subscribeOutage, readOutage, () => false);
  const [scenarioId, setScenarioId] = useState(scenarios[0]?.id ?? "");
  const [run, setRun] = useState(0);
  const [reviewSrc, setReviewSrc] = useState(REVIEW_START);
  const [scale, setScale] = useState(0);
  const [qrSvg, setQrSvg] = useState<string | null>(null);
  const phoneRef = useRef<HTMLIFrameElement>(null);
  const columnRef = useRef<HTMLDivElement>(null);
  const qrPanel = useRef<HTMLDivElement>(null);
  const qrHeading = useRef<HTMLHeadingElement>(null);
  const closeQr = useCallback(() => setQrSvg(null), []);
  useDialog(qrSvg !== null, qrPanel, qrHeading, closeQr);

  const scenario = scenarios.find((s) => s.id === scenarioId) ?? scenarios[0];

  useEffect(() => {
    const onMessage = (event: MessageEvent) => {
      if (event.origin !== window.location.origin || event.source !== phoneRef.current?.contentWindow) return;
      const data: unknown = event.data;
      if (!data || typeof data !== "object") return;
      const { type, homeId } = data as { type?: unknown; homeId?: unknown };
      if (type !== HOME_MESSAGE || typeof homeId !== "string" || !UUID_RE.test(homeId)) return;
      setReviewSrc(`/review/${homeId}?live=1`);
    };
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, []);

  useEffect(() => {
    const column = columnRef.current;
    if (!wide || !column) return;
    const observer = new ResizeObserver(([entry]) => {
      const { width, height } = entry.contentRect;
      setScale(Math.max(0.3, Math.min(1, (height - LINK_SPACE) / FRAME_HEIGHT, width / FRAME_WIDTH)));
    });
    observer.observe(column);
    return () => observer.disconnect();
  }, [wide]);

  function restart(id = scenarioId) {
    setScenarioId(id);
    setRun((current) => current + 1);
    setReviewSrc(REVIEW_START);
  }

  async function openQr() {
    const url = `${window.location.origin}/start`;
    try {
      setQrSvg(
        await QRCode.toString(url, { type: "svg", margin: 1, color: { dark: BRAND.ink, light: "#ffffff" } }),
      );
    } catch (err) {
      console.error("[demo] could not draw the QR code", err);
    }
  }

  return (
    <>
      <main className="demo-narrow">
        <p className="demo-name">site-check</p>
        <div className="demo-narrow-body">
          <p className="demo-narrow-text">The split screen needs a laptop or a wider window.</p>
          <Link href={MOBILE_DEMO_PATH} className="demo-button demo-button-lime">
            Open the mobile demo
          </Link>
        </div>
      </main>

      <main className="demo-wide">
        <header className="demo-bar">
          <Link href="/" className="demo-name">
            site-check
          </Link>
          <span className="demo-pills-label" id="demo-scenario-label">
            Try a scenario:
          </span>
          <div className="demo-pills" role="group" aria-labelledby="demo-scenario-label">
            {scenarios.map((s) => (
              <button
                key={s.id}
                type="button"
                className="demo-pill"
                aria-pressed={s.id === scenario?.id}
                onClick={() => restart(s.id)}
              >
                {s.label}
              </button>
            ))}
          </div>
          <button type="button" className="demo-restart" onClick={() => restart()}>
            Restart
          </button>
          <button
            type="button"
            role="switch"
            aria-checked={outage}
            className="demo-switch"
            onClick={() => writeOutage(!outage)}
          >
            <span className="demo-switch-track" aria-hidden="true">
              <span className="demo-switch-thumb" />
            </span>
            Simulate AI outages
          </button>
        </header>

        <div className="demo-stage">
          <div className="demo-phone-column" ref={columnRef}>
            {wide && scale > 0 && scenario && (
              <>
                <div className="demo-phone-fit" style={{ width: FRAME_WIDTH * scale, height: FRAME_HEIGHT * scale }}>
                  <div className="demo-phone" style={{ transform: `scale(${scale})` }}>
                    <iframe
                      key={`${scenario.id}-${run}`}
                      ref={phoneRef}
                      src={scenario.startPath}
                      title="Homeowner phone"
                      allow="camera"
                    />
                  </div>
                </div>
                <button type="button" className="demo-own-phone" onClick={() => void openQr()}>
                  Try it on your own phone
                </button>
              </>
            )}
          </div>
          <div className="demo-surveyor">{wide && <iframe key={`${run}-${reviewSrc}`} src={reviewSrc} title="Surveyor view" />}</div>
        </div>
      </main>

      {qrSvg && (
        <div
          className="demo-qr-backdrop"
          onClick={(event) => {
            if (event.target === event.currentTarget) closeQr();
          }}
        >
          <div className="demo-qr" role="dialog" aria-modal="true" aria-labelledby="demo-qr-title" ref={qrPanel}>
            <h2 id="demo-qr-title" ref={qrHeading} tabIndex={-1}>
              Scan with your phone
            </h2>
            <div className="ui-qr" role="img" aria-label="QR code of the start page" dangerouslySetInnerHTML={{ __html: qrSvg }} />
            <button type="button" className="demo-button" onClick={closeQr}>
              Close
            </button>
          </div>
        </div>
      )}
    </>
  );
}
