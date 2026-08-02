import { randomUUID } from "node:crypto";

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function safeRequestId(headers: Headers): string {
  const supplied = headers.get("x-request-id")?.trim();
  return supplied && uuidPattern.test(supplied) ? supplied : randomUUID();
}
