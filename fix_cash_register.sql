-- ============================================
-- CAIXA REGISTER
-- Execute NO SQL Editor do Supabase
-- ============================================

CREATE TABLE IF NOT EXISTS cash_register (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    opened_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    opened_by TEXT NOT NULL,
    opened_by_name TEXT DEFAULT '',
    closed_at TIMESTAMP WITH TIME ZONE,
    closed_by TEXT,
    closed_by_name TEXT DEFAULT '',
    is_open BOOLEAN DEFAULT TRUE,
    opening_balance NUMERIC(10,2) DEFAULT 0,
    notes TEXT DEFAULT '',
    close_notes TEXT DEFAULT ''
);

ALTER TABLE cash_register ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "allow_all_cash_register" ON cash_register;
CREATE POLICY "allow_all_cash_register" ON cash_register FOR ALL USING (true) WITH CHECK (true);
