import { NextResponse } from "next/server";
import { z } from "zod";
import { HomeIdZod, jsonError, readJson, serverError } from "@/lib/api";
import { getSupabase } from "@/lib/supabase";

export const runtime = "nodejs";
export const maxDuration = 60;

/** `decision: null` clears the decision (Undo). A missing note leaves the saved note as it is. */
const DecisionZod = z.object({
  decision: z.enum(["approved", "rejected", "needs_site_visit"]).nullable(),
  note: z.string().trim().max(2000).optional().nullable(),
});

export async function POST(request: Request, ctx: RouteContext<"/api/homes/[id]/decision">) {
  const { id } = await ctx.params;
  if (!HomeIdZod.safeParse(id).success) return jsonError(404, "Home not found");
  const body = DecisionZod.safeParse(await readJson(request));
  if (!body.success) return jsonError(400, "Decision must be approved, rejected, needs_site_visit or null.");
  const { decision, note } = body.data;
  try {
    const { data, error } = await getSupabase()
      .from("homes")
      .update({
        surveyor_decision: decision,
        decided_at: decision ? new Date().toISOString() : null,
        ...(note !== undefined ? { surveyor_note: note || null } : {}),
      })
      .eq("id", id)
      .select("surveyor_decision, surveyor_note");
    if (error) throw error;
    if (!data || data.length === 0) return jsonError(404, "Home not found");
    return NextResponse.json(data[0]);
  } catch (err) {
    return serverError("homes.decision", err);
  }
}
