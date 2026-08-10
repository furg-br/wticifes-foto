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
      "admin_invitations",
      "admin_users",
      "blocked_participants",
      "event_admins",
      "events",
      "images",
      "moderation_audit",
    ]);
    const indexes = await database.query<{ indexname: string }>(
      "select indexname from pg_indexes where schemaname='public'",
    );
    expect(indexes.rows.map((row) => row.indexname)).toEqual(
      expect.arrayContaining([
        "images_event_active_content_hash_uidx",
        "images_event_feed_idx",
        "images_event_status_idx",
        "moderation_audit_image_idx",
      ]),
    );
  });

  it("impede conteúdo ativo duplicado e libera após exclusão lógica", async () => {
    const values = ["00000000-0000-4000-8000-000000000001", "personalizadas/a.jpg", "a".repeat(64), "2026-08-03T00:00:00Z", "b".repeat(64)];
    await database.query(
      "insert into images(event_id,blob_path,content_hash,expires_at,revocation_token_hash) values($1,$2,$3,$4,$5)",
      values,
    );
    await expect(
      database.query(
        "insert into images(event_id,blob_path,content_hash,expires_at,revocation_token_hash) values($1,$2,$3,$4,$5)",
        [values[0], "personalizadas/b.jpg", ...values.slice(2)],
      ),
    ).rejects.toThrow();
    await database.query("update images set deleted_at=now() where blob_path=$1", [values[1]]);
    await expect(
      database.query(
        "insert into images(event_id,blob_path,content_hash,expires_at,revocation_token_hash) values($1,$2,$3,$4,$5)",
        [values[0], "personalizadas/c.jpg", ...values.slice(2)],
      ),
    ).resolves.toBeDefined();
  });

  it("isola conteúdo e bloqueios entre cadastros", async () => {
    const secondEvent = "00000000-0000-4000-8000-000000000002";
    await database.query(`
      insert into events (
        id, slug, name, status, page_title, page_subtitle, upload_title, upload_label,
        submit_label, consent_text, success_message, showcase_title, showcase_empty_text,
        logo_path, side_image_path, created_by
      )
      select $1, 'segundo-espaco', 'Segundo espaço', status, page_title, page_subtitle,
        upload_title, upload_label, submit_label, consent_text, success_message,
        showcase_title, showcase_empty_text, logo_path, side_image_path, created_by
      from events where id='00000000-0000-4000-8000-000000000001'
    `, [secondEvent]);
    await expect(database.query(
      "insert into images(event_id,blob_path,content_hash,expires_at,revocation_token_hash) values($1,$2,$3,$4,$5)",
      [secondEvent, "personalizadas/segundo.jpg", "a".repeat(64), "2026-08-03T00:00:00Z", "c".repeat(64)],
    )).resolves.toBeDefined();

    const sourceImage = await database.query<{ id: string }>("select id from images where event_id=$1 limit 1", [secondEvent]);
    await database.query(
      "insert into blocked_participants(event_id,participant_key_hash,blocked_by,source_image_id) values($1,$2,$3,$4)",
      [secondEvent, "d".repeat(64), "admin", sourceImage.rows[0]?.id],
    );
    await expect(database.query(
      "insert into blocked_participants(event_id,participant_key_hash,blocked_by,source_image_id) values($1,$2,$3,$4)",
      ["00000000-0000-4000-8000-000000000001", "d".repeat(64), "admin", sourceImage.rows[0]?.id],
    )).resolves.toBeDefined();
  });
});
