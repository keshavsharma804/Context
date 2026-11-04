-- Persist only account-specific actions; reminder content comes from live records.
CREATE TABLE IF NOT EXISTS context.reminder_states (
    user_id TEXT NOT NULL DEFAULT nullif(current_setting('context.user_id', true), '')
        REFERENCES context.users(id) ON DELETE CASCADE,
    reminder_id TEXT NOT NULL CHECK (reminder_id ~ '^[0-9a-f]{64}$'),
    read_at TIMESTAMPTZ,
    dismissed_at TIMESTAMPTZ,
    snoozed_until TIMESTAMPTZ,
    PRIMARY KEY (user_id, reminder_id)
);
REVOKE ALL ON context.reminder_states FROM PUBLIC;
ALTER TABLE context.reminder_states ENABLE ROW LEVEL SECURITY;
CREATE POLICY owner_access ON context.reminder_states TO context_app
    USING (user_id = (SELECT nullif(current_setting('context.user_id', true), '')))
    WITH CHECK (user_id = (SELECT nullif(current_setting('context.user_id', true), '')));
GRANT SELECT, INSERT, UPDATE, DELETE ON context.reminder_states TO context_app;
