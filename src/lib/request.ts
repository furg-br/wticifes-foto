import { AppError } from "./app-error";
import { INPUT_LIMITS } from "./constants";

export async function readJsonRequest(request: Request): Promise<unknown> {
  const mediaType = request.headers.get("content-type")?.split(";", 1)[0]?.trim();
  if (mediaType !== "application/json") {
    throw new AppError(
      "UNSUPPORTED_MEDIA_TYPE",
      415,
      "Envie o corpo como application/json.",
    );
  }

  const declaredLength = Number(request.headers.get("content-length"));
  if (Number.isFinite(declaredLength) && declaredLength > INPUT_LIMITS.requestBytes) {
    throw new AppError("REQUEST_TOO_LARGE", 413, "O corpo da requisição é muito grande.");
  }

  if (!request.body) {
    throw new AppError("INVALID_REQUEST", 400, "O corpo da requisição é obrigatório.");
  }

  const chunks: Uint8Array[] = [];
  let size = 0;
  const reader = request.body.getReader();

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > INPUT_LIMITS.requestBytes) {
        await reader.cancel();
        throw new AppError("REQUEST_TOO_LARGE", 413, "O corpo da requisição é muito grande.");
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }

  try {
    const text = new TextDecoder("utf-8", { fatal: true }).decode(Buffer.concat(chunks));
    return JSON.parse(text) as unknown;
  } catch (error) {
    if (error instanceof AppError) throw error;
    throw new AppError("INVALID_JSON", 400, "O JSON enviado é inválido.", { cause: error });
  }
}
