import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  put: vi.fn(),
}));

vi.mock("@vercel/blob", () => ({
  del: vi.fn(),
  get: vi.fn(),
  list: vi.fn(),
  put: mocks.put,
}));

import { storePersonalizedImage } from "./storage";

describe("storePersonalizedImage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.put.mockResolvedValue({ pathname: "personalizadas/2026-08-02/result.jpg" });
  });

  it("copia buffers de memória compartilhada antes de enviá-los ao Blob", async () => {
    const shared = new SharedArrayBuffer(4);
    const source = Buffer.from(shared);
    source.set([0xff, 0xd8, 0xff, 0xd9]);

    await storePersonalizedImage(source, new Date("2026-08-02T12:00:00.000Z"));

    const uploaded = mocks.put.mock.calls[0]?.[1] as Buffer;
    expect(Buffer.isBuffer(uploaded)).toBe(true);
    expect(uploaded).not.toBe(source);
    expect(uploaded.buffer).toBeInstanceOf(ArrayBuffer);
    expect(uploaded.buffer).not.toBeInstanceOf(SharedArrayBuffer);
    expect([...uploaded]).toEqual([0xff, 0xd8, 0xff, 0xd9]);
  });
});
