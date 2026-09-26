import { NextResponse } from "next/server";
import { HomeIdZod, jsonError, serverError } from "@/lib/api";
import { loadHome, recomputeHome } from "@/lib/homes";
import { nextStep } from "@/lib/plan";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(_request: Request, ctx: RouteContext<"/api/homes/[id]/submit">) {
  const { id } = await ctx.params;
  if (!HomeIdZod.safeParse(id).success) return jsonError(404, "Home not found");
  try {
    const loaded = await loadHome(id);
    if (!loaded) return jsonError(404, "Home not found");
    if (loaded.home.status === "submitted") return NextResponse.json({ ok: true, alreadySubmitted: true });
    const pending = nextStep(loaded.home, loaded.photos);
    if (pending !== null) {
      return jsonError(409, "Some steps are not finished yet.", { nextStep: pending });
    }
    await recomputeHome(id, { status: "submitted", submitted_at: new Date().toISOString() });
    return NextResponse.json({ ok: true });
  } catch (err) {
    return serverError("homes.submit", err);
  }
}
