import { afterEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ statistics: vi.fn() }));
vi.mock("@/lib/image-repository", () => ({
  getPublicUsageStatistics: mocks.statistics,
}));

import { GET } from "./route";

afterEach(() => {
  vi.resetAllMocks();
  vi.restoreAllMocks();
});

describe("GET /api/estatisticas", () => {
  it("expõe somente contagens agregadas e usa cache público curto", async () => {
    mocks.statistics.mockResolvedValue({
      totalPersonalizations: 321,
      uniqueParticipants: 198,
      todayPersonalizations: 87,
      showcasePhotos: 42,
    });

    const response = await GET();
    const body = (await response.json()) as Record<string, unknown>;

    expect(response.status).toBe(200);
    expect(body).toMatchObject({
      total_personalizations: 321,
      unique_participants: 198,
      today_personalizations: 87,
      showcase_photos: 42,
      updated_at: expect.any(String),
    });
    expect(Object.keys(body).sort()).toEqual([
      "showcase_photos",
      "today_personalizations",
      "total_personalizations",
      "unique_participants",
      "updated_at",
    ]);
    expect(JSON.stringify(body)).not.toMatch(/hash|email|token|address|image_id/i);
    expect(response.headers.get("Cache-Control")).toContain("s-maxage=60");
  });

  it("falha sem expor detalhes do banco", async () => {
    mocks.statistics.mockRejectedValue(new Error("segredo-do-banco"));
    vi.spyOn(console, "error").mockImplementation(() => undefined);

    const response = await GET();
    const body = JSON.stringify(await response.json());

    expect(response.status).toBe(503);
    expect(body).toContain("STATISTICS_UNAVAILABLE");
    expect(body).not.toContain("segredo-do-banco");
    expect(response.headers.get("Cache-Control")).toBe("no-store");
  });
});
