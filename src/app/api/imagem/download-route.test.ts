import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ find: vi.fn(), read: vi.fn(), admin: vi.fn() }));
vi.mock("@/lib/image-repository", () => ({ findImageById: mocks.find }));
vi.mock("@/lib/storage", () => ({ readPersonalizedImage: mocks.read }));
vi.mock("@/lib/admin-auth", () => ({ requireAdmin: mocks.admin }));

import { createImageGrant } from "@/lib/crypto-tokens";
import { GET } from "./[token]/route";

const id = "019fc3b2-061d-7ea0-b4de-4738900bd89f";
const active = {
  id,
  status: "approved",
  consentedAt: new Date(),
  removedAt: null,
  deletedAt: null,
  publicationExpiresAt: new Date(Date.now() + 60_000),
  expiresAt: new Date(Date.now() + 60_000),
  tokenVersion: 2,
  blobPath: "personalizadas/a.jpg",
};

beforeEach(() => {
  vi.stubEnv("DOWNLOAD_SIGNING_SECRET", "d".repeat(32));
  mocks.find.mockResolvedValue(active);
  mocks.read.mockResolvedValue({
    statusCode: 200,
    stream: new ReadableStream({ start(controller) { controller.enqueue(new Uint8Array([1, 2])); controller.close(); } }),
    blob: { size: 2 },
  });
});
afterEach(() => {
  vi.clearAllMocks();
  vi.unstubAllEnvs();
});

function context(token: string) {
  return { params: Promise.resolve({ token }) };
}

describe("download autorizado por estado", () => {
  it("serve imagem pública aprovada e consentida", async () => {
    const token = createImageGrant({ imageId: id, tokenVersion: 2, audience: "public", expiresAt: new Date(Date.now() + 60_000) });
    const response = await GET(new Request(`https://foto.example.org/api/imagem/${token}`), context(token));
    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toBe("image/jpeg");
  });

  it("nega removida e versão revogada antes de acessar o Blob", async () => {
    const token = createImageGrant({ imageId: id, tokenVersion: 2, audience: "public", expiresAt: new Date(Date.now() + 60_000) });
    mocks.find.mockResolvedValueOnce({ ...active, status: "removed", removedAt: new Date(), tokenVersion: 3 });
    expect((await GET(new Request(`https://foto.example.org/api/imagem/${token}`), context(token))).status).toBe(404);
    expect(mocks.read).not.toHaveBeenCalled();
  });

  it("nega URL assinada expirada", async () => {
    const token = createImageGrant({ imageId: id, tokenVersion: 2, audience: "public", expiresAt: new Date(Date.now() - 1_000) });
    expect((await GET(new Request(`https://foto.example.org/api/imagem/${token}`), context(token))).status).toBe(410);
    expect(mocks.find).not.toHaveBeenCalled();
  });
});
