ALTER TABLE "invites" ADD COLUMN "answered_by_telegram_id" bigint;--> statement-breakpoint
ALTER TABLE "invites" ADD COLUMN "answered_by_name" text;--> statement-breakpoint
ALTER TABLE "invites" ADD COLUMN "answered_by_username" text;