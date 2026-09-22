CREATE TABLE app_private.social_snapshot (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id text NOT NULL CONSTRAINT social_snapshot_user_id_user_id_fk REFERENCES app_private."user"(id) ON DELETE CASCADE,
  project_id text NOT NULL CONSTRAINT social_snapshot_project_id_project_id_fk REFERENCES app_private.project(id) ON DELETE CASCADE,
  account text NOT NULL,
  observed_on date NOT NULL,
  payload jsonb NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX social_snapshot_account_day_uidx
  ON app_private.social_snapshot (user_id, project_id, account, observed_on);
--> statement-breakpoint
ALTER TABLE app_private.social_snapshot ENABLE ROW LEVEL SECURITY;
