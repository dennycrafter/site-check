import type { Metadata } from "next";
import { CaptureFlow } from "./capture-flow";

export const metadata: Metadata = { title: "Photo check | SiteCheck" };

export default async function CapturePage({ params }: PageProps<"/capture/[homeId]">) {
  const { homeId } = await params;
  return <CaptureFlow homeId={homeId} />;
}
