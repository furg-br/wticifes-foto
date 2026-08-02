CREATE TYPE "public"."image_status" AS ENUM('private', 'pending_review', 'approved', 'rejected', 'removed', 'expired');--> statement-breakpoint
CREATE TABLE "blocked_participants" (
	"participant_key_hash" varchar(64) PRIMARY KEY NOT NULL,
	"blocked_at" timestamp with time zone DEFAULT now() NOT NULL,
	"blocked_by" varchar(64) NOT NULL,
	"reason" varchar(500),
	"source_image_id" uuid NOT NULL
);
--> statement-breakpoint
CREATE TABLE "images" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"blob_path" text NOT NULL,
	"content_hash" varchar(64) NOT NULL,
	"status" "image_status" DEFAULT 'private' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"consented_at" timestamp with time zone,
	"consent_version" varchar(64),
	"consent_token_hash" varchar(64),
	"consent_token_expires_at" timestamp with time zone,
	"consent_token_used_at" timestamp with time zone,
	"revocation_token_hash" varchar(64) NOT NULL,
	"submitted_at" timestamp with time zone,
	"approved_at" timestamp with time zone,
	"approved_by" varchar(64),
	"rejected_at" timestamp with time zone,
	"rejected_by" varchar(64),
	"rejection_reason" varchar(500),
	"removed_at" timestamp with time zone,
	"removed_by" varchar(64),
	"participant_key_hash" varchar(64),
	"request_key_hash" varchar(64),
	"publication_expires_at" timestamp with time zone,
	"token_version" integer DEFAULT 1 NOT NULL,
	"deleted_at" timestamp with time zone,
	"last_displayed_at" timestamp with time zone,
	"display_count" integer DEFAULT 0 NOT NULL,
	"safety_priority" integer DEFAULT 0 NOT NULL,
	"safety_flags" text[]
);
--> statement-breakpoint
CREATE TABLE "moderation_audit" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"image_id" uuid NOT NULL,
	"moderator_id" varchar(64) NOT NULL,
	"action" varchar(64) NOT NULL,
	"previous_status" "image_status" NOT NULL,
	"new_status" "image_status" NOT NULL,
	"reason" varchar(500),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"request_id" varchar(128) NOT NULL
);
--> statement-breakpoint
ALTER TABLE "blocked_participants" ADD CONSTRAINT "blocked_participants_source_image_id_images_id_fk" FOREIGN KEY ("source_image_id") REFERENCES "public"."images"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "moderation_audit" ADD CONSTRAINT "moderation_audit_image_id_images_id_fk" FOREIGN KEY ("image_id") REFERENCES "public"."images"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "blocked_participants_blocked_at_idx" ON "blocked_participants" USING btree ("blocked_at");--> statement-breakpoint
CREATE UNIQUE INDEX "images_active_content_hash_uidx" ON "images" USING btree ("content_hash") WHERE "images"."deleted_at" is null;--> statement-breakpoint
CREATE UNIQUE INDEX "images_request_key_hash_uidx" ON "images" USING btree ("request_key_hash") WHERE "images"."request_key_hash" is not null;--> statement-breakpoint
CREATE INDEX "images_status_idx" ON "images" USING btree ("status");--> statement-breakpoint
CREATE INDEX "images_created_at_idx" ON "images" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "images_publication_expires_at_idx" ON "images" USING btree ("publication_expires_at");--> statement-breakpoint
CREATE INDEX "images_feed_idx" ON "images" USING btree ("status","publication_expires_at","last_displayed_at");--> statement-breakpoint
CREATE INDEX "images_participant_key_hash_idx" ON "images" USING btree ("participant_key_hash");--> statement-breakpoint
CREATE INDEX "moderation_audit_image_idx" ON "moderation_audit" USING btree ("image_id","created_at");--> statement-breakpoint
CREATE INDEX "moderation_audit_created_at_idx" ON "moderation_audit" USING btree ("created_at");