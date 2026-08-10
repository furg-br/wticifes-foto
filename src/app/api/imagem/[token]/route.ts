import { randomUUID } from "node:crypto";
import { AppError, errorResponse } from "@/lib/app-error";
import { requireAdmin } from "@/lib/admin-auth";
import { verifyImageGrant } from "@/lib/crypto-tokens";
import { findImageById } from "@/lib/image-repository";
import { readPersonalizedImage } from "@/lib/storage";
import { canAppearInShowcase } from "@/lib/publication-state";
import { hasEventAccess } from "@/lib/event-repository";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET(
  _request: Request,
  context: { params: Promise<{ token: string }> },
): Promise<Response> {
  const requestId = randomUUID();
  try {
    const { token } = await context.params;
    const grant = verifyImageGrant(token);
    const image = await findImageById(grant.imageId);
    const now = new Date();
    if (
      !image ||
      image.deletedAt ||
      image.tokenVersion !== grant.tokenVersion ||
      (grant.eventId && image.eventId !== grant.eventId)
    ) {
      throw new AppError("DOWNLOAD_NOT_FOUND", 404, "A imagem não foi encontrada.");
    }
    if (grant.audience === "moderation") {
      const admin = await requireAdmin();
      if (!(await hasEventAccess(admin, image.eventId))) {
        throw new AppError("DOWNLOAD_NOT_FOUND", 404, "A imagem não foi encontrada.");
      }
    }
    if (grant.audience === "public") {
      if (!canAppearInShowcase(image, now)) {
        throw new AppError("DOWNLOAD_NOT_FOUND", 404, "A imagem não está disponível.");
      }
    } else if (grant.audience === "result") {
      if (image.status === "removed" || image.status === "expired" || image.expiresAt <= now) {
        throw new AppError("DOWNLOAD_EXPIRED", 410, "Este link de download expirou.");
      }
    }

    const result = await readPersonalizedImage(image.blobPath);
    if (!result || result.statusCode !== 200) {
      throw new AppError("DOWNLOAD_NOT_FOUND", 404, "A imagem não foi encontrada.");
    }
    return new Response(result.stream, {
      headers: {
        "Cache-Control": "private, no-store, max-age=0",
        "Content-Type": "image/jpeg",
        "Content-Length": String(result.blob.size),
        "Content-Disposition": 'inline; filename="wticifes-2026-eu-fui-tche.jpg"',
        "X-Content-Type-Options": "nosniff",
        "X-Request-Id": requestId,
      },
    });
  } catch (error) {
    return errorResponse(error, requestId);
  }
}
