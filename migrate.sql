-- ============================================
-- MIGRACAO: Estacoes (Cozinha/Churrasqueiro)
-- Execute este script NO SQL Editor do Supabase
-- https://supabase.com/dashboard → SQL Editor → Novo
-- ============================================

-- 1. Adicionar coluna station na tabela products
ALTER TABLE products ADD COLUMN IF NOT EXISTS station TEXT DEFAULT '';

-- 2. Criar tabela de pedidos da cozinha/churrasqueiro
CREATE TABLE IF NOT EXISTS kitchen_orders (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    order_id UUID REFERENCES orders(id) ON DELETE CASCADE,
    table_number INTEGER DEFAULT 0,
    product_name TEXT NOT NULL,
    quantity INTEGER DEFAULT 1,
    station TEXT NOT NULL,
    status TEXT DEFAULT 'pending',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    completed_at TIMESTAMP WITH TIME ZONE
);

-- 3. Habilitar RLS
ALTER TABLE kitchen_orders ENABLE ROW LEVEL SECURITY;

-- 4. Politica de acesso
DROP POLICY IF EXISTS "allow_all_kitchen_orders" ON kitchen_orders;
CREATE POLICY "allow_all_kitchen_orders" ON kitchen_orders FOR ALL USING (true) WITH CHECK (true);
