import { createHash, timingSafeEqual } from "node:crypto";
import { AppError } from "./app-error";
import { getCronSecret } from "./env";

function digest(value: string): Buffer {
  return createHash("sha256").update(value, "utf8").digest();
}

export function secretsMatch(received: string, expected: string): boolean {
  return timingSafeEqual(digest(received), digest(expected));
}

function readBearer(headers: Headers): string | undefined {
  const authorization = headers.get("authorization");
  if (!authorization?.startsWith("Bearer ")) return undefined;
  const token = authorization.slice("Bearer ".length);
  return token === "" ? undefined : token;
}

export function assertCronAuthorized(headers: Headers): void {
  const expected = getCronSecret();
  if (!expected || expected.length < 16) {
    throw new AppError(
      "SERVICE_NOT_CONFIGURED",
      503,
      "A limpeza automática ainda não está configurada.",
    );
  }

  if (!secretsMatch(readBearer(headers) ?? "", expected)) {
    throw new AppError("UNAUTHORIZED", 401, "Credencial inválida.");
  }
}
