import { afterEach, describe, expect, it, vi } from "vitest";
import { getContentSafetyProvider } from "./content-safety";

afterEach(() => vi.unstubAllEnvs());

describe("moderação de conteúdo", () => {
  it("permanece manual e nunca aprova automaticamente", async () => {
    vi.stubEnv("CONTENT_SAFETY_PROVIDER", "manual");
    const provider = getContentSafetyProvider();
    expect(provider.name).toBe("manual");
    expect(await provider.assess(Buffer.from("imagem"))).toEqual({ priority: 0, flags: [] });
  });

  it("falha fechado para provedor não implementado", () => {
    vi.stubEnv("CONTENT_SAFETY_PROVIDER", "automatico");
    expect(() => getContentSafetyProvider()).toThrow(/falha fechada/i);
  });
});
