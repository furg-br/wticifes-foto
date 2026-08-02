import { randomUUID } from "node:crypto";
import { del, get, list, put } from "@vercel/blob";
import { AppError } from "./app-error";
import { OUTPUT } from "./constants";
import { getBlobTtlHours } from "./env";

export interface StoredImage {
  pathname: string;
  expiresAt: Date;
}

export async function storePersonalizedImage(data: Buffer, now = new Date()): Promise<StoredImage> {
  const day = now.toISOString().slice(0, 10);
  const pathname = `${OUTPUT.blobPrefix}${day}/${randomUUID()}.jpg`;

  try {
    const blob = await put(pathname, data, {
      access: "private",
      addRandomSuffix: false,
      allowOverwrite: false,
      contentType: "image/jpeg",
      cacheControlMaxAge: 3600,
    });
    const expiresAt = new Date(
      Math.floor((now.getTime() + getBlobTtlHours() * 60 * 60 * 1000) / 1000) * 1000,
    );
    return { pathname: blob.pathname, expiresAt };
  } catch (error) {
    throw new AppError(
      "STORAGE_UNAVAILABLE",
      502,
      "A imagem foi criada, mas não foi possível disponibilizar o download.",
      { cause: error },
    );
  }
}

export async function readPersonalizedImage(pathname: string) {
  try {
    return await get(pathname, { access: "private", useCache: true });
  } catch (error) {
    throw new AppError("STORAGE_UNAVAILABLE", 502, "Não foi possível obter a imagem.", {
      cause: error,
    });
  }
}

async function streamToLimitedBuffer(stream: ReadableStream, limit: number): Promise<Buffer> {
  const reader = stream.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > limit) {
        await reader.cancel();
        throw new AppError("IMAGE_TOO_LARGE", 413, "A fotografia excede o limite de 12 MB.");
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }
  return Buffer.concat(chunks, size);
}

export async function readTransientUpload(pathname: string): Promise<Buffer> {
  if (!/^incoming\/[0-9a-f-]{36}\.(?:jpg|jpeg|png|webp)$/i.test(pathname)) {
    throw new AppError("UPLOAD_NOT_AUTHORIZED", 403, "O upload não está autorizado.");
  }
  const result = await get(pathname, { access: "private", useCache: false });
  if (!result || result.statusCode !== 200) {
    throw new AppError("UPLOAD_NOT_FOUND", 404, "O upload não foi encontrado.");
  }
  const { INPUT_LIMITS } = await import("./constants");
  if (result.blob.size > INPUT_LIMITS.downloadBytes) {
    throw new AppError("IMAGE_TOO_LARGE", 413, "A fotografia excede o limite de 12 MB.");
  }
  return streamToLimitedBuffer(result.stream, INPUT_LIMITS.downloadBytes);
}

export async function deletePersonalizedImage(pathname: string): Promise<void> {
  try {
    await del(pathname);
  } catch (error) {
    throw new AppError("STORAGE_UNAVAILABLE", 502, "Não foi possível remover a imagem.", {
      cause: error,
    });
  }
}

export async function listStoredImagePaths(): Promise<string[]> {
  const paths: string[] = [];
  let cursor: string | undefined;
  do {
    const page = await list({ prefix: OUTPUT.blobPrefix, limit: 1000, ...(cursor ? { cursor } : {}) });
    paths.push(...page.blobs.map((blob) => blob.pathname));
    cursor = page.hasMore ? page.cursor : undefined;
  } while (cursor);
  return paths;
}

export async function deleteStaleTransientUploads(now = new Date(), maxAgeMinutes = 60): Promise<number> {
  const cutoff = now.getTime() - maxAgeMinutes * 60_000;
  let cursor: string | undefined;
  let deleted = 0;
  do {
    const page = await list({ prefix: "incoming/", limit: 1000, ...(cursor ? { cursor } : {}) });
    const stale = page.blobs.filter((blob) => blob.uploadedAt.getTime() <= cutoff).map((blob) => blob.pathname);
    if (stale.length) {
      await del(stale);
      deleted += stale.length;
    }
    cursor = page.hasMore ? page.cursor : undefined;
  } while (cursor);
  return deleted;
}

export async function deleteExpiredImages(now = new Date()): Promise<number> {
  const cutoff = now.getTime() - getBlobTtlHours() * 60 * 60 * 1000;
  let cursor: string | undefined;
  let deleted = 0;

  do {
    const page = await list({ prefix: OUTPUT.blobPrefix, limit: 1000, ...(cursor ? { cursor } : {}) });
    const expired = page.blobs
      .filter((blob) => blob.uploadedAt.getTime() <= cutoff)
      .map((blob) => blob.url);

    if (expired.length > 0) {
      await del(expired);
      deleted += expired.length;
    }
    cursor = page.hasMore ? page.cursor : undefined;
  } while (cursor);

  return deleted;
}
