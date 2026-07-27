-- ============================================
-- ZERAR TODOS OS DADOS DE TESTE
-- Execute NO SQL Editor do Supabase
-- ATENCAO: Isso apaga TODOS os dados!
-- ============================================

-- Garantir que a coluna table_type existe
ALTER TABLE tables ADD COLUMN IF NOT EXISTS table_type TEXT DEFAULT 'fisica';

-- Desabilitar RLS temporariamente para truncar
ALTER TABLE IF EXISTS orders DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS kitchen_orders DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS products DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS stock_history DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS cashflow DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS daily_closes DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS tables DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS users DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS receipts DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS audit_log DISABLE ROW LEVEL SECURITY;

-- Zerar todas as tabelas
TRUNCATE TABLE orders CASCADE;
TRUNCATE TABLE kitchen_orders CASCADE;
TRUNCATE TABLE products CASCADE;
TRUNCATE TABLE stock_history CASCADE;
TRUNCATE TABLE cashflow CASCADE;
TRUNCATE TABLE daily_closes CASCADE;
TRUNCATE TABLE tables CASCADE;
TRUNCATE TABLE receipts CASCADE;
TRUNCATE TABLE audit_log CASCADE;

-- Nao apagar users (para manter os masters)
-- TRUNCATE TABLE users CASCADE;

-- Reabilitar RLS
ALTER TABLE IF EXISTS orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS kitchen_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS products ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS stock_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS cashflow ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS daily_closes ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS tables ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS users ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS receipts ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS audit_log ENABLE ROW LEVEL SECURITY;

-- Reinserir mesas padrao (1 a 20)
INSERT INTO tables (number, capacity, status, table_type) VALUES
(1, 4, 'available', 'fisica'),
(2, 4, 'available', 'fisica'),
(3, 4, 'available', 'fisica'),
(4, 4, 'available', 'fisica'),
(5, 6, 'available', 'fisica'),
(6, 6, 'available', 'fisica'),
(7, 8, 'available', 'fisica'),
(8, 8, 'available', 'fisica'),
(9, 10, 'available', 'fisica'),
(10, 10, 'available', 'fisica'),
(11, 4, 'available', 'fisica'),
(12, 4, 'available', 'fisica'),
(13, 4, 'available', 'fisica'),
(14, 4, 'available', 'fisica'),
(15, 6, 'available', 'fisica'),
(16, 6, 'available', 'fisica'),
(17, 8, 'available', 'fisica'),
(18, 8, 'available', 'fisica'),
(19, 10, 'available', 'fisica'),
(20, 10, 'available', 'fisica');
