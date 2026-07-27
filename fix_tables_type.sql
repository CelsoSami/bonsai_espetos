-- ============================================
-- MIGRACAO: Mesas fisicas/virtuais
-- Execute NO SQL Editor do Supabase
-- ============================================

-- 1. Adicionar tipo na tabela tables
ALTER TABLE tables ADD COLUMN IF NOT EXISTS table_type TEXT DEFAULT 'fisica';

-- 2. Atualizar mesas existentes como fisicas
UPDATE tables SET table_type = 'fisica' WHERE table_type IS NULL OR table_type = '';
