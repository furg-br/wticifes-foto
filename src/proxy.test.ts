import { describe, expect, it } from "vitest";
import { buildContentSecurityPolicy } from "./proxy";

describe("Content Security Policy", () => {
  it("autoriza somente scripts com o nonce da requisição em produção", () => {
    const policy = buildContentSecurityPolicy("nonce-de-teste", false);
    const scriptDirective = policy.split("; ").find((directive) => directive.startsWith("script-src"));

    expect(scriptDirective).toBe("script-src 'self' 'nonce-nonce-de-teste' 'strict-dynamic'");
  });

  it("permite eval apenas no ambiente de desenvolvimento", () => {
    expect(buildContentSecurityPolicy("nonce-de-teste", true)).toContain("'unsafe-eval'");
  });

  it("permite o plano de controle e o armazenamento do Vercel Blob", () => {
    const policy = buildContentSecurityPolicy("nonce-de-teste", false);
    const connectDirective = policy.split("; ").find((directive) => directive.startsWith("connect-src"));

    expect(connectDirective).toBe(
      "connect-src 'self' https://vercel.com https://*.blob.vercel-storage.com",
    );
  });
});
