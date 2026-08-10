import { randomUUID } from "node:crypto";
import { AppError, errorResponse } from "@/lib/app-error";
import { requireAdmin } from "@/lib/admin-auth";
import { findAccessibleEvent } from "@/lib/event-repository";
import { listAudit } from "@/lib/image-repository";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request): Promise<Response> {
  const requestId = randomUUID();
  try {
    const admin = await requireAdmin();
    const slug = new URL(request.url).searchParams.get("slug")?.trim();
    let eventId: string | undefined;
    if (slug) {
      const event = await findAccessibleEvent(admin, slug);
      if (!event) throw new AppError("ADMIN_FORBIDDEN", 403, "Você não administra este espaço.");
      eventId = event.id;
    } else if (!admin.isSuperAdmin) {
      throw new AppError("EVENT_REQUIRED", 400, "Informe o espaço para consultar a auditoria.");
    }
    const records = await listAudit(eventId, undefined, 100);
    return Response.json(
      {
        records: records.map((record) => ({
          id: record.id,
          event_id: record.eventId,
          image_id: record.imageId,
          moderator_id: record.moderatorId,
          action: record.action,
          previous_status: record.previousStatus,
          new_status: record.newStatus,
          reason: record.reason,
          created_at: record.createdAt.toISOString(),
          request_id: record.requestId,
        })),
      },
      { headers: { "Cache-Control": "no-store", "X-Request-Id": requestId } },
    );
  } catch (error) {
    return errorResponse(error, requestId);
  }
}
