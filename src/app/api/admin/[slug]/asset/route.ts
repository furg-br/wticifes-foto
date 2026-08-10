import { randomUUID } from "node:crypto";
import { AppError, errorResponse } from "@/lib/app-error";
import { assertAdminCsrf, requireEventAdmin } from "@/lib/admin-auth";
import { eventAssetPath, loadAsset, normalizeEventAsset, type EventAssetKind } from "@/lib/event-assets";
import { updateEventAsset } from "@/lib/event-repository";

export const runtime = "nodejs";
export const maxDuration = 30;

function isEventAssetKind(value: unknown): value is EventAssetKind {
  return value === "logo" || value === "side" || value === "favicon";
}

export async function GET(request: Request, context: { params: Promise<{ slug: string }> }) {
  const requestId = randomUUID();
  try {
    const { slug } = await context.params;
    const kind = new URL(request.url).searchParams.get("kind");
    if (!isEventAssetKind(kind)) {
      throw new AppError("ASSET_NOT_FOUND", 404, "Ativo visual não encontrado.");
    }
    const { event } = await requireEventAdmin(slug);
    const data = await loadAsset(eventAssetPath(event, kind));
    return new Response(new Uint8Array(data), {
      headers: {
        "Content-Type": "image/png",
        "Cache-Control": "private, no-store",
        "X-Content-Type-Options": "nosniff",
        "X-Request-Id": requestId,
      },
    });
  } catch (error) {
    return errorResponse(error, requestId);
  }
}

export async function POST(request: Request, context: { params: Promise<{ slug: string }> }) {
  const requestId = randomUUID();
  try {
    const { slug } = await context.params;
    const { admin, event } = await requireEventAdmin(slug);
    const form = await request.formData();
    const csrf = form.get("csrf_token");
    const kind = form.get("kind");
    const file = form.get("file");
    if (typeof csrf !== "string" || !isEventAssetKind(kind) || !(file instanceof File)) {
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
