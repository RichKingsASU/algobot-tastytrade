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
