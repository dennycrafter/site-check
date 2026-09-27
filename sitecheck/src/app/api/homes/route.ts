import { NextResponse } from "next/server";
import { z } from "zod";
import { jsonError, readJson, serverError } from "@/lib/api";
import { recomputeHome } from "@/lib/homes";
import { getSupabase } from "@/lib/supabase";

export const runtime = "nodejs";
export const maxDuration = 60;

/**
 * Base's signup system creates the home with what it already knows about the
 * customer, then sends them the /capture/[id] link. The demo home page stands in for it.
 */
const CreateHomeZod = z
  .object({
    address: z.string().trim().min(5).max(300).optional(),
    customerName: z.string().trim().min(1).max(200).optional(),
    customerEmail: z.email().max(320).optional(),
    inAustin: z.boolean().optional(),
    hasSolar: z.boolean().optional(),
    externalRef: z.string().trim().min(1).max(100).optional(),
  })
  .refine((b) => b.address || b.customerName, { message: "address or customerName is required" });

export async function POST(request: Request) {
  const body = CreateHomeZod.safeParse(await readJson(request));
  if (!body.success) {
    return jsonError(400, "Please enter the full address of the home.");
  }
  try {
    const { data, error } = await getSupabase()
      .from("homes")
      .insert({
        address: body.data.address ?? null,
        customer_name: body.data.customerName ?? null,
        customer_email: body.data.customerEmail ?? null,
        in_austin: body.data.inAustin ?? null,
        has_solar: body.data.hasSolar ?? null,
        external_ref: body.data.externalRef ?? null,
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
