import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  readTransientUpload: vi.fn(),
  deletePersonalizedImage: vi.fn(),
  storePersonalizedImage: vi.fn(),
  personalizePhoto: vi.fn(),
  createPrivateImage: vi.fn(),
  claimUnidentifiedPrivateImage: vi.fn(),
  findByRequestKey: vi.fn(),
  findActiveByContentHash: vi.fn(),
  findImageById: vi.fn(),
  isParticipantBlocked: vi.fn(),
  countParticipantImages: vi.fn(),
  enter: vi.fn(),
  assertUploadReservation: vi.fn(),
  clearUploadReservation: vi.fn(),
  acquireLock: vi.fn(),
  rememberDuplicate: vi.fn(),
  rememberIdempotency: vi.fn(),
  idempotentImageId: vi.fn(),
  duplicateImageId: vi.fn(),
  registerInvalid: vi.fn(),
  assertParticipantTotal: vi.fn(),
}));

vi.mock("@/lib/composer", () => ({ personalizePhoto: mocks.personalizePhoto }));
vi.mock("@/lib/storage", () => ({
  readTransientUpload: mocks.readTransientUpload,
  deletePersonalizedImage: mocks.deletePersonalizedImage,
  storePersonalizedImage: mocks.storePersonalizedImage,
}));
vi.mock("@/lib/image-repository", () => ({
  createPrivateImage: mocks.createPrivateImage,
  claimUnidentifiedPrivateImage: mocks.claimUnidentifiedPrivateImage,
  findByRequestKey: mocks.findByRequestKey,
  findActiveByContentHash: mocks.findActiveByContentHash,
  findImageById: mocks.findImageById,
  isParticipantBlocked: mocks.isParticipantBlocked,
  countParticipantImages: mocks.countParticipantImages,
}));
vi.mock("@/lib/rate-limit", () => ({
  rateLimitIdentity: () => "network-hash",
  DistributedAbuseProtection: class {
    enter = mocks.enter;
    assertUploadReservation = mocks.assertUploadReservation;
    clearUploadReservation = mocks.clearUploadReservation;
    acquireLock = mocks.acquireLock;
    rememberDuplicate = mocks.rememberDuplicate;
    rememberIdempotency = mocks.rememberIdempotency;
    idempotentImageId = mocks.idempotentImageId;
    duplicateImageId = mocks.duplicateImageId;
    registerInvalid = mocks.registerInvalid;
    assertParticipantTotal = mocks.assertParticipantTotal;
  },
}));

import { POST } from "./route";
import { AppError } from "@/lib/app-error";
import { participantKeyHash, requestKeyHash } from "@/lib/crypto-tokens";

const id = "019fc3b2-061d-7ea0-b4de-4738900bd89f";
const body = {
  upload_path: `incoming/${id}.jpg`,
  mime_type: "image/jpeg",
  request_id: id,
};

function request(payload: unknown): Request {
  return new Request("https://foto.example.org/api/personalizar", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Origin: "https://foto.example.org",
      "X-Forwarded-For": "203.0.113.20",
    },
    body: JSON.stringify(payload),
  });
}

beforeEach(() => {
  vi.stubEnv("DOWNLOAD_SIGNING_SECRET", "d".repeat(32));
  vi.stubEnv("RATE_LIMIT_SECRET", "r".repeat(32));
  vi.stubEnv("GENERATION_ENABLED", "true");
  mocks.enter.mockResolvedValue({ remaining: 19, release: vi.fn().mockResolvedValue(undefined) });
  mocks.acquireLock.mockResolvedValue(vi.fn().mockResolvedValue(undefined));
  mocks.readTransientUpload.mockResolvedValue(Buffer.from("imagem"));
  mocks.deletePersonalizedImage.mockResolvedValue(undefined);
  mocks.clearUploadReservation.mockResolvedValue(undefined);
  mocks.findByRequestKey.mockResolvedValue(undefined);
  mocks.idempotentImageId.mockResolvedValue(null);
  mocks.findActiveByContentHash.mockResolvedValue(undefined);
  mocks.duplicateImageId.mockResolvedValue(null);
  mocks.isParticipantBlocked.mockResolvedValue(false);
  mocks.countParticipantImages.mockResolvedValue(0);
  mocks.assertParticipantTotal.mockResolvedValue(undefined);
  mocks.claimUnidentifiedPrivateImage.mockResolvedValue(undefined);
  mocks.personalizePhoto.mockResolvedValue({
    data: Buffer.from("jpeg"), width: 1000, height: 1200, photoWidth: 1000,
    photoHeight: 900, layout: "overlay",
  });
  mocks.storePersonalizedImage.mockResolvedValue({
    pathname: "personalizadas/2026-08-02/uuid.jpg",
    expiresAt: new Date("2026-08-03T12:00:00.000Z"),
  });
  mocks.createPrivateImage.mockImplementation(async (input) => ({
    ...input,
    status: "private",
    tokenVersion: 1,
    createdAt: new Date(),
    consentedAt: null,
    consentVersion: null,
    consentTokenUsedAt: null,
    submittedAt: null,
    approvedAt: null,
    approvedBy: null,
    rejectedAt: null,
    rejectedBy: null,
    rejectionReason: null,
    removedAt: null,
    removedBy: null,
    publicationExpiresAt: null,
    deletedAt: null,
    lastDisplayedAt: null,
    displayCount: 0,
    safetyPriority: 0,
    safetyFlags: null,
  }));
});

afterEach(() => {
  vi.clearAllMocks();
  vi.unstubAllEnvs();
});

