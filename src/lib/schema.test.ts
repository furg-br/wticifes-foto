import { describe, expect, it } from "vitest";
import { standalonePersonalizeRequestSchema } from "./schema";

const valid = {
  upload_path: "incoming/019fc3b2-061d-7ea0-b4de-4738900bd89f.jpg",
  mime_type: "image/jpeg",
  request_id: "019fc3b2-061d-7ea0-b4de-4738900bd89f",
} as const;

describe("schema do upload standalone", () => {
  it("aceita somente referência privada transitória e UUID", () => {
    expect(standalonePersonalizeRequestSchema.safeParse(valid).success).toBe(true);
  });

  it("rejeita caminho fora do ingresso, SVG e propriedades inesperadas", () => {
    expect(standalonePersonalizeRequestSchema.safeParse({ ...valid, upload_path: "personalizadas/x.jpg" }).success).toBe(false);
    expect(standalonePersonalizeRequestSchema.safeParse({ ...valid, mime_type: "image/svg+xml" }).success).toBe(false);
    expect(standalonePersonalizeRequestSchema.safeParse({ ...valid, extra: true }).success).toBe(false);
  });
});
