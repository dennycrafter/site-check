import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { parseStartLink } from "./startLink";
import {
  demoFiles,
  demoPhotoUrl,
  demoStartPath,
  fileForPress,
  MAX_REQUESTED_FAILURE_RATE,
  parseScenarios,
  photoNames,
  simulatedFailureRate,
  storedFailureRate,
} from "./demo";

const customer = { name: "Denis", email: "denis@example.com", inAustin: true, hasSolar: false };
const raw = {
  retakes: { label: "Needs retakes", customer, steps: { meter_closeup: ["close-dark", "close"] } },
  good: { label: "Your home", customer, steps: { meter_area_wide: ["wide"], meter_closeup: ["close"] } },
};

describe("parseScenarios", () => {
  it("keeps file order and the ids", () => {
    const list = parseScenarios(raw);
    expect(list.map((s) => s.id)).toEqual(["retakes", "good"]);
    expect(list[0].label).toBe("Needs retakes");
  });

  it("rejects unknown steps, bad names and a missing fallback", () => {
    expect(() => parseScenarios({ ...raw, good: { ...raw.good, steps: { front_door: ["x"] } } })).toThrow();
    expect(() => parseScenarios({ ...raw, good: { ...raw.good, steps: { meter_closeup: ["Close.jpg"] } } })).toThrow();
    expect(() => parseScenarios({ retakes: raw.retakes })).toThrow(/good/);
  });
});

describe("demoFiles and fileForPress", () => {
  const list = parseScenarios(raw);

  it("uses the scenario's own files, then the fallback, then nothing", () => {
    expect(demoFiles(list, "retakes", "meter_closeup")).toEqual(["close-dark", "close"]);
    expect(demoFiles(list, "retakes", "meter_area_wide")).toEqual(["wide"]);
    expect(demoFiles(list, "retakes", "panel_open")).toEqual([]);
  });

  it("uses files in order and repeats the last one", () => {
    const files = demoFiles(list, "retakes", "meter_closeup");
    expect([0, 1, 2, 5].map((press) => fileForPress(files, press))).toEqual(["close-dark", "close", "close", "close"]);
    expect(fileForPress([], 0)).toBeNull();
  });
});

describe("demoStartPath", () => {
  it("is a valid start link that carries the scenario", () => {
    const [scenario] = parseScenarios(raw);
    const url = new URL(demoStartPath(scenario), "https://example.com");
    expect(url.pathname).toBe("/start");
    const link = parseStartLink(Object.fromEntries(url.searchParams));
    expect(link).toMatchObject({ firstName: "Denis", inAustin: true, hasSolar: false, extra: "demo=retakes" });
  });
});

describe("failure rate", () => {
  it("reads the stored switch value", () => {
    expect(storedFailureRate("0.3")).toBe(0.3);
    expect(storedFailureRate("0")).toBe(0);
    expect(storedFailureRate(null)).toBe(0);
    expect(storedFailureRate("on")).toBe(0);
  });

  it("only raises the rate for demo requests, and caps what they ask for", () => {
    expect(simulatedFailureRate(0, { simulateFailureRate: 0.3 })).toBe(0);
    expect(simulatedFailureRate(0, { demo: true, simulateFailureRate: 0.3 })).toBe(0.3);
    expect(simulatedFailureRate(0, { demo: true, simulateFailureRate: 1 })).toBe(MAX_REQUESTED_FAILURE_RATE);
    expect(simulatedFailureRate(0.4, { demo: true, simulateFailureRate: 0.1 })).toBe(0.4);
    expect(simulatedFailureRate(0.2, {})).toBe(0.2);
    expect(simulatedFailureRate(Number.NaN, { demo: true })).toBe(0);
  });
});

describe("public/demo/scenarios.json", () => {
  const root = path.resolve(import.meta.dirname, "../../public");
  const list = parseScenarios(JSON.parse(readFileSync(path.join(root, "demo/scenarios.json"), "utf8")));

  it.each(photoNames(list))("has the photo %s", (name) => {
    expect(existsSync(path.join(root, demoPhotoUrl(name)))).toBe(true);
  });
});
