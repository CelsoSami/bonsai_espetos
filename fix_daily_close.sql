-- ============================================
-- FECHAR CAIXA DIARIO
-- Execute NO SQL Editor do Supabase
-- ============================================

-- 1. Tabela de fechamentos diarios
CREATE TABLE IF NOT EXISTS daily_closes (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    close_date DATE NOT NULL,
    closed_by TEXT NOT NULL,
    closed_by_name TEXT DEFAULT '',
    total_orders INTEGER DEFAULT 0,
    total_revenue NUMERIC(10,2) DEFAULT 0,
    total_items INTEGER DEFAULT 0,
    total_cash_in NUMERIC(10,2) DEFAULT 0,
    total_cash_out NUMERIC(10,2) DEFAULT 0,
    closing_balance NUMERIC(10,2) DEFAULT 0,
    expected_balance NUMERIC(10,2) DEFAULT 0,
    discrepancy NUMERIC(10,2) DEFAULT 0,
    notes TEXT DEFAULT '',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. RLS
ALTER TABLE daily_closes ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "allow_all_daily_closes" ON daily_closes;
CREATE POLICY "allow_all_daily_closes" ON daily_closes FOR ALL USING (true) WITH CHECK (true);

-- 3. Adicionar tipo 'correcao' no fluxo de caixa (ja suporta via category)
