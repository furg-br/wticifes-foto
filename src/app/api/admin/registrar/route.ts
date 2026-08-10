import { AppError, errorResponse } from "@/lib/app-error";
import { assertAdminCsrf, requireSuperAdmin } from "@/lib/admin-auth";
import { createEvent, RESERVED_SLUGS } from "@/lib/event-repository";
import { readJsonRequest } from "@/lib/request";
import { createEventSchema } from "@/lib/schema";
import { safeRequestId } from "@/lib/request-id";

export async function POST(request: Request) {
  const requestId = safeRequestId(request.headers);
  try {
    const admin = await requireSuperAdmin();
    const parsed = createEventSchema.safeParse(await readJsonRequest(request));
    if (!parsed.success) throw new AppError("INVALID_REQUEST", 400, "Nome ou endereço inválido.");
    assertAdminCsrf(request, parsed.data.csrf_token, admin.email);
    if (RESERVED_SLUGS.has(parsed.data.slug)) throw new AppError("SLUG_RESERVED", 409, "Este endereço é reservado pelo sistema.");
    const created = await createEvent({ name: parsed.data.name, slug: parsed.data.slug, createdBy: admin.email });
    return Response.json({ success: true, id: created.id, slug: created.slug }, { headers: { "Cache-Control": "no-store", "X-Request-Id": requestId } });
  } catch (error) {
    if (error instanceof Error && "code" in error && error.code === "23505") {
      return errorResponse(new AppError("SLUG_EXISTS", 409, "Este endereço já está em uso."), requestId);
    }
    return errorResponse(error, requestId);
  }
}
