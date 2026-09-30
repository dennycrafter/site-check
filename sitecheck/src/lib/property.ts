import { z } from "zod";
import type { HomeProperty } from "./types";

const CoordinateZod = z.object({ lat: z.number().min(-90).max(90), lng: z.number().min(-180).max(180) });
const MapPointZod = z.object({ x: z.number().min(0).max(1), y: z.number().min(0).max(1) });

export const PropertyZod = z.object({
  address: z.string().trim().max(300),
  source: z.enum(["google", "example"]),
  placeId: z.string().trim().min(1).max(300).optional(),
  house: CoordinateZod.optional(),
  meter: CoordinateZod.optional(),
  exampleMeter: MapPointZod.optional(),
  meterUncertain: z.boolean(),
  propertyConfirmed: z.boolean(),
  mapDone: z.boolean().optional(),
}) satisfies z.ZodType<HomeProperty>;

/** Until migration-v4.sql runs, writes that include property fail with this. */
export function isMissingPropertyColumn(error: { code?: string; message?: string } | null | undefined): boolean {
  if (!error) return false;
  return (error.code === "PGRST204" || error.code === "42703") && /property/.test(error.message ?? "");
}

export function googleMapsLink(point: { lat: number; lng: number }): string {
  return `https://www.google.com/maps?q=${point.lat},${point.lng}`;
}
