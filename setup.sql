-- ============================================
-- BONSAI ESPETOS - Setup do Banco no Supabase
-- Execute no SQL Editor do Supabase
-- IMPORTANTE: Execute este script NOVAMENTE
-- ============================================

-- Remover tabelas antigas se existirem (cuidado em producao!)
DROP TABLE IF EXISTS stock_history CASCADE;
DROP TABLE IF EXISTS cashflow CASCADE;
DROP TABLE IF EXISTS orders CASCADE;
DROP TABLE IF EXISTS products CASCADE;
DROP TABLE IF EXISTS tables CASCADE;
DROP TABLE IF EXISTS users CASCADE;

-- Tabela de Usuarios (independente do auth.users)
CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    email TEXT UNIQUE NOT NULL,
    password TEXT NOT NULL,
    phone TEXT DEFAULT '',
    approved BOOLEAN DEFAULT FALSE,
    is_master BOOLEAN DEFAULT FALSE,
    is_manager BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Tabela de Produtos
CREATE TABLE IF NOT EXISTS products (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT DEFAULT '',
    price NUMERIC(10,2) NOT NULL DEFAULT 0,
    cost NUMERIC(10,2) DEFAULT 0,
    stock INTEGER DEFAULT 0,
    category TEXT DEFAULT '',
    type TEXT DEFAULT '',
    unit TEXT DEFAULT 'un',
    min_stock INTEGER DEFAULT 5,
    active BOOLEAN DEFAULT TRUE,
    station TEXT DEFAULT '',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Tabela de Mesas
CREATE TABLE IF NOT EXISTS tables (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    number INTEGER UNIQUE NOT NULL,
    capacity INTEGER DEFAULT 4,
    status TEXT DEFAULT 'available',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Tabela de Pedidos
CREATE TABLE IF NOT EXISTS orders (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    table_id UUID REFERENCES tables(id),
    comandas INTEGER DEFAULT 1,
    items JSONB DEFAULT '[]',
    total NUMERIC(10,2) DEFAULT 0,
    status TEXT DEFAULT 'pending',
    user_id TEXT,
    user_name TEXT DEFAULT '',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Tabela de Fluxo de Caixa
CREATE TABLE IF NOT EXISTS cashflow (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    type TEXT NOT NULL,
    description TEXT NOT NULL,
    amount NUMERIC(10,2) NOT NULL,
    category TEXT DEFAULT '',
    user_id TEXT,
    user_name TEXT DEFAULT '',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Tabela de Historico de Estoque
CREATE TABLE IF NOT EXISTS stock_history (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    product_id UUID REFERENCES products(id),
    product_name TEXT DEFAULT '',
    previous_stock INTEGER DEFAULT 0,
    new_stock INTEGER DEFAULT 0,
    adjustment INTEGER DEFAULT 0,
    reason TEXT DEFAULT '',
    user_id TEXT,
    user_name TEXT DEFAULT '',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Tabela de Pedidos da Cozinha/Churrasqueiro
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

-- ============================================
-- Habilitar RLS (Row Level Security)
-- ============================================
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE products ENABLE ROW LEVEL SECURITY;
ALTER TABLE tables ENABLE ROW LEVEL SECURITY;
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE cashflow ENABLE ROW LEVEL SECURITY;
ALTER TABLE stock_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE kitchen_orders ENABLE ROW LEVEL SECURITY;

-- ============================================
-- Politicas de acesso (permite tudo)
-- ============================================
CREATE POLICY "allow_all_users" ON users FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "allow_all_products" ON products FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "allow_all_tables" ON tables FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "allow_all_orders" ON orders FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "allow_all_cashflow" ON cashflow FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "allow_all_stock_history" ON stock_history FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "allow_all_kitchen_orders" ON kitchen_orders FOR ALL USING (true) WITH CHECK (true);

-- ============================================
-- Mesas padrao
-- ============================================
INSERT INTO tables (number, capacity, status) VALUES
(1, 4, 'available'), (2, 4, 'available'), (3, 6, 'available'),
(4, 2, 'available'), (5, 8, 'available'), (6, 4, 'available'),
(7, 4, 'available'), (8, 6, 'available'), (9, 2, 'available'),
(10, 10, 'available')
ON CONFLICT (number) DO NOTHING;

-- ============================================
-- Usuarios Master
-- ============================================
INSERT INTO users (id, name, email, password, phone, approved, is_master, is_manager)
VALUES (
    'master-celso-001',
    'Celso Sami',
    'celso_scjunior@hotmail.com',
    'CsShakkal410-',
    '',
    TRUE,
    TRUE,
    TRUE
)
ON CONFLICT (email) DO UPDATE SET
    password = 'CsShakkal410-',
    approved = TRUE,
    is_master = TRUE,
    is_manager = TRUE;

INSERT INTO users (id, name, email, password, phone, approved, is_master, is_manager)
VALUES (
    'master-chaia-001',
    'Celso Chaia',
    'celso.chaia',
    'CsShakkal410-',
    '',
    TRUE,
    TRUE,
    TRUE
)
ON CONFLICT (email) DO UPDATE SET
    password = 'CsShakkal410-',
    approved = TRUE,
    is_master = TRUE,
    is_manager = TRUE;

-- ============================================
-- Produtos de exemplo
-- ============================================
INSERT INTO products (name, description, price, cost, stock, category, type, unit, min_stock) VALUES
('Espeto de Frango', 'Frango temperado com ervas', 18.90, 8.50, 50, 'Espetos', 'Frango', 'un', 10),
('Espeto de Carne', 'Carne bovina nobre', 22.90, 12.00, 40, 'Espetos', 'Carne', 'un', 10),
('Espeto de Porco', 'Porco com bacon', 19.90, 9.00, 35, 'Espetos', 'Porco', 'un', 10),
('Espeto de Cordeiro', 'Cordeiro temperado', 25.90, 14.00, 20, 'Espetos', 'Cordeiro', 'un', 8),
('Arroz', 'Arroz soltinho', 6.90, 1.50, 100, 'Acompanhamentos', 'Basico', 'porcao', 20),
('Feijao', 'Feijao carioca', 6.90, 1.80, 100, 'Acompanhamentos', 'Basico', 'porcao', 20),
('Vinagrete', 'Vinagrete fresco', 4.90, 0.80, 80, 'Acompanhamentos', 'Basico', 'porcao', 20),
('Farofa', 'Farofa de bacon', 7.90, 2.00, 60, 'Acompanhamentos', 'Basico', 'porcao', 15),
('Coca-Cola 350ml', 'Lata', 5.90, 2.50, 100, 'Bebidas', 'Refrigerante', 'un', 30),
('Guarana 350ml', 'Lata', 5.90, 2.30, 80, 'Bebidas', 'Refrigerante', 'un', 30),
('Cerveja Lata', 'Cerveja pilsen', 7.90, 3.50, 120, 'Bebidas', 'Cerveja', 'un', 40),
('Agua Mineral', '500ml', 3.90, 1.00, 100, 'Bebidas', 'Agua', 'un', 30),
('Pudim', 'Pudim de leite', 8.90, 2.50, 30, 'Sobremesas', 'Doce', 'un', 10),
('Brownie', 'Brownie com sorvete', 12.90, 4.00, 25, 'Sobremesas', 'Doce', 'un', 8)
ON CONFLICT DO NOTHING;
