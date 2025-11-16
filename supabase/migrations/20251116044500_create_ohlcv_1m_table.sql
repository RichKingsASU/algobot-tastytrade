CREATE TABLE IF NOT EXISTS public.ohlcv_1m (
  id            bigserial PRIMARY KEY,
  symbol        text NOT NULL,
  ts            timestamptz NOT NULL,  -- candle timestamp (start of interval)
  open          double precision NOT NULL,
  high          double precision NOT NULL,
  low           double precision NOT NULL,
  close         double precision NOT NULL,
  volume        double precision NOT NULL,
  vwap          double precision,      -- optional per-candle VWAP
  day_volume    double precision,      -- DxLink’s dayVolume (if provided)
  _source       text DEFAULT 'dxlink_candle',
  _ingested_at  timestamptz DEFAULT now(),
  UNIQUE (symbol, ts)
);
