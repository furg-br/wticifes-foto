import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createDownloadToken, verifyDownloadToken } from "./download-token";

beforeEach(() => {
  vi.stubEnv("DOWNLOAD_SIGNING_SECRET", "s".repeat(32));
});

afterEach(() => vi.unstubAllEnvs());

describe("links temporários", () => {
  it("assina sem revelar o caminho do Blob", () => {
    const expiration = new Date("2026-08-03T12:00:00.000Z");
    const token = createDownloadToken({
      imageId: "019fc3b2-061d-7ea0-b4de-4738900bd89f",
      tokenVersion: 3,
      audience: "public",
      expiresAt: expiration,
    });
    expect(token).not.toContain("personalizadas");
    expect(verifyDownloadToken(token, new Date("2026-08-03T11:59:59.000Z"))).toEqual({
      imageId: "019fc3b2-061d-7ea0-b4de-4738900bd89f",
      tokenVersion: 3,
      audience: "public",
      expiresAtEpoch: 1_785_758_400,
    });
  });

  it("rejeita adulteração e expiração", () => {
    const expiration = new Date("2026-08-03T12:00:00.000Z");
    const token = createDownloadToken({
      imageId: "019fc3b2-061d-7ea0-b4de-4738900bd89f",
      tokenVersion: 1,
      audience: "result",
      expiresAt: expiration,
    });
    const tampered = `${token.slice(0, -1)}${token.endsWith("a") ? "b" : "a"}`;
    expect(() => verifyDownloadToken(tampered, new Date("2026-08-03T11:00:00.000Z"))).toThrowError(
      expect.objectContaining({ code: "INVALID_DOWNLOAD", status: 404 }),
    );
    expect(() => verifyDownloadToken(token, expiration)).toThrowError(
      expect.objectContaining({ code: "DOWNLOAD_EXPIRED", status: 410 }),
    );
  });
});
