-- ============================================
-- FIX: Politicas RLS para kitchen_orders
-- Execute NO SQL Editor do Supabase
-- https://supabase.com/dashboard -> SQL Editor -> Novo
-- ============================================

-- Remove todas as politicas existentes na tabela
DROP POLICY IF EXISTS "allow_all_kitchen_orders" ON kitchen_orders;
DROP POLICY IF EXISTS "anon_access_kitchen" ON kitchen_orders;
DROP POLICY IF EXISTS "authenticated_access_kitchen" ON kitchen_orders;

-- Cria politica que permite tudo para todos (anon + authenticated)
CREATE POLICY "kitchen_full_access" ON kitchen_orders
    FOR ALL
    USING (true)
    WITH CHECK (true);

-- Verificar se a tabela existe e tem a estrutura correta
DO $$
BEGIN
    IF NOT EXISTS (SELECT FROM pg_tables WHERE tablename = 'kitchen_orders') THEN
        CREATE TABLE kitchen_orders (
            id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
            order_id UUID,
            table_number INTEGER DEFAULT 0,
            product_name TEXT NOT NULL,
            quantity INTEGER DEFAULT 1,
            station TEXT NOT NULL,
            status TEXT DEFAULT 'pending',
            created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
            completed_at TIMESTAMP WITH TIME ZONE
        );
        ALTER TABLE kitchen_orders ENABLE ROW LEVEL SECURITY;
    END IF;
END $$;
