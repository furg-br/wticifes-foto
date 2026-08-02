import { createHash } from "node:crypto";
import sharp from "sharp";
import { describe, expect, it } from "vitest";
import { BRAND } from "./brand";
import { calculateLayout, personalizePhoto } from "./composer";

function hash(data: Buffer): string {
  return createHash("sha256").update(data).digest("hex");
}

describe.sequential("composição determinística", () => {
  it("mantém logo à esquerda e lettering à direita em qualquer proporção", () => {
    const sizes = [[1600, 800], [800, 1600], [1200, 1200]] as const;
    for (const [width, height] of sizes) {
      const layout = calculateLayout(width, height);
      expect(layout.mode).toBe("overlay");
      expect(layout.logo.left + layout.logo.width).toBeLessThan(layout.phrase.left);
      expect(layout.backdrop.top).toBeGreaterThanOrEqual(0);
      expect(layout.backdrop.top + layout.backdrop.height).toBeLessThanOrEqual(height);
    }
  });

  it("preserva uma foto pequena, sobrepõe a arte e remove metadados sensíveis", async () => {
    const input = await sharp({
      create: { width: 320, height: 500, channels: 3, background: "#8844CC" },
    })
      .withMetadata({ orientation: 1, exif: { IFD0: { Copyright: "Dado sensível" } } })
      .jpeg({ quality: 95 })
      .toBuffer();

    const first = await personalizePhoto(input, "image/jpeg");
    const second = await personalizePhoto(input, "image/jpeg");
    const metadata = await sharp(first.data).metadata();

    expect(hash(first.data)).toBe(hash(second.data));
    expect(first.photoWidth).toBe(320);
    expect(first.photoHeight).toBe(500);
    expect(first.width).toBe(320);
    expect(first.height).toBe(500);
    expect(first.layout).toBe("overlay");
    expect(metadata).toMatchObject({ format: "jpeg", width: 320, height: first.height, space: "srgb" });
    expect(metadata.hasProfile).toBe(true);
    expect(metadata.exif).toBeUndefined();
    expect(metadata.orientation).toBeUndefined();

    const topPixel = await sharp(first.data)
      .extract({ left: 10, top: 10, width: 1, height: 1 })
      .raw()
      .toBuffer();
    expect(topPixel[0]).toBeGreaterThan(120);
    expect(topPixel[2]).toBeGreaterThan(170);
  });

  it("respeita EXIF e reduz somente para caber nos limites", async () => {
    const orientedInput = await sharp({
      create: { width: 400, height: 200, channels: 3, background: "#2277AA" },
    })
      .jpeg()
      .withMetadata({ orientation: 6 })
      .toBuffer();
    const oriented = await personalizePhoto(orientedInput, "image/jpeg");
    expect(oriented.photoWidth).toBe(200);
    expect(oriented.photoHeight).toBe(400);

    const largeInput = await sharp({
      create: { width: 3000, height: 1000, channels: 3, background: "#2277AA" },
    })
      .png()
      .toBuffer();
    const large = await personalizePhoto(largeInput, "image/png");
    expect(large.photoWidth).toBe(2400);
    expect(large.photoHeight).toBe(800);
    expect(large.layout).toBe("overlay");
  });

  it("rejeita conteúdo disfarçado e MIME incompatível", async () => {
    await expect(personalizePhoto(Buffer.from("<svg></svg>"), "image/png")).rejects.toMatchObject({
      code: "INVALID_IMAGE",
    });

    const png = await sharp({
      create: { width: 100, height: 100, channels: 3, background: BRAND.green },
    })
      .png()
      .toBuffer();
    await expect(personalizePhoto(png, "image/jpeg")).rejects.toMatchObject({
      code: "INVALID_IMAGE",
    });
  });
});
