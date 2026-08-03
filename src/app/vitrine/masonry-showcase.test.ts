import { describe, expect, it } from "vitest";
import { randomMasonryPosition } from "./masonry-showcase";

describe("posição do QR Code no mosaico", () => {
  it("pode ocupar qualquer posição, inclusive antes e depois das fotos", () => {
    expect(randomMasonryPosition(6, 0)).toBe(0);
    expect(randomMasonryPosition(6, 0.5)).toBe(3);
    expect(randomMasonryPosition(6, 0.999999)).toBe(6);
  });

  it("permanece como o único item quando ainda não há fotos", () => {
    expect(randomMasonryPosition(0, 0.75)).toBe(0);
  });
});
