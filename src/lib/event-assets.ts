import { readFile } from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";
import type { EventRecord } from "@/db/schema";
import { AppError } from "./app-error";
import { readEventAsset, storeEventAsset } from "./storage";

const builtins: Record<string, string> = {
  "builtin:wticifes-logo": "wticifes2026-logo.png",
  "builtin:wticifes-phrase": "wticifes2026-phrase-brush.png",
};

export async function loadAsset(pathname: string): Promise<Buffer> {
  const builtin = builtins[pathname];
  if (builtin) return readFile(path.join(process.cwd(), "public", builtin));
  return readEventAsset(pathname);
}

export async function loadEventBranding(event: EventRecord) {
  const [logo, sideImage] = await Promise.all([
    loadAsset(event.logoPath),
    loadAsset(event.sideImagePath),
  ]);
  return { logo, sideImage };
}

export async function normalizeEventAsset(
  eventId: string,
  kind: "logo" | "side",
  file: File,
): Promise<string> {
  if (file.size < 1 || file.size > 2 * 1024 * 1024) {
    throw new AppError("ASSET_TOO_LARGE", 413, "A imagem deve ter no máximo 2 MB.");
  }
  if (!["image/png", "image/webp", "image/jpeg"].includes(file.type)) {
    throw new AppError("ASSET_TYPE_INVALID", 415, "Envie uma imagem PNG, WebP ou JPEG.");
  }
  const source = Buffer.from(await file.arrayBuffer());
  let image: ReturnType<typeof sharp>;
  try {
    image = sharp(source, { animated: false, limitInputPixels: 16_000_000 });
    const metadata = await image.metadata();
    if (!metadata.width || !metadata.height || (metadata.pages ?? 1) > 1) throw new Error("invalid");
  } catch (cause) {
    throw new AppError("ASSET_INVALID", 422, "A imagem enviada não é válida.", { cause });
  }
  const normalized = await image
    .rotate()
    .resize({ width: 2000, height: 1000, fit: "inside", withoutEnlargement: true })
    .png({ compressionLevel: 9 })
    .toBuffer();
  return storeEventAsset(eventId, kind, normalized);
}
