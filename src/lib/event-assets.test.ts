import sharp from "sharp";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ storeEventAsset: vi.fn() }));

vi.mock("./storage", () => ({
  readEventAsset: vi.fn(),
  storeEventAsset: mocks.storeEventAsset,
}));

import { normalizeEventAsset } from "./event-assets";

describe("ativos visuais do evento", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.storeEventAsset.mockResolvedValue("event-assets/event/favicon/file.png");
  });

  it("normaliza o favicon como PNG quadrado de 512 pixels", async () => {
    const source = await sharp({
      create: { width: 96, height: 48, channels: 4, background: { r: 20, g: 80, b: 120, alpha: 1 } },
    }).png().toBuffer();
    const file = new File([source], "favicon.png", { type: "image/png" });

    await normalizeEventAsset("00000000-0000-4000-8000-000000000002", "favicon", file);

    const normalized = mocks.storeEventAsset.mock.calls[0]?.[2] as Buffer;
    const metadata = await sharp(normalized).metadata();
    expect(metadata).toMatchObject({ format: "png", width: 512, height: 512 });
    expect(mocks.storeEventAsset).toHaveBeenCalledWith(
      "00000000-0000-4000-8000-000000000002",
      "favicon",
      expect.any(Buffer),
    );
  });
});
