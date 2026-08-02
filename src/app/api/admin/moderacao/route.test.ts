import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AppError } from "@/lib/app-error";

const mocks = vi.hoisted(() => ({
  requireAdmin: vi.fn(),
  csrf: vi.fn(),
  find: vi.fn(),
  transition: vi.fn(),
  blockTransition: vi.fn(),
  block: vi.fn(),
  markDeleted: vi.fn(),
  deleteBlob: vi.fn(),
}));
vi.mock("@/lib/admin-auth", () => ({ requireAdmin: mocks.requireAdmin, assertAdminCsrf: mocks.csrf }));
vi.mock("@/lib/image-repository", () => ({
  findImageById: mocks.find,
  auditedTransition: mocks.transition,
  auditedBlockParticipant: mocks.blockTransition,
  blockParticipantFromImage: mocks.block,
  markDeleted: mocks.markDeleted,
}));
vi.mock("@/lib/storage", () => ({ deletePersonalizedImage: mocks.deleteBlob }));

import { POST } from "./route";

const id = "019fc3b2-061d-7ea0-b4de-4738900bd89f";
const pending = {
  id,
  status: "pending_review",
  consentedAt: new Date(),
  deletedAt: null,
  participantKeyHash: "p".repeat(64),
  blobPath: "personalizadas/a.jpg",
};

function request(action = "approve") {
  return new Request("https://foto.example.org/api/admin/moderacao", {
    method: "POST",
    headers: { "Content-Type": "application/json", Origin: "https://foto.example.org" },
    body: JSON.stringify({ image_id: id, action, csrf_token: "c".repeat(43) }),
  });
}

beforeEach(() => {
  vi.stubEnv("RATE_LIMIT_SECRET", "r".repeat(32));
  mocks.requireAdmin.mockResolvedValue({ email: "admin@example.org" });
  mocks.find.mockResolvedValue(pending);
  mocks.transition.mockResolvedValue({ ...pending, status: "approved" });
  mocks.deleteBlob.mockResolvedValue(undefined);
  mocks.markDeleted.mockResolvedValue(undefined);
});
afterEach(() => {
  vi.clearAllMocks();
  vi.unstubAllEnvs();
});

describe("moderação administrativa", () => {
  it("nega usuário fora da allowlist e mutação sem CSRF", async () => {
    mocks.requireAdmin.mockRejectedValueOnce(new AppError("ADMIN_FORBIDDEN", 403, "negado"));
    expect((await POST(request())).status).toBe(403);
    expect(mocks.find).not.toHaveBeenCalled();

    mocks.csrf.mockImplementationOnce(() => { throw new AppError("CSRF_INVALID", 403, "csrf"); });
    expect((await POST(request())).status).toBe(403);
    expect(mocks.transition).not.toHaveBeenCalled();
  });

  it("aprova somente por transição auditada e detecta concorrência", async () => {
    const response = await POST(request("approve"));
    expect(response.status).toBe(200);
    expect(mocks.transition).toHaveBeenCalledWith(expect.objectContaining({
      imageId: id,
      expectedStatuses: ["pending_review"],
      newStatus: "approved",
      action: "approve",
    }));
    mocks.transition.mockResolvedValueOnce(undefined);
    expect((await POST(request("approve"))).status).toBe(409);
  });

  it("rejeita, audita e apaga", async () => {
    mocks.transition.mockResolvedValueOnce({ ...pending, status: "rejected" });
    expect((await POST(request("reject"))).status).toBe(200);
    expect(mocks.transition).toHaveBeenCalledWith(expect.objectContaining({ action: "reject", newStatus: "rejected" }));
    expect(mocks.deleteBlob).toHaveBeenCalledWith(pending.blobPath);
    expect(mocks.markDeleted).toHaveBeenCalledWith(id);
  });
});
