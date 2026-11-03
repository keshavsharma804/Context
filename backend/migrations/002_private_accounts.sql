-- Upgrade shared storage to authenticated, per-user storage without deleting records.
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'context_app') THEN
        CREATE ROLE context_app NOLOGIN NOBYPASSRLS;
    END IF;
    EXECUTE format('GRANT context_app TO %I', current_user);
END $$;
GRANT USAGE ON SCHEMA context TO context_app;
CREATE TABLE IF NOT EXISTS context.auth_sessions (
    token_hash TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES context.users(id) ON DELETE CASCADE,
    csrf_hash TEXT NOT NULL,
    expires_at TIMESTAMPTZ NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_auth_sessions_expiry ON context.auth_sessions(expires_at);
CREATE INDEX IF NOT EXISTS idx_auth_sessions_user ON context.auth_sessions(user_id);
REVOKE ALL ON context.auth_sessions FROM PUBLIC;
-- Preserve old records, assigning an owner only when exactly one account exists.
DO $$ DECLARE
    table_name TEXT;
    legacy_owner TEXT;
    constraint_row RECORD;
BEGIN
    SELECT CASE WHEN count(*) = 1 THEN min(id) ELSE '__legacy__' END INTO legacy_owner FROM context.users;
    FOREACH table_name IN ARRAY ARRAY['files','history','manual','patterns','applications','interviews','companies','events','emails','promises','chunks','activity_log','ignored_files','people','person_facts','spends','budgets','patterns_detected','habits','habit_logs','vault_config','vault_items','subscriptions','debts','journal','saving_goals'] LOOP
        EXECUTE format('ALTER TABLE context.%I ADD COLUMN IF NOT EXISTS user_id TEXT', table_name);
        EXECUTE format('UPDATE context.%I SET user_id = $1 WHERE user_id IS NULL', table_name) USING legacy_owner;
        EXECUTE format('ALTER TABLE context.%I ALTER COLUMN user_id SET DEFAULT nullif(current_setting(''context.user_id'', true), '''')', table_name);
        EXECUTE format('ALTER TABLE context.%I ALTER COLUMN user_id SET NOT NULL', table_name);
        FOR constraint_row IN
            SELECT conname FROM pg_constraint
            WHERE conrelid = format('context.%I', table_name)::regclass AND contype = 'u'
        LOOP
            EXECUTE format('ALTER TABLE context.%I DROP CONSTRAINT %I', table_name, constraint_row.conname);
        END LOOP;
        EXECUTE format('CREATE INDEX IF NOT EXISTS %I ON context.%I(user_id)', 'idx_' || table_name || '_user', table_name);
        EXECUTE format('ALTER TABLE context.%I ENABLE ROW LEVEL SECURITY', table_name);
        EXECUTE format('CREATE POLICY owner_access ON context.%I TO context_app USING (user_id = (SELECT nullif(current_setting(''context.user_id'', true), ''''))) WITH CHECK (user_id = (SELECT nullif(current_setting(''context.user_id'', true), '''')))', table_name);
        EXECUTE format('GRANT SELECT, INSERT, UPDATE, DELETE ON context.%I TO context_app', table_name);
    END LOOP;
END $$;
ALTER TABLE context.vault_config DROP CONSTRAINT vault_config_pkey;
ALTER TABLE context.vault_config ADD PRIMARY KEY(user_id,id);
ALTER TABLE context.ignored_files DROP CONSTRAINT ignored_files_pkey;
ALTER TABLE context.ignored_files ADD PRIMARY KEY(user_id,path);

ALTER TABLE context.files ADD UNIQUE(user_id,path);
ALTER TABLE context.companies ADD UNIQUE(user_id,name);
ALTER TABLE context.events ADD UNIQUE(user_id,uid);
ALTER TABLE context.emails ADD UNIQUE(user_id,uid);
ALTER TABLE context.people ADD UNIQUE(user_id,name);
ALTER TABLE context.budgets ADD UNIQUE(user_id,category);
ALTER TABLE context.habits ADD UNIQUE(user_id,name);
ALTER TABLE context.habit_logs ADD UNIQUE(user_id,habit_id,date);
ALTER TABLE context.journal ADD UNIQUE(user_id,date);
DROP INDEX IF EXISTS context.idx_people_name_nocase;
CREATE UNIQUE INDEX idx_people_name_nocase ON context.people(user_id,lower(name));
ALTER TABLE context.people ADD UNIQUE(user_id,id);
DROP INDEX IF EXISTS context.idx_habits_name_nocase;
CREATE UNIQUE INDEX idx_habits_name_nocase ON context.habits(user_id,lower(name));
ALTER TABLE context.habits ADD UNIQUE(user_id,id);
ALTER TABLE context.person_facts DROP CONSTRAINT person_facts_person_id_fkey;
ALTER TABLE context.person_facts ADD FOREIGN KEY(user_id,person_id) REFERENCES context.people(user_id,id) ON DELETE CASCADE;
ALTER TABLE context.habit_logs DROP CONSTRAINT habit_logs_habit_id_fkey;
ALTER TABLE context.habit_logs ADD FOREIGN KEY(user_id,habit_id) REFERENCES context.habits(user_id,id) ON DELETE CASCADE;
CREATE TABLE context.user_integrations (
    user_id TEXT NOT NULL DEFAULT nullif(current_setting('context.user_id', true), '') REFERENCES context.users(id) ON DELETE CASCADE,
    provider TEXT NOT NULL CHECK(provider IN ('groq','gmail')),
    encrypted_secret TEXT NOT NULL,
    label TEXT,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY(user_id,provider)
);
ALTER TABLE context.user_integrations ENABLE ROW LEVEL SECURITY;
CREATE POLICY owner_access ON context.user_integrations TO context_app
USING(user_id = (SELECT nullif(current_setting('context.user_id', true), '')))
WITH CHECK(user_id = (SELECT nullif(current_setting('context.user_id', true), '')));
GRANT SELECT,INSERT,UPDATE,DELETE ON context.user_integrations TO context_app;
GRANT USAGE,SELECT ON ALL SEQUENCES IN SCHEMA context TO context_app;
