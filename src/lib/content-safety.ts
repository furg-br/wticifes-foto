export interface ContentSafetyResult {
  priority: number;
  flags: string[];
}

export interface ContentSafetyProvider {
  readonly name: string;
  assess(image: Buffer): Promise<ContentSafetyResult>;
}

export const manualContentSafetyProvider: ContentSafetyProvider = {
  name: "manual",
  async assess() {
    return { priority: 0, flags: [] };
  },
};

export function getContentSafetyProvider(): ContentSafetyProvider {
  const configured = (process.env.CONTENT_SAFETY_PROVIDER ?? "manual").trim().toLowerCase();
  if (configured !== "manual") {
    throw new Error(
      `CONTENT_SAFETY_PROVIDER=${configured} não possui integração configurada; falha fechada.`,
    );
  }
  return manualContentSafetyProvider;
}
