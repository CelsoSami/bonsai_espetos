-- ============================================
-- MIGRACAO: Comanda nominal
-- Execute NO SQL Editor do Supabase
-- ============================================

-- 1. Alterar comandas para TEXT (suporta nome)
ALTER TABLE orders ALTER COLUMN comandas TYPE TEXT USING comandas::TEXT;

-- 2. Adicionar campo comanda_name no kitchen_orders
ALTER TABLE kitchen_orders ADD COLUMN IF NOT EXISTS comanda_name TEXT DEFAULT '';
