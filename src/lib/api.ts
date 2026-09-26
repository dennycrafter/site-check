import "server-only";
import { NextResponse } from "next/server";
import { z } from "zod";

export const HomeIdZod = z.uuid();

export function jsonError(status: number, error: string, extra: Record<string, unknown> = {}) {
  return NextResponse.json({ error, ...extra }, { status });
}

export async function readJson(request: Request): Promise<unknown> {
  try {
    return await request.json();
  } catch {
    return undefined;
  }
}

/** Logs the real error server-side and returns a generic 500. */
export function serverError(context: string, err: unknown) {
  console.error(`[${context}]`, err);
  return jsonError(500, "Something went wrong on our side. Please try again.");
}
