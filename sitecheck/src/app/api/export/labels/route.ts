import { NextResponse } from "next/server";
import { serverError } from "@/lib/api";
import { loadLabeledData } from "@/lib/homes";
import { labelEntries } from "@/lib/labeledData";

export const runtime = "nodejs";
export const maxDuration = 60;
export const dynamic = "force-dynamic";

/** Labeled photos of every decided home as a JSON download. No names or emails. */
export async function GET() {
  try {
    const { homes, photos, corrections } = await loadLabeledData();
    const entries = labelEntries(homes, photos, corrections);
    const day = new Date().toISOString().slice(0, 10);
    return new NextResponse(JSON.stringify(entries, null, 2), {
      headers: {
        "content-type": "application/json; charset=utf-8",
        "content-disposition": `attachment; filename="site-check-labels-${day}.json"`,
        "cache-control": "no-store",
      },
    });
  } catch (err) {
    return serverError("export.labels", err);
  }
}
