-- Add missing columns to the orders table
ALTER TABLE orders
ADD COLUMN IF NOT EXISTS account_number TEXT,
ADD COLUMN IF NOT EXISTS instrument_type TEXT,
ADD COLUMN IF NOT EXISTS time_in_force TEXT,
ADD COLUMN IF NOT EXISTS placed_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS filled_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

-- Create the trades table
CREATE TABLE IF NOT EXISTS trades (
  trade_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_number TEXT NOT NULL,
  symbol TEXT NOT NULL,
  instrument_type TEXT,
  quantity NUMERIC NOT NULL,
  price NUMERIC NOT NULL,
  order_type TEXT,
  order_status TEXT,
  transaction_date TIMESTAMPTZ NOT NULL,
  commission NUMERIC,
  fees NUMERIC,
  net_amount NUMERIC,
  closing_price NUMERIC,
  pnl NUMERIC,
  pnl_percentage NUMERIC,
  time_in_force TEXT,
  asset_type TEXT,
  underlying_symbol TEXT,
  strike_price NUMERIC,
  option_type TEXT,
  expiration_date DATE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create the positions table
CREATE TABLE IF NOT EXISTS positions (
  position_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_number TEXT NOT NULL,
  symbol TEXT NOT NULL,
  instrument_type TEXT,
  quantity NUMERIC NOT NULL,
  average_price NUMERIC,
  market_value NUMERIC,
  realized_pnl NUMERIC,
  unrealized_pnl NUMERIC,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
