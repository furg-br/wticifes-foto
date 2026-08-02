import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ submit: vi.fn(), find: vi.fn() }));
vi.mock("@/lib/rate-limit", () => ({
  rateLimitIdentity: () => "network",
  DistributedAbuseProtection: class {
    assertNotBlocked = vi.fn().mockResolvedValue(undefined);
    registerInvalid = vi.fn().mockResolvedValue(undefined);
  },
}));
vi.mock("@/lib/image-repository", () => ({ submitConsent: mocks.submit, findImageById: mocks.find }));

import { POST } from "./route";

const id = "019fc3b2-061d-7ea0-b4de-4738900bd89f";
function request(token: string) {
  return new Request("https://foto.example.org/api/vitrine/submeter", {
    method: "POST",
    headers: { "Content-Type": "application/json", Origin: "https://foto.example.org" },
    body: JSON.stringify({ image_id: id, consent_token: token }),
  });
}

beforeEach(() => vi.stubEnv("NEXT_PUBLIC_APP_URL", "https://foto.example.org"));
afterEach(() => {
  vi.clearAllMocks();
  vi.unstubAllEnvs();
});

describe("consentimento da vitrine", () => {
  it("rejeita token inválido e expirado", async () => {
    mocks.submit.mockResolvedValue(undefined);
    mocks.find.mockResolvedValue({ consentTokenExpiresAt: new Date(Date.now() + 60_000) });
    expect((await POST(request("x".repeat(43)))).status).toBe(403);
    mocks.find.mockResolvedValue({ consentTokenExpiresAt: new Date(Date.now() - 60_000) });
    expect((await POST(request("x".repeat(43)))).status).toBe(410);
  });

  it("é idempotente sem transformar submissão em aprovação", async () => {
    mocks.submit.mockResolvedValue({ image: { id, status: "pending_review" }, changed: false });
    const response = await POST(request("x".repeat(43)));
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ status: "pending_review", already_submitted: true });
  });
});
