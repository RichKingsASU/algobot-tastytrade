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
