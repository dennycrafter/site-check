import { NextResponse } from "next/server";
import { analysisModel, getAnthropic } from "@/lib/anthropic";
import { getSupabase, PHOTO_BUCKET } from "@/lib/supabase";

export const runtime = "nodejs";
export const maxDuration = 60;
export const dynamic = "force-dynamic";

function describe(err: unknown): string {
  if (err instanceof Error) return err.message;
  if (err && typeof err === "object" && "message" in err) return String(err.message);
  return String(err);
}

async function checkAnthropic(): Promise<string> {
  try {
    await getAnthropic().messages.create({
      model: analysisModel(),
      max_tokens: 5,
      messages: [{ role: "user", content: "Reply OK" }],
    });
    return "OK";
  } catch (err) {
    return describe(err);
  }
}

async function checkDatabase(): Promise<string> {
  try {
    // A HEAD count request reports no error when the table is missing, so read one row instead.
    const supabase = getSupabase();
    const [homes, photos] = await Promise.all([
      supabase.from("homes").select("id", { count: "exact" }).limit(1),
      supabase.from("photos").select("id").limit(1),
    ]);
    const error = homes.error ?? photos.error;
    return error ? describe(error) : "OK";
  } catch (err) {
    return describe(err);
  }
}

async function checkStorage(): Promise<string> {
  try {
    const { data, error } = await getSupabase().storage.getBucket(PHOTO_BUCKET);
    if (error) return describe(error);
    return data.public ? "Bucket 'photos' is public; it must be private" : "OK";
  } catch (err) {
    return describe(err);
  }
}

export async function GET() {
  const [anthropic, database, storage] = await Promise.all([
    checkAnthropic(),
    checkDatabase(),
    checkStorage(),
  ]);
  return NextResponse.json({ anthropic, database, storage });
}
