import sharp from "sharp";
import { describe, expect, it } from "vitest";
import { BRAND } from "./brand";

const assetPath = "public/wticifes2026-phrase-brush.png";

function rgb(hex: string): readonly [number, number, number] {
  return [
    Number.parseInt(hex.slice(1, 3), 16),
    Number.parseInt(hex.slice(3, 5), 16),
    Number.parseInt(hex.slice(5, 7), 16),
  ];
}

describe("cores do lettering aprovado", () => {
  it("usa verde, vermelho e amarelo nesta ordem e mantém o vermelho sem pontos pretos", async () => {
    const image = await sharp(assetPath).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
    const regions = [
      { start: 0, end: 0.325, color: rgb(BRAND.green), minimum: 50_000 },
      { start: 0.325, end: 0.575, color: rgb(BRAND.red), minimum: 50_000, cleanRed: true },
      { start: 0.575, end: 1, color: rgb(BRAND.yellow), minimum: 70_000 },
    ] as const;

    for (const region of regions) {
      let matching = 0;
      let darkOpaque = 0;
      const firstX = Math.floor(image.info.width * region.start);
      const lastX = Math.floor(image.info.width * region.end);

      for (let y = 0; y < image.info.height; y += 1) {
        for (let x = firstX; x < lastX; x += 1) {
          const offset = (y * image.info.width + x) * 4;
          const red = image.data[offset] ?? 0;
          const green = image.data[offset + 1] ?? 0;
          const blue = image.data[offset + 2] ?? 0;
          const alpha = image.data[offset + 3] ?? 0;
          if (alpha < 200) continue;
          if (red === region.color[0] && green === region.color[1] && blue === region.color[2]) matching += 1;
          if (Math.max(red, green, blue) < 50) darkOpaque += 1;
        }
      }

      expect(matching).toBeGreaterThan(region.minimum);
      if ("cleanRed" in region) expect(darkOpaque).toBe(0);
    }
  });
});
