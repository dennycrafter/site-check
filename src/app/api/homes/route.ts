import { NextResponse } from "next/server";
import { z } from "zod";
import { jsonError, readJson, serverError } from "@/lib/api";
import { recomputeHome } from "@/lib/homes";
import { getSupabase } from "@/lib/supabase";

export const runtime = "nodejs";
export const maxDuration = 60;

const CreateHomeZod = z.object({
  customerName: z.string().trim().min(1).max(200),
  customerEmail: z.email().max(320),
  inAustin: z.boolean(),
  hasSolar: z.boolean(),
});

export async function POST(request: Request) {
  const body = CreateHomeZod.safeParse(await readJson(request));
  if (!body.success) {
    return jsonError(400, "Please fill in your name, a valid email, and answer both questions.");
  }
  try {
    const { data, error } = await getSupabase()
      .from("homes")
      .insert({
        customer_name: body.data.customerName,
        customer_email: body.data.customerEmail,
        in_austin: body.data.inAustin,
        has_solar: body.data.hasSolar,
      })
      .select("id")
      .single();
    if (error) throw error;
    await recomputeHome(data.id);
    return NextResponse.json({ id: data.id }, { status: 201 });
  } catch (err) {
    return serverError("homes.create", err);
  }
}
