import { afterEach, describe, expect, it, vi } from "vitest";
import QRCode from "qrcode";
import { GET } from "./route";

afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

describe("GET /api/qrcode", () => {
  it("gera um PNG que aponta para a página principal configurada", async () => {
    vi.stubEnv("NEXT_PUBLIC_APP_URL", "https://foto.example.org");
    const generator = vi.spyOn(QRCode, "toBuffer");

    const response = await GET(new Request("https://deploy.example.org/api/qrcode"));
    const bytes = new Uint8Array(await response.arrayBuffer());

    expect(response.status).toBe(200);
    expect(response.headers.get("Content-Type")).toBe("image/png");
    expect(response.headers.get("Cache-Control")).toContain("s-maxage=3600");
    expect([...bytes.slice(0, 8)]).toEqual([137, 80, 78, 71, 13, 10, 26, 10]);
    expect(bytes.byteLength).toBeGreaterThan(1000);
    expect(generator).toHaveBeenCalledWith(
      "https://foto.example.org/wticifes-2026",
      expect.objectContaining({ errorCorrectionLevel: "H", width: 512 }),
    );
  });
});
