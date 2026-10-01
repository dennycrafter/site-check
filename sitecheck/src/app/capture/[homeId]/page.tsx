import type { Metadata } from "next";
import { demoCamera } from "@/lib/demoScenarios";
import { CaptureFlow } from "./capture-flow";

export const metadata: Metadata = { title: "Photo check | site-check" };

export default async function CapturePage({ params, searchParams }: PageProps<"/capture/[homeId]">) {
  const [{ homeId }, { demo }] = await Promise.all([params, searchParams]);
  return <CaptureFlow homeId={homeId} demo={demoCamera(typeof demo === "string" ? demo : undefined)} />;
}
