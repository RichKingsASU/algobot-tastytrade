CREATE OR REPLACE FUNCTION public.get_key_levels(
  p_symbol text,
  p_session date DEFAULT CURRENT_DATE
)
RETURNS public.levels_intraday
LANGUAGE sql
AS $$
  SELECT *
  FROM public.levels_intraday
  WHERE symbol = p_symbol
    AND session_date = p_session
  ORDER BY calc_ts DESC
  LIMIT 1;
$$;
