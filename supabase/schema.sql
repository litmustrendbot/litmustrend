-- ====================================================================
-- LITMUSTREND: PDC 5M BOS + FVG STRATEGY DATABASE SCHEMA
-- Target: Supabase PostgreSQL (Project: litmustrend)
-- ====================================================================

-- 1. Connected MT5 Trading Accounts
CREATE TABLE IF NOT EXISTS public.trading_accounts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_email VARCHAR(255) NOT NULL,
    account_number VARCHAR(50) NOT NULL,
    broker_server VARCHAR(100) NOT NULL,
    risk_tier VARCHAR(10) NOT NULL CHECK (risk_tier IN ('10%', '5%', '1%')),
    target_rr NUMERIC(5, 2) DEFAULT 10.0,
    status VARCHAR(20) DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'PAUSED', 'HALTED', 'DISCONNECTED')),
    current_equity NUMERIC(15, 2) DEFAULT 0.0,
    current_balance NUMERIC(15, 2) DEFAULT 0.0,
    daily_losses_count INT DEFAULT 0,
    circuit_breaker_halted BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE (account_number, broker_server)
);

-- 2. Strategy Execution Trades Log (PDC 5M BOS + FVG)
CREATE TABLE IF NOT EXISTS public.strategy_trades (
    id BIGSERIAL PRIMARY KEY,
    account_number VARCHAR(50) NOT NULL,
    symbol VARCHAR(20) NOT NULL,
    order_type VARCHAR(20) NOT NULL CHECK (order_type IN ('BUY_LIMIT', 'SELL_LIMIT', 'BUY', 'SELL')),
    lots NUMERIC(10, 2) NOT NULL,
    entry_price NUMERIC(15, 5) NOT NULL,
    stop_loss NUMERIC(15, 5) NOT NULL,
    take_profit NUMERIC(15, 5) NOT NULL,
    risk_usd NUMERIC(15, 2) NOT NULL,
    peak_r NUMERIC(6, 2) DEFAULT 0.0,
    exit_price NUMERIC(15, 5),
    profit_usd NUMERIC(15, 2),
    exit_reason VARCHAR(30) CHECK (exit_reason IN ('TP', 'SL', 'TRAIL_WIN', 'MANUAL', 'CIRCUIT_HALT')),
    status VARCHAR(20) DEFAULT 'OPEN' CHECK (status IN ('PENDING', 'OPEN', 'CLOSED', 'CANCELLED')),
    fvg_refined BOOLEAN DEFAULT TRUE,
    bos_level NUMERIC(15, 5),
    pdc_level NUMERIC(15, 5),
    magic_number BIGINT NOT NULL,
    opened_at TIMESTAMPTZ DEFAULT NOW(),
    closed_at TIMESTAMPTZ
);

-- 3. Daily Directional Bias State (PDC Cache)
CREATE TABLE IF NOT EXISTS public.daily_bias (
    id BIGSERIAL PRIMARY KEY,
    symbol VARCHAR(20) NOT NULL,
    trading_date DATE NOT NULL,
    pdc_price NUMERIC(15, 5) NOT NULL,
    current_bias VARCHAR(10) CHECK (current_bias IN ('BULLISH', 'BEARISH', 'NEUTRAL')),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE (symbol, trading_date)
);

-- Indexes for querying
CREATE INDEX IF NOT EXISTS idx_accounts_status ON public.trading_accounts(status);
CREATE INDEX IF NOT EXISTS idx_trades_account ON public.strategy_trades(account_number);
CREATE INDEX IF NOT EXISTS idx_trades_symbol ON public.strategy_trades(symbol);
CREATE INDEX IF NOT EXISTS idx_trades_closed ON public.strategy_trades(closed_at DESC);

-- Enable RLS
ALTER TABLE public.trading_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.strategy_trades ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.daily_bias ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow public read accounts" ON public.trading_accounts FOR SELECT USING (true);
CREATE POLICY "Allow public insert accounts" ON public.trading_accounts FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow public update accounts" ON public.trading_accounts FOR UPDATE USING (true);

CREATE POLICY "Allow public read trades" ON public.strategy_trades FOR SELECT USING (true);
CREATE POLICY "Allow API insert trades" ON public.strategy_trades FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow API update trades" ON public.strategy_trades FOR UPDATE USING (true);

CREATE POLICY "Allow public read bias" ON public.daily_bias FOR SELECT USING (true);
