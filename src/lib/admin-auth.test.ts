import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
vi.mock("@/auth", () => ({ auth: vi.fn() }));
import {
  assertAdminCsrf,
  createAdminCsrfToken,
  isAllowedAdminEmail,
  verifyAdminCsrfToken,
} from "./admin-auth";

beforeEach(() => {
  vi.stubEnv("RATE_LIMIT_SECRET", "r".repeat(32));
  vi.stubEnv("ADMIN_AUDIT_SECRET", "a".repeat(32));
  vi.stubEnv("ADMIN_EMAIL_ALLOWLIST", "admin@example.org, OUTRO@example.org ");
  vi.stubEnv("NEXT_PUBLIC_APP_URL", "https://foto.example.org");
});
afterEach(() => vi.unstubAllEnvs());

describe("autorização administrativa", () => {
  it("normaliza allowlist e nega usuário comum", () => {
    expect(isAllowedAdminEmail("ADMIN@example.org")).toBe(true);
    expect(isAllowedAdminEmail("comum@example.org")).toBe(false);
    expect(isAllowedAdminEmail(undefined)).toBe(false);
  });

  it("vincula CSRF ao administrador e à expiração", () => {
    const issued = new Date("2026-08-02T12:00:00Z");
    const token = createAdminCsrfToken("admin@example.org", issued);
    expect(verifyAdminCsrfToken(token, "admin@example.org", new Date("2026-08-02T12:14:59Z"))).toBe(true);
    expect(verifyAdminCsrfToken(token, "outro@example.org", issued)).toBe(false);
    expect(verifyAdminCsrfToken(token, "admin@example.org", new Date("2026-08-02T12:15:01Z"))).toBe(false);
  });

  it("rejeita mutação sem origem ou sem CSRF", () => {
    const token = createAdminCsrfToken("admin@example.org");
    const withoutOrigin = new Request("https://foto.example.org/api/admin/moderacao", { method: "POST" });
    expect(() => assertAdminCsrf(withoutOrigin, token, "admin@example.org")).toThrowError(
      expect.objectContaining({ code: "CSRF_ORIGIN_INVALID" }),
    );
    const withOrigin = new Request("https://foto.example.org/api/admin/moderacao", {
      method: "POST",
      headers: { Origin: "https://foto.example.org" },
    });
    expect(() => assertAdminCsrf(withOrigin, "inválido", "admin@example.org")).toThrowError(
      expect.objectContaining({ code: "CSRF_INVALID" }),
    );
  });
});
