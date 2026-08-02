import { describe, expect, it } from "vitest";
import { canAppearInShowcase } from "./publication-state";

const future = new Date("2026-09-01T00:00:00Z");
const now = new Date("2026-08-02T00:00:00Z");
const approved = {
  status: "approved" as const,
  consentedAt: new Date("2026-08-01T00:00:00Z"),
  removedAt: null,
  deletedAt: null,
  publicationExpiresAt: future,
};

describe("regra única de publicação", () => {
  it("publica somente com consentimento, aprovação, atividade e prazo", () => {
    expect(canAppearInShowcase(approved, now)).toBe(true);
    expect(canAppearInShowcase({ ...approved, consentedAt: null }, now)).toBe(false);
    expect(canAppearInShowcase({ ...approved, status: "pending_review" }, now)).toBe(false);
    expect(canAppearInShowcase({ ...approved, status: "rejected" }, now)).toBe(false);
    expect(canAppearInShowcase({ ...approved, status: "removed", removedAt: now }, now)).toBe(false);
    expect(canAppearInShowcase({ ...approved, deletedAt: now }, now)).toBe(false);
    expect(canAppearInShowcase({ ...approved, publicationExpiresAt: now }, now)).toBe(false);
  });
});
