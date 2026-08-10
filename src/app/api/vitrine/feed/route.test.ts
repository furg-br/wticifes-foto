import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ list: vi.fn(), mark: vi.fn() }));
vi.mock("@/lib/rate-limit", () => ({
  rateLimitIdentity: () => "network",
  DistributedAbuseProtection: class { assertFeedAllowed = vi.fn().mockResolvedValue(undefined); },
}));
vi.mock("@/lib/image-repository", () => ({
  listShowcaseCandidates: mocks.list,
  markShowcaseDisplayed: mocks.mark,
}));

import { GET } from "./route";

beforeEach(() => {
  vi.stubEnv("DOWNLOAD_SIGNING_SECRET", "d".repeat(32));
  mocks.mark.mockResolvedValue(undefined);
  mocks.list.mockResolvedValue([
    {
      id: "019fc3b2-061d-7ea0-b4de-4738900bd89f",
      tokenVersion: 4,
      publicationExpiresAt: new Date(Date.now() + 3_600_000),
      blobPath: "personalizadas/segredo.jpg",
      participantKeyHash: "hash-privado",
      contentHash: "conteudo-privado",
    },
  ]);
});
afterEach(() => {
  vi.clearAllMocks();
  vi.unstubAllEnvs();
});

describe("GET /api/vitrine/feed", () => {
  it("retorna só URL curta e expiração, sem metadados privados", async () => {
    const response = await GET(new Request("https://foto.example.org/api/vitrine/feed"));
    const body = (await response.json()) as { images: Array<Record<string, unknown>> };
    expect(response.status).toBe(200);
    expect(Object.keys(body.images[0] ?? {}).sort()).toEqual(["expires_at", "url"]);
    expect(JSON.stringify(body)).not.toMatch(/blobPath|personalizadas|participant|contentHash|image_id/);
    expect(mocks.mark).toHaveBeenCalledWith("00000000-0000-4000-8000-000000000001", ["019fc3b2-061d-7ea0-b4de-4738900bd89f"]);
    expect(response.headers.get("cache-control")).toContain("no-store");
  });
});
