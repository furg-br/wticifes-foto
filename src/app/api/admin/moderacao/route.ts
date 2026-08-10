import { AppError, errorResponse } from "@/lib/app-error";
import { assertAdminCsrf, requireEventAdmin } from "@/lib/admin-auth";
import { moderatorIdentifier } from "@/lib/crypto-tokens";
import { getRetention } from "@/lib/env";
import {
  auditedTransition,
  auditedBlockParticipant,
  findImageById,
  markDeleted,
} from "@/lib/image-repository";
import { readJsonRequest } from "@/lib/request";
import { moderationActionSchema } from "@/lib/schema";
import { deletePersonalizedImage } from "@/lib/storage";
import { safeRequestId } from "@/lib/request-id";
import { DEFAULT_EVENT_SLUG } from "@/db/schema";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 30;

export async function handleEventModeration(request: Request, slug: string): Promise<Response> {
  const requestId = safeRequestId(request.headers);
  try {
    const { admin, event } = await requireEventAdmin(slug);
    const parsed = moderationActionSchema.safeParse(await readJsonRequest(request));
    if (!parsed.success) throw new AppError("INVALID_REQUEST", 400, "Operação administrativa inválida.");
    assertAdminCsrf(request, parsed.data.csrf_token, admin.email);

    const current = await findImageById(parsed.data.image_id, event.id);
    if (!current || current.deletedAt) throw new AppError("IMAGE_NOT_FOUND", 404, "Imagem não encontrada.");
    if (parsed.data.action === "block_participant" && !current.participantKeyHash) {
      throw new AppError("PARTICIPANT_UNAVAILABLE", 409, "A imagem não possui participante identificável.");
    }
    const moderatorId = moderatorIdentifier(admin.email);
    const now = new Date();
    let nextStatus: "approved" | "rejected" | "removed";
    let expected: Array<"pending_review" | "approved">;
    const action = parsed.data.action;

    if (parsed.data.action === "approve") {
      if (!current.consentedAt) throw new AppError("CONSENT_REQUIRED", 409, "A imagem não possui consentimento.");
      nextStatus = "approved";
      expected = ["pending_review"];
    } else if (parsed.data.action === "reject") {
      nextStatus = "rejected";
      expected = ["pending_review"];
    } else {
      nextStatus = "removed";
      expected = ["approved", "pending_review"];
    }

    const changed = parsed.data.action === "block_participant"
      ? await auditedBlockParticipant(
          event.id,
          current.id,
          moderatorId,
          requestId,
          parsed.data.reason,
          now,
        )
      : await auditedTransition({
          eventId: event.id,
          imageId: current.id,
          expectedStatuses: expected,
          newStatus: nextStatus,
          action,
          moderatorId,
          requestId,
          ...(parsed.data.reason ? { reason: parsed.data.reason } : {}),
          ...(nextStatus === "approved"
            ? { publicationExpiresAt: new Date(now.getTime() + getRetention().approvedDays * 86_400_000) }
            : {}),
          now,
        });
    if (!changed) {
      throw new AppError("STATE_CONFLICT", 409, "A imagem foi alterada por outra operação.");
    }

    if (nextStatus === "rejected" || nextStatus === "removed") {
      try {
        await deletePersonalizedImage(changed.blobPath);
        await markDeleted(changed.id);
      } catch {
        console.error(JSON.stringify({ level: "error", event: "blob_delete_deferred", requestId, imageId: changed.id }));
      }
    }

    console.info(JSON.stringify({
      level: "info",
      event: "moderation_action",
      requestId,
      imageId: changed.id,
      action,
      status: changed.status,
    }));
    return Response.json(
      { success: true, image_id: changed.id, status: changed.status, request_id: requestId },
      { headers: { "Cache-Control": "no-store", "X-Request-Id": requestId } },
    );
  } catch (error) {
    return errorResponse(error, requestId);
  }
}

export async function POST(request: Request): Promise<Response> {
  return handleEventModeration(request, DEFAULT_EVENT_SLUG);
}
