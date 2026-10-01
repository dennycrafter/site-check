import "server-only";
import raw from "../../public/demo/scenarios.json";
import { demoFiles, parseScenarios, type DemoCamera, type DemoScenario } from "./demo";
import { STEP_IDS } from "./steps";

/** Read once at build time. public/demo/scenarios.json is the only list of demo photo names. */
export const DEMO_SCENARIOS: DemoScenario[] = parseScenarios(raw);

export function demoCamera(id: string | undefined): DemoCamera | null {
  if (!id || !DEMO_SCENARIOS.some((s) => s.id === id)) return null;
  const files: Record<string, string[]> = {};
  for (const step of STEP_IDS) {
    const list = demoFiles(DEMO_SCENARIOS, id, step);
    if (list.length > 0) files[step] = list;
  }
  return { id, files };
}
