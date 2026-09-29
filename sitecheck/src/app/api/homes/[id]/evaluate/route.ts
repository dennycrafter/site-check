import { NextResponse } from "next/server";
import { HomeIdZod, jsonError, serverError } from "@/lib/api";
import { loadHome, recomputeHome } from "@/lib/homes";

export const runtime = "nodejs";
export const maxDuration = 60;

/** Reruns the rules engine on the saved photos (no AI) and stores the verdict. Called at each phase checkpoint. */
export async function POST(_request: Request, ctx: RouteContext<"/api/homes/[id]/evaluate">) {
  const { id } = await ctx.params;
  if (!HomeIdZod.safeParse(id).success) return jsonError(404, "Home not found");
  try {
    if (!(await loadHome(id))) return jsonError(404, "Home not found");
    const { home } = await recomputeHome(id);
    console.log(`[evaluate] home=${id} verdict=${home.verdict} batteries=${home.battery_count} reasons=${home.reasons.map((r) => r.code).join(",")}`);
    return NextResponse.json({ verdict: home.verdict, batteryCount: home.battery_count, reasons: home.reasons });
  } catch (err) {
    return serverError("homes.evaluate", err);
  }
}
