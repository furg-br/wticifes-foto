import { afterEach, describe, expect, it, vi } from "vitest";
import { getRateLimits } from "./env";

const limitVariables = [
  "GLOBAL_MAX_PER_MINUTE",
  "GLOBAL_MAX_PER_HOUR",
  "GLOBAL_MAX_PER_DAY",
  "HARD_DAILY_LIMIT",
  "PARTICIPANT_MAX_PER_HOUR",
  "PARTICIPANT_MAX_PER_DAY",
  "PARTICIPANT_MAX_TOTAL",
] as const;

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("limites de uso do evento", () => {
  it("aplica os limites planejados para os três dias quando não há sobrescrita", () => {
    for (const variable of limitVariables) vi.stubEnv(variable, "");

    expect(getRateLimits()).toMatchObject({
      globalPerMinute: 20,
      globalPerHour: 200,
      globalPerDay: 2000,
      hardDaily: 2000,
      participantPerHour: 5,
      participantPerDay: 10,
      participantTotal: 20,
    });
  });
});
