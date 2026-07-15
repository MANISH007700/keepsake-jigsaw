import type { ImageAsset } from "./types";

export const MAX_FILE_SIZE = 15 * 1024 * 1024;
export const MAX_LONG_EDGE = 2048;

export function validateImageFile(file: File): string | null {
  const lowerName = file.name.toLowerCase();
  if (lowerName.endsWith(".heic") || lowerName.endsWith(".heif") || /hei[cf]/i.test(file.type)) {
    return "HEIC photos are not supported yet. Please export this photo as JPEG or PNG and try again.";
  }
  if (!['image/jpeg', 'image/png'].includes(file.type)) {
    return "That file type is not supported. Choose a JPEG or PNG photo.";
  }
  if (file.size > MAX_FILE_SIZE) {
    return "That photo is over 15 MB. Choose a smaller file or export a more compact copy.";
  }
  return null;
}

export async function decodeImageFile(file: File): Promise<ImageAsset> {
  const validationError = validateImageFile(file);
  if (validationError) throw new Error(validationError);
  try {
    const bitmap = await createImageBitmap(file);
    const scale = Math.min(1, MAX_LONG_EDGE / Math.max(bitmap.width, bitmap.height));
    const width = Math.max(1, Math.round(bitmap.width * scale));
    const height = Math.max(1, Math.round(bitmap.height * scale));
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext("2d", { alpha: false });
    if (!context) throw new Error("Canvas is unavailable in this browser.");
    context.imageSmoothingEnabled = true;
    context.imageSmoothingQuality = "high";
    context.drawImage(bitmap, 0, 0, width, height);
    bitmap.close();
    return { name: file.name, width, height, canvas };
  } catch (error) {
    if (error instanceof Error && error.message !== "The source image could not be decoded.") {
      throw new Error("We could not read that photo. It may be corrupt or incomplete; try another JPEG or PNG.");
    }
    throw error;
  }
}

export function pieceResolutionWarning(width: number, height: number, rows: number, cols: number): string | null {
  const shortestPieceEdge = Math.min(width / cols, height / rows);
  if (shortestPieceEdge < 40) {
    return "This photo is a little small for that many pieces. Choose fewer pieces for crisper edges.";
  }
  return null;
}
