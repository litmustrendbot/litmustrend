-- ====================================================================
-- LITMUSTREND SUPABASE DATABASE SCHEMA MIGRATION
-- Run this script inside your Supabase Project -> SQL Editor
-- ====================================================================

-- 1. Create Trades Table
CREATE TABLE IF NOT EXISTS public.trades (
    id BIGSERIAL PRIMARY KEY,
    account_number VARCHAR(50) NOT NULL,
    symbol VARCHAR(20) NOT NULL,
    trade_type VARCHAR(10) NOT NULL,
    lots NUMERIC(10, 2) NOT NULL,
    open_price NUMERIC(15, 5) NOT NULL,
    close_price NUMERIC(15, 5),
    profit NUMERIC(15, 2),
    status VARCHAR(20) DEFAULT 'OPEN',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Create User EA Licenses Table
CREATE TABLE IF NOT EXISTS public.licenses (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_email VARCHAR(255) NOT NULL UNIQUE,
    account_number VARCHAR(50) NOT NULL,
    status VARCHAR(20) DEFAULT 'ACTIVE',
    secret_key VARCHAR(255) NOT NULL,
    expires_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Create Signals Table
CREATE TABLE IF NOT EXISTS public.signals (
    id BIGSERIAL PRIMARY KEY,
    symbol VARCHAR(20) NOT NULL,
    signal_type VARCHAR(10) NOT NULL,
    entry_price NUMERIC(15, 5) NOT NULL,
    stop_loss NUMERIC(15, 5),
    take_profit NUMERIC(15, 5),
    status VARCHAR(20) DEFAULT 'PENDING',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable Row Level Security (RLS)
ALTER TABLE public.trades ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.licenses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.signals ENABLE ROW LEVEL SECURITY;

-- Allow public read access to trades (or restrict as needed)
CREATE POLICY "Allow public read trades" ON public.trades FOR SELECT USING (true);
CREATE POLICY "Allow API insert trades" ON public.trades FOR INSERT WITH CHECK (true);
