-- ============================================
-- FIX: Adicionar occupied_at e policies
-- Execute NO SQL Editor do Supabase
-- ============================================

-- 1. Adicionar coluna occupied_at na tabela tables
ALTER TABLE tables ADD COLUMN IF NOT EXISTS occupied_at TIMESTAMP WITH TIME ZONE DEFAULT NULL;

-- 2. Corrigir RLS do kitchen_orders
DROP POLICY IF EXISTS "allow_all_kitchen_orders" ON kitchen_orders;
DROP POLICY IF EXISTS "kitchen_full_access" ON kitchen_orders;
CREATE POLICY "kitchen_full_access" ON kitchen_orders
    FOR ALL USING (true) WITH CHECK (true);

-- 3. Garantir que as mesas ocupadas tenham occupied_at baseado no primeiro pedido
UPDATE tables SET occupied_at = (
    SELECT MIN(created_at) FROM orders WHERE orders.table_id = tables.id AND orders.status IN ('pending','preparing')
) WHERE status = 'occupied' AND occupied_at IS NULL;
