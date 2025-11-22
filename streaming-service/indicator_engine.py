import os
import time
import datetime as dt
from typing import List, Dict

from supabase import create_client, Client

SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_SERVICE_ROLE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY")

supabase: Client = create_client(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)


def ema(values: List[float], period: int) -> List[float]:
    if not values:
        return []

    k = 2 / (period + 1)
    ema_vals = [values[0]]
    for price in values[1:]:
        ema_vals.append(price * k + ema_vals[-1] * (1 - k))
    return ema_vals


def sma(values: List[float], period: int) -> List[float]:
    result = []
    for i in range(len(values)):
        if i + 1 < period:
            result.append(None)
        else:
            window = values[i + 1 - period : i + 1]
            result.append(sum(window) / period)
    return result


def rsi(values: List[float], period: int = 14) -> List[float]:
    if len(values) < period + 1:
        return [None] * len(values)

    gains = [0]
    losses = [0]
    for i in range(1, len(values)):
        delta = values[i] - values[i - 1]
        gains.append(max(delta, 0))
        losses.append(max(-delta, 0))

    avg_gain = sum(gains[1 : period + 1]) / period
    avg_loss = sum(losses[1 : period + 1]) / period

    rsi_vals = [None] * period
    for i in range(period, len(values)):
        if i > period:
            avg_gain = (avg_gain * (period - 1) + gains[i]) / period
            avg_loss = (avg_loss * (period - 1) + losses[i]) / period

        if avg_loss == 0:
            rsi_vals.append(100)
        else:
            rs = avg_gain / avg_loss
            rsi_vals.append(100 - (100 / (1 + rs)))

    # pad beginning if needed
    while len(rsi_vals) < len(values):
        rsi_vals.insert(0, None)

    return rsi_vals


def atr(highs: List[float], lows: List[float], closes: List[float], period: int = 14) -> List[float]:
    trs = []
    for i in range(len(highs)):
        if i == 0:
            trs.append(highs[i] - lows[i])
        else:
            tr = max(
                highs[i] - lows[i],
                abs(highs[i] - closes[i - 1]),
                abs(lows[i] - closes[i - 1]),
            )
            trs.append(tr)

    if len(trs) < period:
        return [None] * len(trs)

    atr_vals = []
    first_atr = sum(trs[:period]) / period
    atr_vals = [None] * (period - 1)
    atr_vals.append(first_atr)

    for i in range(period, len(trs)):
        prev_atr = atr_vals[-1]
        atr_vals.append((prev_atr * (period - 1) + trs[i]) / period)

    while len(atr_vals) < len(trs):
        atr_vals.insert(0, None)

    return atr_vals


def bollinger(values: List[float], period: int = 20, mult: float = 2.0):
    mids = sma(values, period)
    uppers = []
    lowers = []
    for i in range(len(values)):
        if i + 1 < period:
            uppers.append(None)
            lowers.append(None)
        else:
            window = values[i + 1 - period : i + 1]
            mean = mids[i]
            var = sum((x - mean) ** 2 for x in window) / period
            std = var ** 0.5
            uppers.append(mean + mult * std)
            lowers.append(mean - mult * std)
    return mids, uppers, lowers


def macd(values: List[float], fast=12, slow=26, signal=9):
    if not values:
        return [], [], []
    ema_fast = ema(values, fast)
    ema_slow = ema(values, slow)
    macd_line = []
    for f, s in zip(ema_fast, ema_slow):
        macd_line.append(f - s)
    signal_line = ema(macd_line, signal)
    hist = [m - s for m, s in zip(macd_line, signal_line)]
    return macd_line, signal_line, hist


def compute_vwap(closes: List[float], highs: List[float], lows: List[float], volumes: List[float]):
    vwap_vals = []
    cum_pv = 0.0
    cum_vol = 0.0
    for i in range(len(closes)):
        typical_price = (highs[i] + lows[i] + closes[i]) / 3.0
        vol = volumes[i]
        cum_pv += typical_price * vol
        cum_vol += vol
        vwap_vals.append(cum_pv / cum_vol if cum_vol > 0 else typical_price)
    return vwap_vals


