import type { Metadata } from "next";
import { DemoScreen } from "@/components/demo-screen";
import { demoStartPath } from "@/lib/demo";
import { DEMO_SCENARIOS } from "@/lib/demoScenarios";

export const metadata: Metadata = { title: "Demo | site-check" };

export default function DemoPage() {
  const scenarios = DEMO_SCENARIOS.map((s) => ({ id: s.id, label: s.label, startPath: demoStartPath(s) }));
  return <DemoScreen scenarios={scenarios} />;
}
