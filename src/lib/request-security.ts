import { AppError } from "./app-error";
import { getPublicAppUrl } from "./env";

export function assertPublicSameOrigin(request: Request): void {
  const origin = request.headers.get("origin");
  const expected = getPublicAppUrl() ?? new URL(request.url).origin;
  if (!origin || origin !== expected) {
    throw new AppError("ORIGIN_INVALID", 403, "Origem da solicitação inválida.");
  }
}