def compute_rvol_1d(volumes: List[float]):
    """
    Placeholder: simple 'RVOL-like' calc vs avg intraday volume.
    For now: RVOL on the last bar vs average of all previous bars.
    In production, tie to a daily volume profile table.
    """
    if len(volumes) < 10:
        return [None] * len(volumes)
    avg_vol = sum(volumes[:-1]) / (len(volumes) - 1)
    rvol = []
    for i, v in enumerate(volumes):
        if i == len(volumes) - 1 and avg_vol > 0:
            rvol.append(v / avg_vol)
        else:
            rvol.append(None)
    return rvol


def fetch_symbols() -> List[str]:
    # Simple approach: distinct symbols with candles in last day
    since = (dt.datetime.utcnow() - dt.timedelta(days=1)).isoformat()
    res = supabase.rpc("get_distinct_symbols_since", {"p_since": since}).execute()
    if res.data:
        return [row["symbol"] for row in res.data]
    return []


def ensure_get_distinct_symbols_fn():
    sql = """
    CREATE OR REPLACE FUNCTION public.get_distinct_symbols_since(p_since timestamptz)
    RETURNS TABLE(symbol text)
    LANGUAGE sql
    AS $$
      SELECT DISTINCT symbol
      FROM public.ohlcv_1m
      WHERE ts >= p_since
      ORDER BY symbol;
    $$;
    """
    supabase.postgrest.rpc("sql", {"q": sql})  # or just run this via migration
    # If you don’t want this helper, you can hard-code symbols.


def compute_for_symbol(symbol: str, limit: int = 300):
    res = (
        supabase.table("ohlcv_1m")
        .select("ts, open, high, low, close, volume")
        .eq("symbol", symbol)
        .order("ts", desc=False)
        .limit(limit)
        .execute()
    )
    rows = res.data or []
    if not rows:
        return

    closes = [r["close"] for r in rows]
    highs = [r["high"] for r in rows]
    lows = [r["low"] for r in rows]
    vols = [r["volume"] for r in rows]

    ema_9 = ema(closes, 9)
    ema_21 = ema(closes, 21)
    ema_50 = ema(closes, 50)
    sma_200_vals = sma(closes, 200)

    vwap_vals = compute_vwap(closes, highs, lows, vols)
    rsi_vals = rsi(closes, 14)
    macd_line, macd_signal, macd_hist = macd(closes)
    atr_vals = atr(highs, lows, closes, 14)
    bb_mid, bb_upper, bb_lower = bollinger(closes, 20, 2.0)
    rvol_vals = compute_rvol_1d(vols)

    # Last row = most recent candle
    last = rows[-1]
    idx = len(rows) - 1

    payload = {
        "symbol": symbol,
        "ts": last["ts"],
        "vwap": vwap_vals[idx],
        "ema_9": ema_9[idx],
        "ema_21": ema_21[idx],
        "ema_50": ema_50[idx] if idx < len(ema_50) else None,
        "sma_200": sma_200_vals[idx] if idx < len(sma_200_vals) else None,
        "rvol_1d": rvol_vals[idx],
        "rsi_14": rsi_vals[idx],
        "macd": macd_line[idx],
        "macd_signal": macd_signal[idx],
        "macd_hist": macd_hist[idx],
        "atr_14": atr_vals[idx],
        "bb_mid_20": bb_mid[idx],
        "bb_upper_20": bb_upper[idx],
        "bb_lower_20": bb_lower[idx],
    }

    supabase.table("indicators_intraday").upsert(payload).execute()


def main_loop():
    symbols = ["SPY", "IWM"]  # or fetch_symbols()
    while True:
        for sym in symbols:
            try:
                compute_for_symbol(sym, limit=300)
                print(f"Updated indicators for {sym}")
            except Exception as e:
                print(f"Error computing indicators for {sym}: {e}")
        time.sleep(10)  # recompute every 10 seconds


if __name__ == "__main__":
    main_loop()
