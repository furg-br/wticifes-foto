import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AppError } from "@/lib/app-error";

const mocks = vi.hoisted(() => ({
  requireEventAdmin: vi.fn(),
  assertAdminCsrf: vi.fn(),
  loadAsset: vi.fn(),
  normalizeEventAsset: vi.fn(),
  updateEventAsset: vi.fn(),
}));

vi.mock("@/lib/admin-auth", () => ({
  requireEventAdmin: mocks.requireEventAdmin,
  assertAdminCsrf: mocks.assertAdminCsrf,
}));
vi.mock("@/lib/event-assets", () => ({
  loadAsset: mocks.loadAsset,
  normalizeEventAsset: mocks.normalizeEventAsset,
}));
vi.mock("@/lib/event-repository", () => ({ updateEventAsset: mocks.updateEventAsset }));

import { GET } from "./route";

const context = { params: Promise.resolve({ slug: "mpu-2026" }) };
const event = {
  id: "00000000-0000-4000-8000-000000000002",
  status: "draft",
  logoPath: "builtin:wticifes-logo",
  sideImagePath: "builtin:wticifes-phrase",
};

beforeEach(() => {
  mocks.requireEventAdmin.mockResolvedValue({ admin: { email: "admin@example.org" }, event });
  mocks.loadAsset.mockResolvedValue(Buffer.from([137, 80, 78, 71]));
});

afterEach(() => {
  vi.clearAllMocks();
});

describe("ativos visuais administrativos", () => {
  it("exibe o logo de um evento em rascunho para seu administrador", async () => {
    const response = await GET(
      new Request("https://foto.example.org/api/admin/mpu-2026/asset?kind=logo"),
      context,
    );

    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toBe("image/png");
    expect(response.headers.get("cache-control")).toBe("private, no-store");
    expect(mocks.requireEventAdmin).toHaveBeenCalledWith("mpu-2026");
    expect(mocks.loadAsset).toHaveBeenCalledWith(event.logoPath);
  });

  it("mantém a prévia protegida por permissão do evento", async () => {
    mocks.requireEventAdmin.mockRejectedValueOnce(new AppError("ADMIN_FORBIDDEN", 403, "negado"));

    const response = await GET(
      new Request("https://foto.example.org/api/admin/mpu-2026/asset?kind=side"),
      context,
    );

    expect(response.status).toBe(403);
    expect(mocks.loadAsset).not.toHaveBeenCalled();
  });

  it("rejeita um tipo de ativo desconhecido", async () => {
    const response = await GET(
      new Request("https://foto.example.org/api/admin/mpu-2026/asset?kind=other"),
      context,
    );

    expect(response.status).toBe(404);
    expect(mocks.requireEventAdmin).not.toHaveBeenCalled();
  });
});
