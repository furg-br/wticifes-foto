import { describe, expect, it } from "vitest";
import { createOpenApiDocument } from "./openapi";

describe("OpenAPI standalone", () => {
  it("documenta apenas rotas públicas e não contém legado do ChatGPT", () => {
    const document = createOpenApiDocument("https://foto.example");
    expect(document.paths["/api/personalizar"].post.operationId).toBe("personalizarFoto");
    expect(document.paths["/api/vitrine/submeter"].post.operationId).toBe("submeterFotoVitrine");
    expect(document.paths["/api/vitrine/revogar"].post.operationId).toBe("revogarFotoVitrine");
    expect(JSON.stringify(document)).not.toMatch(/openai|chatgpt|\/admin/i);
  });
});
