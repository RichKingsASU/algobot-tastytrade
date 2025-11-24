CREATE TABLE profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id),
  username TEXT UNIQUE,
  full_name TEXT,
  avatar_url TEXT,
  website TEXT
);

CREATE TABLE brokerage_credentials (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES profiles(id),
  brokerage TEXT NOT NULL,
  encrypted_credentials TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE user_watchlists (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES profiles(id),
  name TEXT NOT NULL,
  symbols TEXT[] NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE strategies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES profiles(id),
  name TEXT NOT NULL,
  description TEXT,
  rules JSONB NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE backtests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  strategy_id UUID REFERENCES strategies(id),
  status TEXT NOT NULL,
  start_time TIMESTAMPTZ,
  end_time TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE backtest_results (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  backtest_id UUID REFERENCES backtests(id),
  results JSONB NOT NULL,
  logs TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES profiles(id),
  symbol TEXT NOT NULL,
  type TEXT NOT NULL,
  side TEXT NOT NULL,
  quantity INT NOT NULL,
  price REAL,
  status TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE executions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID REFERENCES orders(id),
  price REAL NOT NULL,
  quantity INT NOT NULL,
  executed_at TIMESTAMPTZ NOT NULL
);

CREATE TABLE historical_bars (
  ts TIMESTAMPTZ NOT NULL,
  symbol TEXT NOT NULL,
  resolution TEXT NOT NULL,
  open REAL NOT NULL,
  high REAL NOT NULL,
  low REAL NOT NULL,
  close REAL NOT NULL,
  volume INT NOT NULL,
  PRIMARY KEY (ts, symbol, resolution)
);

CREATE TABLE realtime_quotes (
  ts TIMESTAMPTZ NOT NULL,
  symbol TEXT NOT NULL,
  last_price REAL,
  bid REAL,
  ask REAL,
  volume INT,
  PRIMARY KEY (ts, symbol)
);
