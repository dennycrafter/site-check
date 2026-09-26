const MAX_EDGE = 2000;
const MAX_BASE64_CHARS = 3_500_000;

function drawScaled(source: CanvasImageSource, width: number, height: number): HTMLCanvasElement {
  const scale = Math.min(1, MAX_EDGE / Math.max(width, height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(width * scale);
  canvas.height = Math.round(height * scale);
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas not supported");
  ctx.drawImage(source, 0, 0, canvas.width, canvas.height);
  return canvas;
}

/** JPEG base64 without the data URL prefix, re-encoded at lower quality if too large. */
function exportJpeg(canvas: HTMLCanvasElement): { base64: string; dataUrl: string } {
  let dataUrl = canvas.toDataURL("image/jpeg", 0.85);
  let base64 = dataUrl.replace(/^data:image\/jpeg;base64,/, "");
  if (base64.length > MAX_BASE64_CHARS) {
    dataUrl = canvas.toDataURL("image/jpeg", 0.7);
    base64 = dataUrl.replace(/^data:image\/jpeg;base64,/, "");
  }
  return { base64, dataUrl };
}

export function captureVideoFrame(video: HTMLVideoElement) {
  return exportJpeg(drawScaled(video, video.videoWidth, video.videoHeight));
}

export async function prepareUpload(file: File) {
  const bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
  try {
    return exportJpeg(drawScaled(bitmap, bitmap.width, bitmap.height));
  } finally {
    bitmap.close();
  }
}
