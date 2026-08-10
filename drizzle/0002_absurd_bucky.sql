CREATE TABLE "events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"slug" varchar(63) NOT NULL,
	"name" varchar(160) NOT NULL,
	"status" varchar(24) DEFAULT 'draft' NOT NULL,
	"page_title" varchar(160) NOT NULL,
	"page_subtitle" varchar(500) NOT NULL,
	"upload_title" varchar(120) DEFAULT 'Crie sua foto' NOT NULL,
	"upload_label" varchar(240) NOT NULL,
	"submit_label" varchar(80) DEFAULT 'Personalizar foto' NOT NULL,
	"consent_text" varchar(1000) NOT NULL,
	"success_message" varchar(500) NOT NULL,
	"showcase_title" varchar(160) NOT NULL,
	"showcase_empty_text" varchar(240) NOT NULL,
	"logo_path" text NOT NULL,
	"side_image_path" text NOT NULL,
	"config_version" integer DEFAULT 1 NOT NULL,
	"created_by" varchar(320) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
INSERT INTO "events" (
	"id", "slug", "name", "status", "page_title", "page_subtitle", "upload_title",
	"upload_label", "submit_label", "consent_text", "success_message", "showcase_title",
	"showcase_empty_text", "logo_path", "side_image_path", "created_by"
) VALUES (
	'00000000-0000-4000-8000-000000000001',
	'wticifes-2026',
	'WTICIFES 2026',
	'active',
	'Eu fui, tchê!',
	'Personalize sua fotografia com a identidade oficial do WTICIFES 2026.',
	'Crie sua foto',
	'Escolha uma foto JPG, PNG ou WebP (até 12 MB)',
	'Personalizar foto',
	'Autorizo a exibição pública desta imagem nas telas e na vitrine do WTICIFES 2026, sujeita à revisão humana.',
	'Pronto. Sua arte continua privada. Guarde o código de revogação antes de fechar a página.',
	'WTICIFES 2026',
	'Novas fotos aparecerão aqui em breve.',
	'builtin:wticifes-logo',
	'builtin:wticifes-phrase',
	'migration'
);
--> statement-breakpoint
CREATE TABLE "admin_users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" varchar(320) NOT NULL,
	"name" varchar(160),
	"active" boolean DEFAULT true NOT NULL,
	"is_super_admin" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_login_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "event_admins" (
	"event_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"role" varchar(32) DEFAULT 'event_admin' NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"granted_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "event_admins_event_id_user_id_pk" PRIMARY KEY("event_id","user_id")
);
--> statement-breakpoint
CREATE TABLE "admin_invitations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"event_id" uuid NOT NULL,
	"email" varchar(320) NOT NULL,
	"token_hash" varchar(64) NOT NULL,
	"invited_by" uuid,
	"expires_at" timestamp with time zone NOT NULL,
	"accepted_at" timestamp with time zone,
	"revoked_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "images" ADD COLUMN "event_id" uuid DEFAULT '00000000-0000-4000-8000-000000000001';
