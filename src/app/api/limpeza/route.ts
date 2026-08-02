import { randomUUID } from "node:crypto";
import { errorResponse } from "@/lib/app-error";
import { assertCronAuthorized } from "@/lib/auth";
import { runRetention } from "@/lib/retention";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET(request: Request): Promise<Response> {
  const requestId = randomUUID();
  try {
    assertCronAuthorized(request.headers);
    const report = await runRetention();
    console.info(JSON.stringify({ level: "info", event: "retention_completed", requestId, ...report }));
    return Response.json(
      { success: true, ...report, request_id: requestId },
      { headers: { "Cache-Control": "no-store", "X-Request-Id": requestId } },
    );
  } catch (error) {
    return errorResponse(error, requestId);
  }
}
