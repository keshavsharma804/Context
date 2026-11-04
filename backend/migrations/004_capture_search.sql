CREATE TABLE context.capture_receipts (
    user_id TEXT NOT NULL DEFAULT nullif(current_setting('context.user_id', true), '')
        REFERENCES context.users(id) ON DELETE CASCADE,
    request_id UUID NOT NULL,
    payload_hash TEXT NOT NULL,
    result JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (user_id, request_id)
);
REVOKE ALL ON context.capture_receipts FROM PUBLIC;
ALTER TABLE context.capture_receipts ENABLE ROW LEVEL SECURITY;
CREATE POLICY owner_access ON context.capture_receipts TO context_app
    USING (user_id = (SELECT nullif(current_setting('context.user_id', true), '')))
    WITH CHECK (user_id = (SELECT nullif(current_setting('context.user_id', true), '')));
GRANT SELECT, INSERT, UPDATE, DELETE ON context.capture_receipts TO context_app;

-- Match these expressions in services/global_search.py so PostgreSQL can use GIN.
CREATE INDEX idx_search_spends ON context.spends USING GIN (to_tsvector('simple', coalesce(merchant,'') || ' ' || coalesce(category,'')));
CREATE INDEX idx_search_notes ON context.manual USING GIN (to_tsvector('simple', coalesce(payload,'')));
CREATE INDEX idx_search_people ON context.people USING GIN (to_tsvector('simple', coalesce(name,'')));
CREATE INDEX idx_search_events ON context.events USING GIN (to_tsvector('simple', coalesce(title,'') || ' ' || coalesce(description,'') || ' ' || coalesce(location,'') || ' ' || coalesce(company,'')));
CREATE INDEX idx_search_journal ON context.journal USING GIN (to_tsvector('simple', coalesce(headline,'') || ' ' || coalesce(content,'') || ' ' || coalesce(tags,'')));
CREATE INDEX idx_search_emails ON context.emails USING GIN (to_tsvector('simple', coalesce(subject,'') || ' ' || coalesce(from_name,'') || ' ' || coalesce(from_addr,'') || ' ' || coalesce(body_snippet,'')));
CREATE INDEX idx_search_jobs ON context.applications USING GIN (to_tsvector('simple', coalesce(company,'') || ' ' || coalesce(role,'') || ' ' || coalesce(notes,'')));
CREATE INDEX idx_search_subscriptions ON context.subscriptions USING GIN (to_tsvector('simple', coalesce(name,'') || ' ' || coalesce(category,'') || ' ' || coalesce(notes,'')));
CREATE INDEX idx_search_debts ON context.debts USING GIN (to_tsvector('simple', coalesce(person,'') || ' ' || coalesce(description,'') || ' ' || coalesce(notes,'')));
CREATE INDEX idx_search_spends_amount ON context.spends(user_id,amount);
CREATE INDEX idx_search_subscriptions_amount ON context.subscriptions(user_id,amount);
CREATE INDEX idx_search_debts_amount ON context.debts(user_id,amount);
