const errorResponses = {
  "400": { description: "Dados inválidos." },
  "403": { description: "Token ou autorização inválida." },
  "409": { description: "Operação duplicada ou conflito de estado." },
  "413": { description: "Arquivo acima do limite de 12 MB." },
  "415": { description: "Formato de imagem não aceito." },
  "429": { description: "Limite de uso atingido; respeite Retry-After." },
  "503": { description: "Serviço temporariamente desativado ou não configurado." },
} as const;

export function createOpenApiDocument(origin: string) {
  return {
    openapi: "3.1.0",
    info: {
      title: "WTICIFES 2026 — Eu fui, tchê!",
      version: "2.0.0",
      description:
        "API interna da aplicação standalone. A personalização é privada; envio à vitrine exige consentimento explícito e nunca dispensa aprovação humana.",
    },
    servers: [{ url: origin }],
    paths: {
      "/api/personalizar": {
        post: {
          operationId: "personalizarFoto",
          summary: "Processa um upload privado transitório já autorizado pela aplicação.",
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  additionalProperties: false,
                  required: ["upload_path", "mime_type", "request_id"],
                  properties: {
                    upload_path: { type: "string", pattern: "^incoming/" },
                    mime_type: { type: "string", enum: ["image/jpeg", "image/png", "image/webp"] },
                    request_id: { type: "string", format: "uuid" },
                    participant_token: { type: "string", minLength: 16, description: "Opcional; nunca é armazenado em texto puro." },
                  },
                },
              },
            },
          },
          responses: {
            "200": {
              description: "Arte privada criada. Isso não autoriza publicação.",
              content: { "application/json": { schema: { $ref: "#/components/schemas/PersonalizationResult" } } },
            },
            ...errorResponses,
          },
        },
      },
      "/api/vitrine/submeter": {
        post: {
          operationId: "submeterFotoVitrine",
          summary: "Registra consentimento e envia a foto para revisão humana.",
          description: "Publicação é opcional. A submissão não garante aprovação; conteúdo impróprio será rejeitado.",
          requestBody: { required: true, content: { "application/json": { schema: { $ref: "#/components/schemas/ConsentRequest" } } } },
          responses: { "200": { description: "Consentimento registrado e imagem pendente." }, "410": { description: "Token expirado." }, ...errorResponses },
        },
      },
      "/api/vitrine/revogar": {
        post: {
          operationId: "revogarFotoVitrine",
          summary: "Revoga o consentimento e retira a imagem imediatamente.",
          requestBody: { required: true, content: { "application/json": { schema: { $ref: "#/components/schemas/RevocationRequest" } } } },
          responses: { "200": { description: "Imagem retirada e exclusão física solicitada." }, ...errorResponses },
        },
      },
    },
    components: {
      schemas: {
        PersonalizationResult: {
          type: "object",
          required: ["success", "image_id", "result_url", "consent_token", "revocation_token", "expires_at", "reused"],
          properties: {
            success: { type: "boolean", const: true },
            image_id: { type: "string", format: "uuid" },
            result_url: { type: "string", format: "uri" },
            consent_token: { type: "string" },
            revocation_token: { type: "string" },
            expires_at: { type: "string", format: "date-time" },
            reused: { type: "boolean", description: "Indica recuperação de uma personalização anterior." },
          },
        },
        ConsentRequest: {
          type: "object",
          additionalProperties: false,
          required: ["image_id", "consent_token"],
          properties: { image_id: { type: "string", format: "uuid" }, consent_token: { type: "string" } },
        },
        RevocationRequest: {
          type: "object",
          additionalProperties: false,
          required: ["image_id", "revocation_token"],
          properties: { image_id: { type: "string", format: "uuid" }, revocation_token: { type: "string" } },
        },
      },
    },
  } as const;
}
