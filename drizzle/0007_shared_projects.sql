-- Keep existing IDs and handles so all history and public links survive.
ALTER TABLE app_private.profile RENAME TO project;
--> statement-breakpoint
ALTER TABLE app_private.project DROP CONSTRAINT profile_user_id_user_id_fk;
--> statement-breakpoint
ALTER TABLE app_private.project RENAME COLUMN user_id TO id;
--> statement-breakpoint
ALTER TABLE app_private.project RENAME CONSTRAINT profile_referred_by_user_id_user_id_fk TO project_referred_by_user_id_user_id_fk;
--> statement-breakpoint
UPDATE app_private."user" u SET name = p.display_name FROM app_private.project p WHERE p.id = u.id;
--> statement-breakpoint
ALTER TABLE app_private.project DROP COLUMN display_name;
--> statement-breakpoint
CREATE TABLE app_private.project_owner (
  project_id text NOT NULL CONSTRAINT project_owner_project_id_project_id_fk REFERENCES app_private.project(id) ON DELETE CASCADE,
  user_id text NOT NULL CONSTRAINT project_owner_user_id_user_id_fk REFERENCES app_private."user"(id) ON DELETE CASCADE,
  active boolean NOT NULL DEFAULT false
);
--> statement-breakpoint
CREATE UNIQUE INDEX project_owner_pair_uidx ON app_private.project_owner(project_id, user_id);
--> statement-breakpoint
CREATE UNIQUE INDEX project_owner_active_uidx ON app_private.project_owner(user_id) WHERE active;
--> statement-breakpoint
INSERT INTO app_private.project_owner(project_id, user_id, active) SELECT id, id, true FROM app_private.project;
--> statement-breakpoint
CREATE TABLE app_private.project_join_request (
  project_id text NOT NULL CONSTRAINT project_join_request_project_id_project_id_fk REFERENCES app_private.project(id) ON DELETE CASCADE,
  user_id text NOT NULL CONSTRAINT project_join_request_user_id_user_id_fk REFERENCES app_private."user"(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now()
);
--> statement-breakpoint
CREATE UNIQUE INDEX project_join_request_pair_uidx ON app_private.project_join_request(project_id, user_id);
--> statement-breakpoint
ALTER TABLE app_private.commitment DROP CONSTRAINT commitment_user_id_user_id_fk;
--> statement-breakpoint
ALTER TABLE app_private.commitment RENAME COLUMN user_id TO project_id;
--> statement-breakpoint
ALTER TABLE app_private.commitment ADD CONSTRAINT commitment_project_id_project_id_fk FOREIGN KEY (project_id) REFERENCES app_private.project(id) ON DELETE CASCADE;
--> statement-breakpoint
ALTER TABLE app_private.result DROP CONSTRAINT result_user_id_user_id_fk;
--> statement-breakpoint
ALTER TABLE app_private.result RENAME COLUMN user_id TO project_id;
--> statement-breakpoint
ALTER TABLE app_private.result ADD CONSTRAINT result_project_id_project_id_fk FOREIGN KEY (project_id) REFERENCES app_private.project(id) ON DELETE CASCADE;
--> statement-breakpoint
ALTER TABLE app_private.result ADD COLUMN updated_by_user_id text CONSTRAINT result_updated_by_user_id_user_id_fk REFERENCES app_private."user"(id) ON DELETE SET NULL;
--> statement-breakpoint
UPDATE app_private.result SET updated_by_user_id = project_id;
--> statement-breakpoint
ALTER TABLE app_private.comparison DROP CONSTRAINT comparison_voter_user_id_user_id_fk;
--> statement-breakpoint
ALTER TABLE app_private.comparison RENAME COLUMN voter_user_id TO voter_project_id;
--> statement-breakpoint
ALTER TABLE app_private.comparison ADD CONSTRAINT comparison_voter_project_id_project_id_fk FOREIGN KEY (voter_project_id) REFERENCES app_private.project(id) ON DELETE CASCADE;
--> statement-breakpoint
CREATE TABLE app_private.project_invite (
  token text PRIMARY KEY NOT NULL,
  project_id text NOT NULL CONSTRAINT project_invite_project_id_project_id_fk REFERENCES app_private.project(id) ON DELETE CASCADE,
  expires_at timestamptz NOT NULL
);
--> statement-breakpoint
REVOKE ALL ON ALL TABLES IN SCHEMA app_private FROM anon, authenticated;
