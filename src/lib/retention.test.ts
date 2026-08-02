import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  listCandidates: vi.fn(),
  expire: vi.fn(),
  markDeleted: vi.fn(),
  listActive: vi.fn(),
  deleteImage: vi.fn(),
  listPaths: vi.fn(),
  deleteTransient: vi.fn(),
}));
vi.mock("./image-repository", () => ({
  listRetentionCandidates: mocks.listCandidates,
  expireForRetention: mocks.expire,
  markDeleted: mocks.markDeleted,
  listActiveStorageRecords: mocks.listActive,
}));
vi.mock("./storage", () => ({
  deletePersonalizedImage: mocks.deleteImage,
  listStoredImagePaths: mocks.listPaths,
  deleteStaleTransientUploads: mocks.deleteTransient,
}));

import { runRetention } from "./retention";

beforeEach(() => {
  mocks.listCandidates.mockResolvedValue([
    { id: "expired", status: "approved", blobPath: "personalizadas/expired.jpg" },
  ]);
  mocks.listPaths.mockResolvedValue(["personalizadas/orphan.jpg"]);
  mocks.listActive.mockResolvedValue([
    { id: "missing", status: "pending_review", blobPath: "personalizadas/missing.jpg" },
  ]);
  mocks.deleteImage.mockResolvedValue(undefined);
  mocks.expire.mockResolvedValue(undefined);
  mocks.markDeleted.mockResolvedValue(undefined);
  mocks.deleteTransient.mockResolvedValue(2);
});
afterEach(() => vi.clearAllMocks());

describe("retenção", () => {
  it("expira registros, remove Blob órfão, marca Blob ausente e limpa ingressos", async () => {
    const report = await runRetention(new Date("2026-08-02T00:00:00Z"));
    expect(mocks.expire).toHaveBeenCalledWith("expired", "approved");
    expect(mocks.deleteImage).toHaveBeenCalledWith("personalizadas/orphan.jpg");
    expect(mocks.expire).toHaveBeenCalledWith("missing", "pending_review");
    expect(mocks.markDeleted).toHaveBeenCalledWith("missing", expect.any(Date));
    expect(report).toEqual({
      recordsDeleted: 1,
      orphanBlobsDeleted: 1,
      transientBlobsDeleted: 2,
      missingBlobsMarked: 1,
      failures: 0,
    });
  });
});
