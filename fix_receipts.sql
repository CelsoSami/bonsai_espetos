-- ============================================
-- RECIBOS
-- Execute NO SQL Editor do Supabase
-- ============================================

-- 1. Tabela de recibos
CREATE TABLE IF NOT EXISTS receipts (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    order_id UUID,
    table_number INTEGER DEFAULT 0,
    comanda_name TEXT DEFAULT '',
    items JSONB DEFAULT '[]',
    total NUMERIC(10,2) DEFAULT 0,
    status TEXT DEFAULT 'open',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. RLS
ALTER TABLE receipts ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "allow_all_receipts" ON receipts;
CREATE POLICY "allow_all_receipts" ON receipts FOR ALL USING (true) WITH CHECK (true);
