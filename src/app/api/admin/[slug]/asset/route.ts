import { randomUUID } from "node:crypto";
import { AppError, errorResponse } from "@/lib/app-error";
import { assertAdminCsrf, requireEventAdmin } from "@/lib/admin-auth";
import { normalizeEventAsset } from "@/lib/event-assets";
import { updateEventAsset } from "@/lib/event-repository";

export const runtime = "nodejs";
export const maxDuration = 30;

export async function POST(request: Request, context: { params: Promise<{ slug: string }> }) {
  const requestId = randomUUID();
  try {
    const { slug } = await context.params;
    const { admin, event } = await requireEventAdmin(slug);
    const form = await request.formData();
    const csrf = form.get("csrf_token");
    const kind = form.get("kind");
    const file = form.get("file");
    if (typeof csrf !== "string" || (kind !== "logo" && kind !== "side") || !(file instanceof File)) {
      throw new AppError("INVALID_REQUEST", 400, "Envio de imagem inválido.");
    }
    assertAdminCsrf(request, csrf, admin.email);
    const pathname = await normalizeEventAsset(event.id, kind, file);
    const updated = await updateEventAsset(event.id, kind, pathname);
    return Response.json({ success: true, version: updated.configVersion }, { headers: { "Cache-Control": "no-store", "X-Request-Id": requestId } });
  } catch (error) {
    return errorResponse(error, requestId);
  }
}
