import { describe, expect, it, vi } from "vitest";
import { getOrCreateParticipantToken, PARTICIPANT_TOKEN_STORAGE_KEY } from "./participant-identity";

function memoryStorage(initial?: string) {
  const values = new Map<string, string>();
  if (initial) values.set(PARTICIPANT_TOKEN_STORAGE_KEY, initial);
  return {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: vi.fn((key: string, value: string) => values.set(key, value)),
  };
}

describe("identidade anônima do participante", () => {
  it("reutiliza o token persistido no navegador", () => {
    const existing = "participante_anonimo_seguro_1234567890";
    const storage = memoryStorage(existing);
    expect(getOrCreateParticipantToken(storage, vi.fn())).toBe(existing);
    expect(storage.setItem).not.toHaveBeenCalled();
  });

  it("cria e persiste um token quando ainda não existe", () => {
    const storage = memoryStorage();
    const randomUuid = vi
      .fn()
      .mockReturnValueOnce("019fc3b2-061d-7ea0-b4de-4738900bd89f")
      .mockReturnValueOnce("129fc3b2-061d-7ea0-b4de-4738900bd89f");
    const token = getOrCreateParticipantToken(storage, randomUuid);
    expect(token).toHaveLength(72);
    expect(storage.setItem).toHaveBeenCalledWith(PARTICIPANT_TOKEN_STORAGE_KEY, token);
    expect(getOrCreateParticipantToken(storage, vi.fn())).toBe(token);
  });
});
