export const PARTICIPANT_TOKEN_STORAGE_KEY = "wticifes:participant-token:v1";

interface TokenStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

function isValidParticipantToken(value: string | null): value is string {
  return Boolean(
    value &&
      value.length >= 32 &&
      value.length <= 512 &&
      /^[A-Za-z0-9_-]+$/.test(value),
  );
}

export function getOrCreateParticipantToken(
  storage: TokenStorage,
  randomUuid: () => string,
): string {
  const existing = storage.getItem(PARTICIPANT_TOKEN_STORAGE_KEY);
  if (isValidParticipantToken(existing)) return existing;

  const token = `${randomUuid()}${randomUuid()}`;
  storage.setItem(PARTICIPANT_TOKEN_STORAGE_KEY, token);
  return token;
}
