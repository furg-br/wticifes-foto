import { readdir, readFile } from "node:fs/promises";
import { PGlite } from "@electric-sql/pglite";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

const database = new PGlite();

beforeAll(async () => {
  const migrationsDirectory = new URL("../../drizzle/", import.meta.url);
  const files = (await readdir(migrationsDirectory)).filter((file) => file.endsWith(".sql")).sort();
  for (const file of files) {
    const migration = await readFile(new URL(file, migrationsDirectory), "utf8");
    for (const statement of migration.split("--> statement-breakpoint")) {
      if (statement.trim()) await database.exec(statement);
    }
  }
});

afterAll(async () => database.close());

describe("migration Postgres", () => {
  it("cria tabelas, enum e índices necessários", async () => {
    const tables = await database.query<{ table_name: string }>(
      "select table_name from information_schema.tables where table_schema='public' order by table_name",
    );
    expect(tables.rows.map((row) => row.table_name)).toEqual([
      "blocked_participants",
      "images",
      "moderation_audit",
    ]);
    const indexes = await database.query<{ indexname: string }>(
      "select indexname from pg_indexes where schemaname='public'",
    );
    expect(indexes.rows.map((row) => row.indexname)).toEqual(
      expect.arrayContaining([
        "images_active_content_hash_uidx",
        "images_feed_idx",
        "images_status_idx",
        "moderation_audit_image_idx",
      ]),
    );
  });

  it("impede conteúdo ativo duplicado e libera após exclusão lógica", async () => {
    const values = ["personalizadas/a.jpg", "a".repeat(64), "2026-08-03T00:00:00Z", "b".repeat(64)];
    await database.query(
      "insert into images(blob_path,content_hash,expires_at,revocation_token_hash) values($1,$2,$3,$4)",
      values,
    );
    await expect(
      database.query(
        "insert into images(blob_path,content_hash,expires_at,revocation_token_hash) values($1,$2,$3,$4)",
        ["personalizadas/b.jpg", ...values.slice(1)],
      ),
    ).rejects.toThrow();
    await database.query("update images set deleted_at=now() where blob_path=$1", [values[0]]);
    await expect(
      database.query(
        "insert into images(blob_path,content_hash,expires_at,revocation_token_hash) values($1,$2,$3,$4)",
        ["personalizadas/c.jpg", ...values.slice(1)],
      ),
    ).resolves.toBeDefined();
  });
});
