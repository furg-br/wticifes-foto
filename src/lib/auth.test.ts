import { afterEach, describe, expect, it, vi } from "vitest";
import { assertCronAuthorized, secretsMatch } from "./auth";

afterEach(() => vi.unstubAllEnvs());

describe("autenticação do cron", () => {
  it("compara segredos em tempo constante", () => {
    expect(secretsMatch("segredo", "segredo")).toBe(true);
    expect(secretsMatch("curto", "um-segredo-bem-mais-longo")).toBe(false);
  });

  it("falha fechado e aceita somente o Bearer exato", () => {
    vi.stubEnv("CRON_SECRET", "");
    expect(() => assertCronAuthorized(new Headers())).toThrowError(
      expect.objectContaining({ code: "SERVICE_NOT_CONFIGURED", status: 503 }),
    );
    const secret = "c".repeat(32);
    vi.stubEnv("CRON_SECRET", secret);
    expect(() => assertCronAuthorized(new Headers({ Authorization: `Bearer ${secret}` }))).not.toThrow();
    expect(() => assertCronAuthorized(new Headers({ Authorization: `Bearer ${secret}x` }))).toThrowError(
      expect.objectContaining({ code: "UNAUTHORIZED", status: 401 }),
    );
  });
});
