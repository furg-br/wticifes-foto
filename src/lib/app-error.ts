export class AppError extends Error {
  readonly code: string;
  readonly status: number;
  readonly responseHeaders: HeadersInit | undefined;

  constructor(
    code: string,
    status: number,
    message: string,
    options?: { cause?: unknown; headers?: HeadersInit },
  ) {
    super(message, options?.cause === undefined ? undefined : { cause: options.cause });
    this.name = "AppError";
    this.code = code;
    this.status = status;
    this.responseHeaders = options?.headers;
  }
}

export function errorResponse(error: unknown, requestId: string): Response {
  const appError =
    error instanceof AppError
      ? error
      : new AppError(
          "INTERNAL_ERROR",
          500,
          "Não foi possível concluir a personalização.",
          { cause: error },
        );

  const log = JSON.stringify({
    level: appError.status >= 500 ? "error" : "warn",
    event: appError.status >= 500 ? "request_failed" : "request_rejected",
    requestId,
    status: appError.status,
    code: appError.code,
  });
  if (appError.status >= 500) console.error(log);
  else console.warn(log);

  const headers = new Headers(appError.responseHeaders);
  headers.set("Cache-Control", "no-store");
  headers.set("X-Request-Id", requestId);

  return Response.json(
    {
      sucesso: false,
      erro: { codigo: appError.code, mensagem: appError.message },
      request_id: requestId,
    },
    { status: appError.status, headers },
  );
}