--> statement-breakpoint
ALTER TABLE "images" ADD COLUMN "event_config_version" integer DEFAULT 1 NOT NULL;
--> statement-breakpoint
ALTER TABLE "moderation_audit" ADD COLUMN "event_id" uuid DEFAULT '00000000-0000-4000-8000-000000000001';
--> statement-breakpoint
ALTER TABLE "blocked_participants" ADD COLUMN "event_id" uuid DEFAULT '00000000-0000-4000-8000-000000000001';
--> statement-breakpoint
UPDATE "images" SET "event_id" = '00000000-0000-4000-8000-000000000001' WHERE "event_id" IS NULL;
--> statement-breakpoint
UPDATE "moderation_audit" AS a
SET "event_id" = i."event_id"
FROM "images" AS i
WHERE a."image_id" = i."id" AND a."event_id" IS NULL;
--> statement-breakpoint
UPDATE "blocked_participants" SET "event_id" = '00000000-0000-4000-8000-000000000001' WHERE "event_id" IS NULL;
--> statement-breakpoint
ALTER TABLE "images" ALTER COLUMN "event_id" SET NOT NULL;
--> statement-breakpoint
ALTER TABLE "moderation_audit" ALTER COLUMN "event_id" SET NOT NULL;
--> statement-breakpoint
ALTER TABLE "blocked_participants" ALTER COLUMN "event_id" SET NOT NULL;
--> statement-breakpoint
DROP INDEX "images_active_content_hash_uidx";
--> statement-breakpoint
DROP INDEX "images_request_key_hash_uidx";
--> statement-breakpoint
DROP INDEX "images_status_idx";
--> statement-breakpoint
DROP INDEX "images_feed_idx";
--> statement-breakpoint
DROP INDEX "images_participant_key_hash_idx";
--> statement-breakpoint
ALTER TABLE "blocked_participants" DROP CONSTRAINT "blocked_participants_pkey";
--> statement-breakpoint
ALTER TABLE "blocked_participants" ADD CONSTRAINT "blocked_participants_event_id_participant_key_hash_pk" PRIMARY KEY("event_id","participant_key_hash");
--> statement-breakpoint
ALTER TABLE "admin_invitations" ADD CONSTRAINT "admin_invitations_event_id_events_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."events"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "admin_invitations" ADD CONSTRAINT "admin_invitations_invited_by_admin_users_id_fk" FOREIGN KEY ("invited_by") REFERENCES "public"."admin_users"("id") ON DELETE set null ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "event_admins" ADD CONSTRAINT "event_admins_event_id_events_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."events"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "event_admins" ADD CONSTRAINT "event_admins_user_id_admin_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."admin_users"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "event_admins" ADD CONSTRAINT "event_admins_granted_by_admin_users_id_fk" FOREIGN KEY ("granted_by") REFERENCES "public"."admin_users"("id") ON DELETE set null ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "blocked_participants" ADD CONSTRAINT "blocked_participants_event_id_events_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."events"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "images" ADD CONSTRAINT "images_event_id_events_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."events"("id") ON DELETE restrict ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "moderation_audit" ADD CONSTRAINT "moderation_audit_event_id_events_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."events"("id") ON DELETE restrict ON UPDATE no action;
--> statement-breakpoint
CREATE UNIQUE INDEX "admin_invitations_token_uidx" ON "admin_invitations" USING btree ("token_hash");
--> statement-breakpoint
CREATE INDEX "admin_invitations_email_idx" ON "admin_invitations" USING btree ("email","expires_at");
--> statement-breakpoint
CREATE INDEX "admin_invitations_event_idx" ON "admin_invitations" USING btree ("event_id","created_at");
--> statement-breakpoint
CREATE UNIQUE INDEX "admin_users_email_uidx" ON "admin_users" USING btree ("email");
--> statement-breakpoint
CREATE INDEX "event_admins_user_idx" ON "event_admins" USING btree ("user_id","active");
--> statement-breakpoint
CREATE UNIQUE INDEX "events_slug_uidx" ON "events" USING btree ("slug");
--> statement-breakpoint
CREATE INDEX "events_status_idx" ON "events" USING btree ("status");
--> statement-breakpoint
CREATE UNIQUE INDEX "images_event_active_content_hash_uidx" ON "images" USING btree ("event_id","content_hash") WHERE "images"."deleted_at" is null;
--> statement-breakpoint
CREATE UNIQUE INDEX "images_event_request_key_hash_uidx" ON "images" USING btree ("event_id","request_key_hash") WHERE "images"."request_key_hash" is not null and "images"."deleted_at" is null;
--> statement-breakpoint
CREATE INDEX "images_event_status_idx" ON "images" USING btree ("event_id","status");
--> statement-breakpoint
CREATE INDEX "images_event_feed_idx" ON "images" USING btree ("event_id","status","publication_expires_at","last_displayed_at");
--> statement-breakpoint
CREATE INDEX "images_event_participant_key_hash_idx" ON "images" USING btree ("event_id","participant_key_hash");
--> statement-breakpoint
CREATE INDEX "moderation_audit_event_idx" ON "moderation_audit" USING btree ("event_id","created_at");
