import { z } from "zod";
import { AppError, errorResponse } from "@/lib/app-error";
import { assertAdminCsrf, requireSuperAdmin } from "@/lib/admin-auth";
import { findEventBySlug, hasEventAccess, setEventAdminActive } from "@/lib/event-repository";
import { readJsonRequest } from "@/lib/request";
import { safeRequestId } from "@/lib/request-id";

const schema = z.object({ user_id: z.uuid(), active: z.boolean(), csrf_token: z.string().min(32).max(512) }).strict();

export async function POST(request: Request, context: { params: Promise<{ slug: string }> }) {
  const requestId = safeRequestId(request.headers);
  try {
    const { slug } = await context.params;
    const admin = await requireSuperAdmin();
    const event = await findEventBySlug(slug);
    if (!event || !(await hasEventAccess(admin, event.id))) throw new AppError("EVENT_NOT_FOUND", 404, "Cadastro não encontrado.");
    const parsed = schema.safeParse(await readJsonRequest(request));
    if (!parsed.success) throw new AppError("INVALID_REQUEST", 400, "Operação inválida.");
    assertAdminCsrf(request, parsed.data.csrf_token, admin.email);
    if (!(await setEventAdminActive(event.id, parsed.data.user_id, parsed.data.active))) throw new AppError("ADMIN_NOT_FOUND", 404, "Administrador não encontrado.");
    return Response.json({ success: true }, { headers: { "Cache-Control": "no-store", "X-Request-Id": requestId } });
  } catch (error) {
    return errorResponse(error, requestId);
  }
}
