import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import * as schema from "./schema";
import { AppError } from "@/lib/app-error";

export type Database = ReturnType<typeof drizzle<typeof schema>>;

let cached: Database | undefined;

export function getDatabase(): Database {
  if (cached) return cached;
  const url = process.env.DATABASE_URL?.trim();
  if (!url) {
    throw new AppError("DATABASE_NOT_CONFIGURED", 503, "O banco de dados não está configurado.");
  }
  cached = drizzle(neon(url), { schema });
  return cached;
}

export function resetDatabaseForTests(): void {
  if (process.env.NODE_ENV === "test") cached = undefined;
}
