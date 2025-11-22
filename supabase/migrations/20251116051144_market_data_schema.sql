-- 1) Canonical 1m candles (from DXLink Candle events)
CREATE TABLE IF NOT EXISTS public.ohlcv_1m (
  id            bigserial PRIMARY KEY,
  symbol        text NOT NULL,
  ts            timestamptz NOT NULL,  -- candle start timestamp (UTC)
  open          double precision NOT NULL,
  high          double precision NOT NULL,
  low           double precision NOT NULL,
  close         double precision NOT NULL,
  volume        double precision NOT NULL,
  vwap          double precision,      -- optional per-candle vwap
  day_volume    double precision,      -- intraday cumulative volume if present
  _source       text DEFAULT 'dxlink_candle',
  _ingested_at  timestamptz DEFAULT now(),
  UNIQUE (symbol, ts)
);

CREATE INDEX IF NOT EXISTS idx_ohlcv_1m_symbol_ts
  ON public.ohlcv_1m (symbol, ts DESC);

-- 2) Intraday Indicators (Tier 1 + Tier 2)
CREATE TABLE IF NOT EXISTS public.indicators_intraday (
  id            bigserial PRIMARY KEY,
  symbol        text NOT NULL,
  ts            timestamptz NOT NULL,  -- aligns with ohlcv_1m.ts

  -- Tier 1
  vwap          double precision,
  ema_9         double precision,
  ema_21        double precision,
  ema_50        double precision,
  sma_200       double precision,
  rvol_1d       double precision,

  -- Tier 2
  rsi_14        double precision,
  macd          double precision,
  macd_signal   double precision,
  macd_hist     double precision,
  atr_14        double precision,
  bb_mid_20     double precision,
  bb_upper_20   double precision,
  bb_lower_20   double precision,

  _calc_at      timestamptz DEFAULT now(),
  UNIQUE (symbol, ts)
);

CREATE INDEX IF NOT EXISTS idx_indicators_intraday_symbol_ts
  ON public.indicators_intraday (symbol, ts DESC);

-- 3) Pro-desk Key Levels
CREATE TABLE IF NOT EXISTS public.levels_intraday (
  id                 bigserial PRIMARY KEY,
  symbol             text NOT NULL,
  session_date       date NOT NULL,

  prev_day_high      double precision,
  prev_day_low       double precision,
  prev_day_close     double precision,
  premarket_high     double precision,
  premarket_low      double precision,
  open_price         double precision,
  orh_5m             double precision,
  orl_5m             double precision,

  calc_ts            timestamptz DEFAULT now(),
  UNIQUE (symbol, session_date)
);

CREATE INDEX IF NOT EXISTS idx_levels_intraday_symbol_date
  ON public.levels_intraday (symbol, session_date DESC);
