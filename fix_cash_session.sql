CREATE TABLE IF NOT EXISTS cash_sessions (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    status TEXT DEFAULT 'closed',
    opened_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    opened_by TEXT,
    opened_by_name TEXT DEFAULT '',
    closed_at TIMESTAMP WITH TIME ZONE,
    closed_by TEXT,
    closed_by_name TEXT DEFAULT '',
    opening_balance NUMERIC(10,2) DEFAULT 0,
    notes TEXT DEFAULT ''
);

ALTER TABLE cash_sessions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "allow_all_cash_sessions" ON cash_sessions;
CREATE POLICY "allow_all_cash_sessions" ON cash_sessions FOR ALL USING (true) WITH CHECK (true);
