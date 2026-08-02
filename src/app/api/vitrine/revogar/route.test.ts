import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ revoke: vi.fn(), removeBlob: vi.fn(), markDeleted: vi.fn() }));
vi.mock("@/lib/rate-limit", () => ({
  rateLimitIdentity: () => "network",
  DistributedAbuseProtection: class {
    assertNotBlocked = vi.fn().mockResolvedValue(undefined);
    registerInvalid = vi.fn().mockResolvedValue(undefined);
  },
}));
vi.mock("@/lib/image-repository", () => ({ revokeImage: mocks.revoke, markDeleted: mocks.markDeleted }));
vi.mock("@/lib/storage", () => ({ deletePersonalizedImage: mocks.removeBlob }));

import { POST } from "./route";

const id = "019fc3b2-061d-7ea0-b4de-4738900bd89f";
function request() {
  return new Request("https://foto.example.org/api/vitrine/revogar", {
    method: "POST",
    headers: { "Content-Type": "application/json", Origin: "https://foto.example.org" },
    body: JSON.stringify({ image_id: id, revocation_token: "r".repeat(43) }),
  });
}

beforeEach(() => {
  vi.stubEnv("NEXT_PUBLIC_APP_URL", "https://foto.example.org");
  mocks.removeBlob.mockResolvedValue(undefined);
  mocks.markDeleted.mockResolvedValue(undefined);
});
afterEach(() => {
  vi.clearAllMocks();
  vi.unstubAllEnvs();
});

describe("revogação", () => {
  it("remove logicamente antes de apagar o Blob", async () => {
    mocks.revoke.mockResolvedValue({
      changed: true,
      image: { id, blobPath: "personalizadas/a.jpg", deletedAt: null },
    });
    const response = await POST(request());
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ status: "removed", already_removed: false });
    expect(mocks.revoke.mock.invocationCallOrder[0]).toBeLessThan(mocks.removeBlob.mock.invocationCallOrder[0] ?? Infinity);
    expect(mocks.markDeleted).toHaveBeenCalledWith(id);
  });

  it("nega token inválido", async () => {
    mocks.revoke.mockResolvedValue(undefined);
    expect((await POST(request())).status).toBe(403);
    expect(mocks.removeBlob).not.toHaveBeenCalled();
  });
});
