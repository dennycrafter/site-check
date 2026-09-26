import { NextResponse } from "next/server";
import { z } from "zod";
import { HomeIdZod, jsonError, readJson, serverError } from "@/lib/api";
import { analyzePhoto } from "@/lib/analyze";
import { decidePhoto, MESSAGES } from "@/lib/decide";
import { loadHome, recomputeHome } from "@/lib/homes";
import { isFinished, latestPhotoByStep, nextStep, planSteps } from "@/lib/plan";
import { getStep, isExtraStepId, isStepId, MAX_ATTEMPTS } from "@/lib/steps";
import { getSupabase, PHOTO_BUCKET } from "@/lib/supabase";
import type { PhotoStatus } from "@/lib/types";

export const runtime = "nodejs";
export const maxDuration = 120;

const MAX_BASE64_CHARS = 4_500_000;

const PhotoBodyZod = z.object({
  homeId: HomeIdZod,
  step: z.string().refine((s) => isStepId(s) || isExtraStepId(s)),
  imageBase64: z.string().min(100).max(MAX_BASE64_CHARS),
});

export async function POST(request: Request) {
  const body = PhotoBodyZod.safeParse(await readJson(request));
  if (!body.success) return jsonError(400, "Invalid photo upload.");
  const { homeId, step } = body.data;
  const imageBase64 = body.data.imageBase64.replace(/^data:image\/\w+;base64,/, "");

  const buffer = Buffer.from(imageBase64, "base64");
  if (buffer.length < 100 || buffer[0] !== 0xff || buffer[1] !== 0xd8) {
    return jsonError(400, "That file is not a JPEG photo.");
  }

  try {
    const loaded = await loadHome(homeId);
    if (!loaded) return jsonError(404, "Home not found");
    const { home, photos } = loaded;
    if (home.status === "submitted") return jsonError(409, "This home was already submitted.");
    const stepDef = getStep(step, home.extra_steps);
    if (!stepDef || !planSteps(home, photos).includes(step)) {
      return jsonError(409, "This step is not needed for your home.", { nextStep: nextStep(home, photos) });
    }
    if (isFinished(latestPhotoByStep(photos).get(step)?.status)) {
      return jsonError(409, "This step is already done.", { nextStep: nextStep(home, photos) });
    }

    const attempt = photos.filter((p) => p.step === step).length + 1;
    const storagePath = `${homeId}/${step}/${attempt}.jpg`;
    const supabase = getSupabase();

    const [upload, result] = await Promise.all([
      supabase.storage
        .from(PHOTO_BUCKET)
        .upload(storagePath, buffer, { contentType: "image/jpeg", upsert: false }),
      analyzePhoto({ homeId, step: stepDef, base64Jpeg: imageBase64 }),
    ]);
    if (upload.error) {
      const duplicate = /exist|duplicate/i.test(upload.error.message);
      if (duplicate) return jsonError(409, "This photo was already received. Please refresh.");
      throw new Error(`Storage upload failed: ${upload.error.message}`);
    }

    let status: PhotoStatus;
    let message: string;
    if (!result.ok) {
      status = "check_failed";
      message = MESSAGES.checkFailed;
    } else {
      const decision = decidePhoto(step, result.analysis);
      if (decision.accept) {
        status = "accepted";
        message = MESSAGES.accepted;
      } else if (attempt >= MAX_ATTEMPTS) {
        status = "accepted_after_max_attempts";
        message = MESSAGES.maxAttempts;
      } else {
        status = "retake";
        message = decision.message;
      }
    }

    const { error: insertError } = await supabase.from("photos").insert({
      home_id: homeId,
      step,
      attempt,
      storage_path: storagePath,
      status,
      analysis: result.ok ? result.analysis : null,
      error: result.ok ? null : result.error,
      model: result.model,
      latency_ms: result.latencyMs,
      ai_attempts: result.aiAttempts,
    });
    if (insertError) throw new Error(`Save photo failed: ${insertError.message}`);

    let next;
    if (status === "retake") {
      next = step;
    } else {
      const fresh = await recomputeHome(homeId);
      next = nextStep(fresh.home, fresh.photos);
    }

    return NextResponse.json({ status, message, attempt, nextStep: next });
  } catch (err) {
    return serverError("photos", err);
  }
}
