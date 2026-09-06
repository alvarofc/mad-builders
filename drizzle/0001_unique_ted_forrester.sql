CREATE TABLE "app_private"."commitment" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "app_private"."commitment_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"user_id" text NOT NULL,
	"week_id" bigint NOT NULL,
	"promise" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "app_private"."comparison" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "app_private"."comparison_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"week_id" bigint NOT NULL,
	"voter_user_id" text NOT NULL,
	"candidate_low_id" bigint NOT NULL,
	"candidate_high_id" bigint NOT NULL,
	"presented_first_id" bigint NOT NULL,
	"choice" text,
	"assigned_at" timestamp with time zone DEFAULT now() NOT NULL,
	"decided_at" timestamp with time zone,
	"invalidated_at" timestamp with time zone,
	CONSTRAINT "comparison_candidate_order_check" CHECK ("app_private"."comparison"."candidate_low_id" < "app_private"."comparison"."candidate_high_id"),
	CONSTRAINT "comparison_presented_candidate_check" CHECK ("app_private"."comparison"."presented_first_id" in ("app_private"."comparison"."candidate_low_id", "app_private"."comparison"."candidate_high_id")),
	CONSTRAINT "comparison_choice_check" CHECK ("app_private"."comparison"."choice" is null or "app_private"."comparison"."choice" in ('low', 'high', 'tie', 'pass'))
);
--> statement-breakpoint
CREATE TABLE "app_private"."ranking" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "app_private"."ranking_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"week_id" bigint NOT NULL,
	"result_id" bigint NOT NULL,
	"score_numerator" integer NOT NULL,
	"score_denominator" integer NOT NULL,
	"wins" integer NOT NULL,
	"ties" integer NOT NULL,
	"decisions" integer NOT NULL,
	"rank" integer NOT NULL,
	"finalized_at" timestamp with time zone NOT NULL,
	CONSTRAINT "ranking_denominator_check" CHECK ("app_private"."ranking"."score_denominator" > 0),
	CONSTRAINT "ranking_rank_check" CHECK ("app_private"."ranking"."rank" > 0)
);
--> statement-breakpoint
CREATE TABLE "app_private"."result" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "app_private"."result_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"commitment_id" bigint NOT NULL,
	"user_id" text NOT NULL,
	"week_id" bigint NOT NULL,
	"status" text NOT NULL,
	"summary" text NOT NULL,
	"proof_url" text,
	"proof_status" text DEFAULT 'self_reported' NOT NULL,
	"proof_checked_at" timestamp with time zone,
	"published_at" timestamp with time zone DEFAULT now() NOT NULL,
	"on_time" boolean NOT NULL,
	"hidden_at" timestamp with time zone,
	"withdrawn_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "result_status_check" CHECK ("app_private"."result"."status" in ('complete', 'partial', 'missed')),
	CONSTRAINT "result_proof_status_check" CHECK ("app_private"."result"."proof_status" in ('self_reported', 'proof_linked', 'github_account_matched'))
);
--> statement-breakpoint
CREATE TABLE "app_private"."week" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "app_private"."week_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"week_start_date" date NOT NULL,
	"starts_at" timestamp with time zone NOT NULL,
	"submission_closes_at" timestamp with time zone NOT NULL,
	"voting_closes_at" timestamp with time zone NOT NULL,
	"ranking_status" text DEFAULT 'pending' NOT NULL,
	"finalized_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "week_window_check" CHECK ("app_private"."week"."starts_at" < "app_private"."week"."submission_closes_at" and "app_private"."week"."submission_closes_at" < "app_private"."week"."voting_closes_at"),
	CONSTRAINT "week_ranking_status_check" CHECK ("app_private"."week"."ranking_status" in ('pending', 'final', 'unranked'))
);
--> statement-breakpoint
ALTER TABLE "app_private"."profile" ADD COLUMN "first_commitment_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "app_private"."profile" ADD COLUMN "first_on_time_result_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "app_private"."commitment" ADD CONSTRAINT "commitment_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "app_private"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app_private"."commitment" ADD CONSTRAINT "commitment_week_id_week_id_fk" FOREIGN KEY ("week_id") REFERENCES "app_private"."week"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app_private"."comparison" ADD CONSTRAINT "comparison_week_id_week_id_fk" FOREIGN KEY ("week_id") REFERENCES "app_private"."week"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app_private"."comparison" ADD CONSTRAINT "comparison_voter_user_id_user_id_fk" FOREIGN KEY ("voter_user_id") REFERENCES "app_private"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app_private"."comparison" ADD CONSTRAINT "comparison_candidate_low_id_result_id_fk" FOREIGN KEY ("candidate_low_id") REFERENCES "app_private"."result"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app_private"."comparison" ADD CONSTRAINT "comparison_candidate_high_id_result_id_fk" FOREIGN KEY ("candidate_high_id") REFERENCES "app_private"."result"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app_private"."comparison" ADD CONSTRAINT "comparison_presented_first_id_result_id_fk" FOREIGN KEY ("presented_first_id") REFERENCES "app_private"."result"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app_private"."ranking" ADD CONSTRAINT "ranking_week_id_week_id_fk" FOREIGN KEY ("week_id") REFERENCES "app_private"."week"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app_private"."ranking" ADD CONSTRAINT "ranking_result_id_result_id_fk" FOREIGN KEY ("result_id") REFERENCES "app_private"."result"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app_private"."result" ADD CONSTRAINT "result_commitment_id_commitment_id_fk" FOREIGN KEY ("commitment_id") REFERENCES "app_private"."commitment"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app_private"."result" ADD CONSTRAINT "result_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "app_private"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app_private"."result" ADD CONSTRAINT "result_week_id_week_id_fk" FOREIGN KEY ("week_id") REFERENCES "app_private"."week"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "commitment_user_week_uidx" ON "app_private"."commitment" USING btree ("user_id","week_id");--> statement-breakpoint
CREATE INDEX "commitment_week_id_idx" ON "app_private"."commitment" USING btree ("week_id");--> statement-breakpoint
CREATE UNIQUE INDEX "comparison_voter_pair_uidx" ON "app_private"."comparison" USING btree ("voter_user_id","week_id","candidate_low_id","candidate_high_id");--> statement-breakpoint
CREATE UNIQUE INDEX "comparison_unfinished_voter_week_uidx" ON "app_private"."comparison" USING btree ("voter_user_id","week_id") WHERE "app_private"."comparison"."choice" is null and "app_private"."comparison"."invalidated_at" is null;--> statement-breakpoint
CREATE INDEX "comparison_week_candidate_low_idx" ON "app_private"."comparison" USING btree ("week_id","candidate_low_id");--> statement-breakpoint
CREATE INDEX "comparison_week_candidate_high_idx" ON "app_private"."comparison" USING btree ("week_id","candidate_high_id");--> statement-breakpoint
CREATE UNIQUE INDEX "ranking_week_result_uidx" ON "app_private"."ranking" USING btree ("week_id","result_id");--> statement-breakpoint
CREATE INDEX "ranking_week_rank_idx" ON "app_private"."ranking" USING btree ("week_id","rank");--> statement-breakpoint
CREATE UNIQUE INDEX "result_commitment_id_uidx" ON "app_private"."result" USING btree ("commitment_id");--> statement-breakpoint
CREATE UNIQUE INDEX "result_user_week_uidx" ON "app_private"."result" USING btree ("user_id","week_id");--> statement-breakpoint
CREATE INDEX "result_week_candidate_idx" ON "app_private"."result" USING btree ("week_id","on_time","status");--> statement-breakpoint
CREATE INDEX "result_user_published_at_idx" ON "app_private"."result" USING btree ("user_id","published_at");--> statement-breakpoint
CREATE UNIQUE INDEX "week_start_date_uidx" ON "app_private"."week" USING btree ("week_start_date");--> statement-breakpoint
CREATE INDEX "week_window_idx" ON "app_private"."week" USING btree ("starts_at","voting_closes_at");--> statement-breakpoint
REVOKE ALL ON ALL TABLES IN SCHEMA "app_private" FROM anon, authenticated;
