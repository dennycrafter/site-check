const MAX_EDGE = 2000;
const MAX_BASE64_CHARS = 3_500_000;

type Rect = { x: number; y: number; width: number; height: number };

/** Draws the source (or the part of it inside rect) scaled down so the long edge is at most MAX_EDGE. */
function drawScaled(source: CanvasImageSource, width: number, height: number, rect?: Rect): HTMLCanvasElement {
  const area = rect ?? { x: 0, y: 0, width, height };
  const scale = Math.min(1, MAX_EDGE / Math.max(area.width, area.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(area.width * scale);
  canvas.height = Math.round(area.height * scale);
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas not supported");
  ctx.drawImage(source, area.x, area.y, area.width, area.height, 0, 0, canvas.width, canvas.height);
  return canvas;
}

/** The largest centered rect of the given aspect ratio (width / height) that fits in width x height. */
export function centerCrop(width: number, height: number, aspect: number): Rect {
  if (!(aspect > 0) || !Number.isFinite(aspect)) return { x: 0, y: 0, width, height };
  const cropWidth = Math.min(width, height * aspect);
  const cropHeight = Math.min(height, width / aspect);
  return { x: (width - cropWidth) / 2, y: (height - cropHeight) / 2, width: cropWidth, height: cropHeight };
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

/**
 * crop is a width / height ratio. The frame is center-cropped to it first, matching a
 * preview shown with object-fit: cover in a box of that ratio.
 */
export function captureVideoFrame(video: HTMLVideoElement, options: { crop?: number } = {}) {
  const { videoWidth: width, videoHeight: height } = video;
  const rect = options.crop ? centerCrop(width, height, options.crop) : undefined;
  return exportJpeg(drawScaled(video, width, height, rect));
}

function loadImage(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("Could not decode image"));
    };
    img.src = url;
  });
}

export async function prepareUpload(file: File) {
  let bitmap: ImageBitmap | null = null;
  try {
    bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
  } catch {
    // Older Safari rejects the options bag; <img> applies EXIF orientation by default.
    const img = await loadImage(file);
    return exportJpeg(drawScaled(img, img.naturalWidth, img.naturalHeight));
  }
  try {
    return exportJpeg(drawScaled(bitmap, bitmap.width, bitmap.height));
  } finally {
    bitmap.close();
  }
}
