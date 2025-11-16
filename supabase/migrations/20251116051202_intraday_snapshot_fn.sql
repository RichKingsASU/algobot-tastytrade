CREATE OR REPLACE FUNCTION public.get_intraday_snapshot(
  p_symbol text,
  p_limit  integer DEFAULT 1000
)
RETURNS TABLE (
  ts           timestamptz,
  open         double precision,
  high         double precision,
  low          double precision,
  close        double precision,
  volume       double precision,
  vwap         double precision,
  ema_9        double precision,
  ema_21       double precision,
  ema_50       double precision,
  sma_200      double precision,
  rvol_1d      double precision,
  rsi_14       double precision,
  macd         double precision,
  macd_signal  double precision,
  macd_hist    double precision,
  atr_14       double precision,
  bb_mid_20    double precision,
  bb_upper_20  double precision,
  bb_lower_20  double precision
)
LANGUAGE sql
AS $$
  SELECT
    c.ts,
    c.open,
    c.high,
    c.low,
    c.close,
    c.volume,
    i.vwap,
    i.ema_9,
    i.ema_21,
    i.ema_50,
    i.sma_200,
    i.rvol_1d,
    i.rsi_14,
    i.macd,
    i.macd_signal,
    i.macd_hist,
    i.atr_14,
    i.bb_mid_20,
    i.bb_upper_20,
    i.bb_lower_20
  FROM public.ohlcv_1m c
  LEFT JOIN public.indicators_intraday i
    ON i.symbol = c.symbol
   AND i.ts = c.ts
  WHERE c.symbol = p_symbol
  ORDER BY c.ts DESC
  LIMIT p_limit;
$$;
