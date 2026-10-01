import { z } from "zod";
import { isStepId } from "./steps";

/** Steps a scenario does not list use this scenario's files. */
export const FALLBACK_SCENARIO = "good";

/** Real camera, straight to the welcome screen. For people trying the demo on their own phone. */
export const MOBILE_DEMO_PATH = "/start?name=Denis&email=denis%40example.com&austin=yes&solar=no";

/** localStorage key shared by the /demo switch and the capture page inside it. */
export const FAILURE_RATE_KEY = "sitecheck-demo-failure-rate";
export const OUTAGE_RATE = 0.3;
/** Highest failure rate a demo request can ask the server for. */
export const MAX_REQUESTED_FAILURE_RATE = 0.5;

/** postMessage type the demo capture page sends to /demo once its home exists. */
export const HOME_MESSAGE = "sitecheck-home";

export type DemoScenario = {
  id: string;
  label: string;
  customer: { name: string; email: string; inAustin: boolean; hasSolar: boolean };
  /** Step id to photo names (no extension), in shutter order. */
  steps: Record<string, string[]>;
};

/** What the capture page needs in demo mode: photo names per step with the fallback applied. */
export type DemoCamera = { id: string; files: Record<string, string[]> };

/** The scenarios in file order. Throws with the problem when the file is not valid. */
export function parseScenarios(raw: unknown): DemoScenario[] {
  const name = z.string().regex(/^[a-z0-9][a-z0-9-]*$/, "photo names are lowercase letters, digits and dashes");
  const scenario = z.object({
    label: z.string().min(1),
    customer: z.object({ name: z.string().min(1), email: z.email(), inAustin: z.boolean(), hasSolar: z.boolean() }),
    steps: z.record(z.string().refine(isStepId, "unknown step id"), z.array(name).min(1)),
  });
  const parsed = z.record(z.string().regex(/^[a-z0-9-]+$/), scenario).parse(raw);
  const list = Object.entries(parsed).map(([id, scenario]) => ({ id, ...scenario }));
  if (!list.some((s) => s.id === FALLBACK_SCENARIO)) throw new Error(`scenarios need a "${FALLBACK_SCENARIO}" entry`);
  return list;
}

/** Photo names for a step, in shutter order. Empty when neither the scenario nor the fallback has one. */
export function demoFiles(scenarios: DemoScenario[], id: string, step: string): string[] {
  const own = scenarios.find((s) => s.id === id)?.steps[step];
  if (own) return own;
  return scenarios.find((s) => s.id === FALLBACK_SCENARIO)?.steps[step] ?? [];
}

/** press 0 is the first shutter press on the step. The last file repeats. */
export function fileForPress(files: string[], press: number): string | null {
  if (files.length === 0) return null;
  return files[Math.min(Math.max(0, press), files.length - 1)];
}

export const demoPhotoUrl = (name: string) => `/demo/photos/${name}.jpg`;

/** Every photo name the scenarios use, once each. */
export function photoNames(scenarios: DemoScenario[]): string[] {
  return [...new Set(scenarios.flatMap((s) => Object.values(s.steps).flat()))];
}

/** The customer link for a scenario, so the phone starts on the welcome screen in demo mode. */
export function demoStartPath(scenario: DemoScenario): string {
  const params = new URLSearchParams({
    name: scenario.customer.name,
    email: scenario.customer.email,
    austin: scenario.customer.inAustin ? "yes" : "no",
    solar: scenario.customer.hasSolar ? "yes" : "no",
    demo: scenario.id,
  });
  return `/start?${params.toString()}`;
}

/** The stored switch value as a rate. Anything unreadable counts as off. */
export function storedFailureRate(value: string | null): number {
  const rate = Number(value);
  return Number.isFinite(rate) && rate > 0 ? Math.min(rate, 1) : 0;
}

/** Server side: a demo request may raise the rate above the env setting, up to the cap. */
export function simulatedFailureRate(envRate: number, request: { demo?: boolean; simulateFailureRate?: number }): number {
  const base = Number.isFinite(envRate) && envRate > 0 ? envRate : 0;
  if (!request.demo) return base;
  const asked = request.simulateFailureRate ?? 0;
  return Math.max(base, Math.min(Number.isFinite(asked) ? Math.max(0, asked) : 0, MAX_REQUESTED_FAILURE_RATE));
}