describe("POST /api/personalizar standalone", () => {
  it("consome o upload transitório e retorna o resultado privado", async () => {
    const response = await POST(request(body));
    const json = (await response.json()) as Record<string, unknown>;
    expect(response.status).toBe(200);
    expect(json).toMatchObject({
      success: true,
      reused: false,
      expires_at: "2026-08-03T12:00:00.000Z",
    });
    expect(json.result_url).toMatch(/^https:\/\/foto\.example\.org\/api\/imagem\//);
    expect(mocks.assertUploadReservation).toHaveBeenCalledOnce();
    expect(mocks.readTransientUpload).toHaveBeenCalledWith(body.upload_path);
    expect(mocks.deletePersonalizedImage).toHaveBeenCalledWith(body.upload_path);
    expect(mocks.personalizePhoto).toHaveBeenCalledWith(Buffer.from("imagem"), "image/jpeg");
  });

  it("rejeita payload desconhecido antes de ler qualquer arquivo", async () => {
    const response = await POST(request({ arquivo: [] }));
    expect(response.status).toBe(400);
    expect(mocks.readTransientUpload).not.toHaveBeenCalled();
  });

  it("desliga a geração antes de autorizar upload", async () => {
    vi.stubEnv("GENERATION_ENABLED", "false");
    const response = await POST(request(body));
    expect(response.status).toBe(503);
    expect(mocks.assertUploadReservation).not.toHaveBeenCalled();
  });

  it("é idempotente por request_id mesmo após o upload transitório ser apagado", async () => {
    mocks.findByRequestKey.mockResolvedValueOnce({
      id,
      status: "private",
      deletedAt: null,
      requestKeyHash: requestKeyHash(id),
      participantKeyHash: null,
      tokenVersion: 1,
      expiresAt: new Date("2026-08-03T12:00:00.000Z"),
    });
    const response = await POST(request(body));
    expect(response.status).toBe(200);
    expect(mocks.assertUploadReservation).not.toHaveBeenCalled();
    expect(mocks.readTransientUpload).not.toHaveBeenCalled();
  });

  it("não reprocessa conteúdo duplicado de outra identidade", async () => {
    mocks.findActiveByContentHash.mockResolvedValueOnce({
      id: "119fc3b2-061d-7ea0-b4de-4738900bd89f",
      status: "private",
      deletedAt: null,
      requestKeyHash: "outro",
      participantKeyHash: null,
    });
    const response = await POST(request(body));
    expect(response.status).toBe(409);
    expect(mocks.personalizePhoto).not.toHaveBeenCalled();
  });

  it("devolve imagem e controles ao mesmo participante anônimo", async () => {
    const participantToken = "participante-seguro-123";
    mocks.findActiveByContentHash.mockResolvedValueOnce({
      id: "119fc3b2-061d-7ea0-b4de-4738900bd89f",
      status: "private",
      deletedAt: null,
      requestKeyHash: "outro",
      participantKeyHash: participantKeyHash(participantToken),
      consentedAt: null,
      tokenVersion: 1,
      expiresAt: new Date("2026-08-03T12:00:00.000Z"),
    });
    const response = await POST(request({ ...body, participant_token: participantToken }));
    const json = (await response.json()) as Record<string, unknown>;
    expect(response.status).toBe(200);
    expect(json).toMatchObject({ success: true, reused: true });
    expect(json.consent_token).toEqual(expect.any(String));
    expect(json.revocation_token).toEqual(expect.any(String));
    expect(mocks.personalizePhoto).not.toHaveBeenCalled();
  });

  it("vincula imagem privada antiga sem consentimento ao navegador que reapresenta o arquivo", async () => {
    const participantToken = "participante-seguro-123";
    const participantHash = participantKeyHash(participantToken);
    const legacy = {
      id: "119fc3b2-061d-7ea0-b4de-4738900bd89f",
      status: "private",
      deletedAt: null,
      requestKeyHash: "outro",
      participantKeyHash: null,
      consentedAt: null,
      tokenVersion: 1,
      expiresAt: new Date("2026-08-03T12:00:00.000Z"),
    };
    mocks.findActiveByContentHash.mockResolvedValueOnce(legacy);
    mocks.claimUnidentifiedPrivateImage.mockResolvedValueOnce({
      ...legacy,
      participantKeyHash: participantHash,
    });

    const response = await POST(request({ ...body, participant_token: participantToken }));
    const json = (await response.json()) as Record<string, unknown>;
    expect(response.status).toBe(200);
    expect(json).toMatchObject({ success: true, reused: true });
    expect(mocks.claimUnidentifiedPrivateImage).toHaveBeenCalledWith(legacy.id, participantHash);
    expect(mocks.rememberIdempotency).toHaveBeenCalledWith(expect.any(String), legacy.id);
  });

  it("retorna 409 quando o lock distribuído indica processamento concorrente", async () => {
    mocks.acquireLock.mockRejectedValueOnce(
      new AppError("DUPLICATE_IN_PROGRESS", 409, "em andamento"),
    );
    const response = await POST(request(body));
    expect(response.status).toBe(409);
    expect(mocks.readTransientUpload).not.toHaveBeenCalled();
  });

  it("aplica identidade HMAC e limite total quando há participant_token", async () => {
    const response = await POST(request({ ...body, participant_token: "participante-seguro-123" }));
    expect(response.status).toBe(200);
    expect(mocks.enter).toHaveBeenCalledWith("network-hash", expect.stringMatching(/^[a-f0-9]{64}$/));
    expect(mocks.countParticipantImages).toHaveBeenCalledWith(expect.stringMatching(/^[a-f0-9]{64}$/));
    expect(mocks.assertParticipantTotal).toHaveBeenCalledWith(expect.any(String), 0);
  });
});
