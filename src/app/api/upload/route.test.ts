import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ handleUpload: vi.fn(), reserve: vi.fn() }));
vi.mock("@vercel/blob/client", () => ({ handleUpload: mocks.handleUpload }));
vi.mock("@/lib/rate-limit", () => ({
  rateLimitIdentity: () => "network-hash",
  DistributedAbuseProtection: class { reserveUpload = mocks.reserve; },
}));

import { POST } from "./route";

const id = "019fc3b2-061d-7ea0-b4de-4738900bd89f";
function request(origin = "https://foto.example.org") {
  return new Request("https://foto.example.org/api/upload", {
    method: "POST",
    headers: { "Content-Type": "application/json", Origin: origin },
    body: JSON.stringify({ type: "blob.generate-client-token" }),
  });
}

beforeEach(() => {
  vi.stubEnv("GENERATION_ENABLED", "true");
  vi.stubEnv("RATE_LIMIT_SECRET", "r".repeat(32));
  vi.stubEnv("NEXT_PUBLIC_APP_URL", "https://foto.example.org");
  mocks.reserve.mockResolvedValue(undefined);
  mocks.handleUpload.mockImplementation(async (options) => {
    const tokenOptions = await options.onBeforeGenerateToken(
      `incoming/${id}.jpg`,
      JSON.stringify({ request_id: id }),
      false,
    );
    return { type: "blob.generate-client-token", clientToken: "signed", tokenOptions };
  });
});
afterEach(() => {
  vi.clearAllMocks();
  vi.unstubAllEnvs();
});

describe("autorização de upload privado", () => {
  it("reserva request_id e limita tipo/tamanho", async () => {
    const response = await POST(request());
    const body = (await response.json()) as { tokenOptions: Record<string, unknown> };
    expect(response.status).toBe(200);
    expect(body.tokenOptions).toMatchObject({ maximumSizeInBytes: 12 * 1024 * 1024, allowOverwrite: false });
    expect(mocks.reserve).toHaveBeenCalledWith(
      "network-hash",
      expect.stringMatching(/^[a-f0-9]{64}$/),
      `incoming/${id}.jpg`,
    );
  });

  it("nega origem cruzada", async () => {
    expect((await POST(request("https://malicioso.example"))).status).toBe(403);
    expect(mocks.reserve).not.toHaveBeenCalled();
  });
});
