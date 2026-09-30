import { NextResponse } from "next/server";
import { z } from "zod";
import { jsonError, readJson, serverError } from "@/lib/api";
import { recomputeHome } from "@/lib/homes";
import { isMissingPropertyColumn } from "@/lib/property";
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
    /** From the address suggestion the demo form picked. */
    placeId: z.string().trim().min(1).max(300).optional(),
    lat: z.number().min(-90).max(90).optional(),
    lng: z.number().min(-180).max(180).optional(),
  })
  .refine((b) => b.address || b.customerName, { message: "address or customerName is required" });

export async function POST(request: Request) {
  const body = CreateHomeZod.safeParse(await readJson(request));
  if (!body.success) {
    return jsonError(400, "Please enter the full address of the home.");
  }
  const { lat, lng, placeId } = body.data;
  const row = {
    address: body.data.address ?? null,
    customer_name: body.data.customerName ?? null,
    customer_email: body.data.customerEmail ?? null,
    in_austin: body.data.inAustin ?? null,
    has_solar: body.data.hasSolar ?? null,
    external_ref: body.data.externalRef ?? null,
  };
  const property =
    lat !== undefined && lng !== undefined
      ? {
          address: body.data.address ?? "",
          source: "google" as const,
          placeId,
          house: { lat, lng },
          meterUncertain: false,
          propertyConfirmed: false,
        }
      : null;
  try {
    const insert = (values: Record<string, unknown>) =>
      getSupabase().from("homes").insert(values).select("id").single();
    let { data, error } = property ? await insert({ ...row, property }) : await insert(row);
    if (property && isMissingPropertyColumn(error)) {
      console.error("[homes.create] property column missing, run supabase/migration-v4.sql", error);
      ({ data, error } = await insert(row));
    }
    if (error || !data) throw error ?? new Error("Insert returned no row");
    await recomputeHome(data.id);
    return NextResponse.json({ id: data.id }, { status: 201 });
  } catch (err) {
    return serverError("homes.create", err);
  }
}
