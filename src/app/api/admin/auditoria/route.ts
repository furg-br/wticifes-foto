import { randomUUID } from "node:crypto";
import { errorResponse } from "@/lib/app-error";
import { requireAdmin } from "@/lib/admin-auth";
import { listAudit } from "@/lib/image-repository";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(): Promise<Response> {
  const requestId = randomUUID();
  try {
    await requireAdmin();
    const records = await listAudit(undefined, 100);
    return Response.json(
      {
        records: records.map((record) => ({
          id: record.id,
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
