import { AppError, errorResponse } from "@/lib/app-error";
import { assertAdminCsrf, requireEventAdmin } from "@/lib/admin-auth";
import { updateEventSettings, type EventSettingsInput } from "@/lib/event-repository";
import { readJsonRequest } from "@/lib/request";
import { eventSettingsSchema } from "@/lib/schema";
import { safeRequestId } from "@/lib/request-id";

export async function POST(request: Request, context: { params: Promise<{ slug: string }> }) {
  const requestId = safeRequestId(request.headers);
  try {
    const { slug } = await context.params;
    const { admin, event } = await requireEventAdmin(slug);
    const parsed = eventSettingsSchema.safeParse(await readJsonRequest(request));
    if (!parsed.success) throw new AppError("INVALID_REQUEST", 400, "Revise os textos e tente novamente.");
    assertAdminCsrf(request, parsed.data.csrf_token, admin.email);
    const settings = Object.fromEntries(
      Object.entries(parsed.data).filter(([key]) => key !== "csrf_token"),
    ) as unknown as EventSettingsInput;
    const updated = await updateEventSettings(event.id, settings);
    return Response.json({ success: true, version: updated.configVersion }, { headers: { "Cache-Control": "no-store", "X-Request-Id": requestId } });
  } catch (error) {
    return errorResponse(error, requestId);
  }
}
