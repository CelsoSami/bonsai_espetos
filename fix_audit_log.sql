-- ============================================
-- LOG DE AUDITORIA
-- Execute NO SQL Editor do Supabase
-- ============================================

-- 1. Tabela de log de auditoria
CREATE TABLE IF NOT EXISTS audit_log (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    action TEXT NOT NULL,
    table_name TEXT NOT NULL,
    record_id UUID,
    old_data JSONB,
    new_data JSONB,
    user_id TEXT,
    user_name TEXT DEFAULT '',
    details TEXT DEFAULT '',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. RLS
ALTER TABLE audit_log ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "allow_all_audit_log" ON audit_log;
CREATE POLICY "allow_all_audit_log" ON audit_log FOR ALL USING (true) WITH CHECK (true);

-- 3. Index para performance
CREATE INDEX IF NOT EXISTS idx_audit_log_table_name ON audit_log(table_name);
CREATE INDEX IF NOT EXISTS idx_audit_log_record_id ON audit_log(record_id);
CREATE INDEX IF NOT EXISTS idx_audit_log_created_at ON audit_log(created_at);
