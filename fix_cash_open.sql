-- ============================================
-- SUPORTE: Abertura de Caixa Diario
-- Execute NO SQL Editor do Supabase
-- ============================================

-- Adicionar coluna is_open na tabela daily_closes
ALTER TABLE daily_closes ADD COLUMN IF NOT EXISTS is_open BOOLEAN DEFAULT FALSE;
ALTER TABLE daily_closes ADD COLUMN IF NOT EXISTS opened_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE daily_closes ADD COLUMN IF NOT EXISTS closed_at TIMESTAMP WITH TIME ZONE;
