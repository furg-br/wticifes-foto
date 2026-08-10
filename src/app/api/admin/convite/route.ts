import { z } from "zod";
import { AppError, errorResponse } from "@/lib/app-error";
import { assertAdminCsrf, requireAdminIdentity } from "@/lib/admin-auth";
import { acceptAdminInvitation } from "@/lib/event-repository";
import { readJsonRequest } from "@/lib/request";
import { safeRequestId } from "@/lib/request-id";

const schema = z.object({ token: z.string().min(32).max(256), csrf_token: z.string().min(32).max(512) }).strict();

export async function POST(request: Request) {
  const requestId = safeRequestId(request.headers);
  try {
    const admin = await requireAdminIdentity();
    const parsed = schema.safeParse(await readJsonRequest(request));
    if (!parsed.success) throw new AppError("INVALID_REQUEST", 400, "Convite inválido.");
    assertAdminCsrf(request, parsed.data.csrf_token, admin.email);
    const event = await acceptAdminInvitation(parsed.data.token, admin.email);
    if (!event) throw new AppError("INVITATION_INVALID", 403, "O convite não pertence a este e-mail, expirou ou já foi utilizado.");
    return Response.json({ success: true, slug: event.slug }, { headers: { "Cache-Control": "no-store", "X-Request-Id": requestId } });
  } catch (error) {
    return errorResponse(error, requestId);
  }
}
