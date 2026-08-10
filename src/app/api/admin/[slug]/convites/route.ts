import { AppError, errorResponse } from "@/lib/app-error";
import { assertAdminCsrf, requireSuperAdmin } from "@/lib/admin-auth";
import { createAdminInvitation, findEventBySlug, hasEventAccess } from "@/lib/event-repository";
import { readJsonRequest } from "@/lib/request";
import { invitationSchema } from "@/lib/schema";
import { safeRequestId } from "@/lib/request-id";
import { getPublicAppUrl } from "@/lib/env";

export async function POST(request: Request, context: { params: Promise<{ slug: string }> }) {
  const requestId = safeRequestId(request.headers);
  try {
    const { slug } = await context.params;
    const admin = await requireSuperAdmin();
    const event = await findEventBySlug(slug);
    if (!event || !(await hasEventAccess(admin, event.id))) throw new AppError("EVENT_NOT_FOUND", 404, "Cadastro não encontrado.");
    const parsed = invitationSchema.safeParse(await readJsonRequest(request));
    if (!parsed.success) throw new AppError("INVALID_REQUEST", 400, "Informe um e-mail válido.");
    assertAdminCsrf(request, parsed.data.csrf_token, admin.email);
    if (parsed.data.email === admin.email) throw new AppError("INVALID_REQUEST", 409, "Você já possui acesso geral.");
    const result = await createAdminInvitation(event.id, parsed.data.email, admin.email);
    const origin = getPublicAppUrl() ?? new URL(request.url).origin;
    return Response.json({
      success: true,
      already_registered: result.alreadyRegistered,
      ...(result.token ? { invitation_url: new URL(`/admin/convite/${result.token}`, origin).toString() } : {}),
    }, { headers: { "Cache-Control": "no-store", "X-Request-Id": requestId } });
  } catch (error) {
    return errorResponse(error, requestId);
  }
}
