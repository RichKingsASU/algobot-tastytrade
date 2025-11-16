import os
import asyncio
import json

import httpx
import websockets
from supabase import create_client
from dotenv import load_dotenv

load_dotenv()  # Load variables from .env

# Environment variables
TASTY_USERNAME = os.getenv("TASTY_USERNAME")
TASTY_PASSWORD = os.getenv("TASTY_PASSWORD")
SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_KEY")

if not all([TASTY_USERNAME, TASTY_PASSWORD, SUPABASE_URL, SUPABASE_KEY]):
    raise RuntimeError("Missing one of TASTY_USERNAME, TASTY_PASSWORD, SUPABASE_URL, SUPABASE_KEY in .env")

# Initialize Supabase client
supabase = create_client(SUPABASE_URL, SUPABASE_KEY)

# Sandbox base URL
TASTY_API_BASE = "https://api.cert.tastyworks.com"


async def get_session_token():
    """
    Call POST /sessions on the sandbox to get a Tastytrade session-token.
    Accepts any 2xx status. Extracts "session-token" from the JSON.
    Uses a 15-second default timeout.
    """
    login_url = f"{TASTY_API_BASE}/sessions"
    payload = {"login": TASTY_USERNAME, "password": TASTY_PASSWORD}
    timeout = httpx.Timeout(15.0)  # 15s default for connect/read

    async with httpx.AsyncClient(timeout=timeout) as client:
        try:
            resp = await client.post(login_url, json=payload)
        except Exception as e:
            print("❌ Network/timeout error during login:", repr(e))
            raise RuntimeError("Login request failed due to network/timeout") from e

    # Accept any 2xx (e.g., 201 Created)
    if not (200 <= resp.status_code < 300):
        print(f"\n❌ Sandbox login returned {resp.status_code}")
        try:
            print("Response JSON:", resp.json())
        except Exception:
            print("Response Text:", resp.text)
        raise RuntimeError("Sandbox /sessions failed—see above response for details.")

    data = resp.json()

    # Sandbox’s field is "session-token" under data
    session_token = data.get("data", {}).get("session-token")
    if not session_token:
        raise RuntimeError(f"Failed to extract session-token, response was: {data}")
    return session_token


async def get_api_quote_token(session_token):
    """
    Use the session_token to call GET /api-quote-tokens on sandbox,
    returning both the quote token and the DXLink WebSocket URL.
    """
    headers = {"Authorization": f"Bearer {session_token}"}
    quote_url = f"{TASTY_API_BASE}/api-quote-tokens"
    timeout = httpx.Timeout(15.0)

    async with httpx.AsyncClient(timeout=timeout) as client:
        try:
            resp = await client.get(quote_url, headers=headers)
        except Exception as e:
            print("❌ Network/timeout error during quote-token fetch:", repr(e))
            raise RuntimeError("GET /api-quote-tokens failed due to network/timeout") from e

    if not (200 <= resp.status_code < 300):
        print(f"\n❌ Sandbox /api-quote-tokens returned {resp.status_code}")
        try:
            print("Response JSON:", resp.json())
        except Exception:
            print("Response Text:", resp.text)
        raise RuntimeError("Sandbox /api-quote-tokens failed—see above response for details.")

    data = resp.json()
    token = data.get("data", {}).get("token") or data.get("data", {}).get("quote_token")
    dxlink_url = data.get("data", {}).get("dxlink-url") or data.get("data", {}).get("dxlink_url")
    if not token or not dxlink_url:
        raise RuntimeError(f"Failed to extract quote token or dxlink URL, response was: {data}")
    return token, dxlink_url


async def get_streamer_symbol(session_token, equity_symbol: str) -> str:
    """
    Given "AAPL", call GET /instruments/equities/AAPL on sandbox
    and return the "streamer-symbol" field.
    """
    headers = {"Authorization": f"Bearer {session_token}"}
    url = f"{TASTY_API_BASE}/instruments/equities/{equity_symbol}"
    timeout = httpx.Timeout(15.0)

    async with httpx.AsyncClient(timeout=timeout) as client:
        try:
            resp = await client.get(url, headers=headers)
        except Exception as e:
            print(f"❌ Network/timeout error fetching streamer-symbol for {equity_symbol}:", repr(e))
            raise RuntimeError(f"Failed to fetch streamer-symbol for {equity_symbol}") from e

    if not (200 <= resp.status_code < 300):
        print(f"\n❌ GET /instruments/equities/{equity_symbol} returned {resp.status_code}")
        try:
            print("Response JSON:", resp.json())
        except Exception:
            print("Response Text:", resp.text)
        raise RuntimeError(f"Failed to extract streamer-symbol for {equity_symbol}, endpoint returned {resp.status_code}")

    data = resp.json()
    items = data.get("data", {}).get("items", [])
    if not items or "streamer-symbol" not in items[0]:
        raise RuntimeError(f"Failed to extract streamer-symbol for {equity_symbol}, response was: {data}")
    return items[0]["streamer-symbol"]


def safe_value(val):
    """
    Convert DXLink values to Python-friendly types.
    If val is None or the string "NaN", return None. Otherwise, return val.
    """
    if val is None:
        return None
    if isinstance(val, str) and val.lower() == "nan":
        return None
    return val


async def start_streamer():
    # 1) Authenticate and get tokens
    print("⏳ Fetching Tastytrade session token…")
    session_token = await get_session_token()
    print("✅ Session token acquired.")

    print("⏳ Fetching API quote token…")
    quote_token, dxlink_url = await get_api_quote_token(session_token)
    print("✅ API quote token acquired (valid 24h).")
    print(f"   • DXLink URL: {dxlink_url}")

    # 2) Resolve streamer-symbols for each ticker (example: AAPL & SPY)
    print("⏳ Resolving streamer-symbols for AAPL & SPY…")
    streamer_symbols = {}
    for sym in ["AAPL", "SPY"]:
        streamer_symbols[sym] = await get_streamer_symbol(session_token, sym)
    print("✅ streamer-symbols:", streamer_symbols)

    # 3) Connect to DXLink WebSocket
    print(f"⏳ Opening WebSocket to {dxlink_url} …")
    async with websockets.connect(dxlink_url) as ws:
        print("✅ WebSocket opened.")

        # 3a) SEND SETUP
        setup_msg = {
            "type": "SETUP",
            "channel": 0,
            "version": "0.1-PY/0.1.0",
            "keepaliveTimeout": 60,
            "acceptKeepaliveTimeout": 60,
        }
        await ws.send(json.dumps(setup_msg))
        print("→ SETUP sent")

        channel_id = 3

        # Task: send KEEPALIVE every 30 seconds
        async def keepalive_loop():
            while True:
                await asyncio.sleep(30)
                keepalive_msg = {"type": "KEEPALIVE", "channel": 0}
                await ws.send(json.dumps(keepalive_msg))

        asyncio.create_task(keepalive_loop())

        # 3b) Main receive loop
        async for raw_msg in ws:
            try:
                msg = json.loads(raw_msg)
            except json.JSONDecodeError:
                print("⚠ Invalid JSON:", raw_msg)
                continue

            msg_type = msg.get("type")
            ch = msg.get("channel")

            # Step A: After SETUP, DXLink responds with AUTH_STATE (UNAUTHORIZED)
            if msg_type == "AUTH_STATE" and msg.get("state") == "UNAUTHORIZED" and ch == 0:
                auth_msg = {"type": "AUTH", "channel": 0, "token": quote_token}
                await ws.send(json.dumps(auth_msg))
                print("→ AUTH sent (channel 0)")
                continue

            # Step B: After AUTH, on AUTHORIZED open FEED channel
            if msg_type == "AUTH_STATE" and msg.get("state") == "AUTHORIZED" and ch == 0:
                user_id = msg.get("userId")
                print(f"✅ AUTHORIZED on channel 0 (userId={user_id})")
                chan_req = {
                    "type": "CHANNEL_REQUEST",
                    "channel": channel_id,
                    "service": "FEED",
                    "parameters": {"contract": "AUTO"},
                }
                await ws.send(json.dumps(chan_req))
                print(f"→ CHANNEL_REQUEST sent (channel {channel_id})")
                continue

            # Step C: On CHANNEL_OPENED, send FEED_SETUP
            if msg_type == "CHANNEL_OPENED" and ch == channel_id:
                print(f"✅ Channel {channel_id} opened (service FEED).")
                feed_setup = {
                    "type": "FEED_SETUP",
                    "channel": channel_id,
                    "acceptAggregationPeriod": 0.1,
                    "acceptDataFormat": "COMPACT",
                    "acceptEventFields": {
                        "Trade": ["eventType", "eventSymbol", "price", "dayVolume", "size"],
                        "Quote": ["eventType", "eventSymbol", "bidPrice", "askPrice", "bidSize", "askSize"],
                        "Summary": [
                            "eventType",
                            "eventSymbol",
                            "openInterest",
                            "dayOpenPrice",
                            "dayHighPrice",
                            "dayLowPrice",
                            "prevDayClosePrice",
                        ],
                        "Greeks": ["eventType", "eventSymbol", "volatility", "delta", "gamma", "theta", "rho", "vega"],
                        "Profile": [
                            "eventType",
                            "eventSymbol",
                            "description",
                            "shortSaleRestriction",
                            "tradingStatus",
                            "statusReason",
                            "haltStartTime",
                            "haltEndTime",
                            "highLimitPrice",
                            "lowLimitPrice",
                            "high52WeekPrice",
                            "low52WeekPrice",
                        ],
                    },
                }
                await ws.send(json.dumps(feed_setup))
                print(f"→ FEED_SETUP sent (channel {channel_id})")
                continue

            # Step D: On FEED_CONFIG, send FEED_SUBSCRIPTION
            if msg_type == "FEED_CONFIG" and ch == channel_id:
                print(f"✅ FEED_CONFIG confirmed (channel {channel_id}).")
                add_list = []
                for plain, streamer in streamer_symbols.items():
                    add_list.append({"type": "Quote", "symbol": streamer})
                    add_list.append({"type": "Trade", "symbol": streamer})
                    add_list.append({"type": "Summary", "symbol": streamer})
                    add_list.append({"type": "Greeks", "symbol": streamer})
                    add_list.append({"type": "Profile", "symbol": streamer})
                subscription = {
                    "type": "FEED_SUBSCRIPTION",
                    "channel": channel_id,
                    "reset": True,
                    "add": add_list,
                }
                await ws.send(json.dumps(subscription))
                print(f"→ FEED_SUBSCRIPTION sent (channel {channel_id})")
                continue

            # Step E: On FEED_DATA, parse and insert into Supabase
            if msg_type == "FEED_DATA" and ch == channel_id:
                raw_data = msg.get("data", [])
                for i in range(0, len(raw_data), 2):
                    event_type = raw_data[i]
                    event_vals = raw_data[i + 1]

                    if event_type == "Quote":
                        # ["Quote", symbol, bidPrice, askPrice, bidSize, askSize]
                        _, symbol, bp, ap, bs, asz = event_vals
                        bid_price = safe_value(bp)
                        ask_price = safe_value(ap)
                        bid_size = safe_value(bs)
                        ask_size = safe_value(asz)
                        res = supabase.table("quotes").insert(
                            {
                                "event_symbol": symbol,
                                "bid_price": bid_price,
                                "ask_price": ask_price,
                                "bid_size": bid_size,
                                "ask_size": ask_size,
                            }
                        ).execute()
                        if res.error:
                            print("❌ Supabase insert (Quote) error:", res.error)

                    elif event_type == "Trade":
                        # ["Trade", symbol, price, dayVolume, size]
                        _, symbol, price, dv, size = event_vals
                        price_v = safe_value(price)
                        dv_v = safe_value(dv)
                        size_v = safe_value(size)
                        res = supabase.table("trades").insert(
                            {
                                "event_symbol": symbol,
                                "price": price_v,
                                "day_volume": dv_v,
                                "size": size_v,
                            }
                        ).execute()
                        if res.error:
                            print("❌ Supabase insert (Trade) error:", res.error)

                    elif event_type == "Summary":
                        # ["Summary", symbol, openInterest, dayOpenPrice, dayHighPrice, dayLowPrice, prevDayClosePrice]
                        _, symbol, oi, dop, dhp, dlp, pcp = event_vals
                        oi_v = safe_value(oi)
                        dop_v = safe_value(dop)
                        dhp_v = safe_value(dhp)
                        dlp_v = safe_value(dlp)
                        pcp_v = safe_value(pcp)
                        res = supabase.table("summaries").insert(
                            {
                                "event_symbol": symbol,
                                "open_interest": oi_v,
                                "day_open_price": dop_v,
                                "day_high_price": dhp_v,
                                "day_low_price": dlp_v,
                                "prev_close_price": pcp_v,
                            }
                        ).execute()
                        if res.error:
                            print("❌ Supabase insert (Summary) error:", res.error)

                    # You can extend to handle "Greeks" and "Profile" if you have those tables

                continue

            # Handle ERROR or CHANNEL_CLOSED messages
            if msg_type == "ERROR":
                print("⚠ DXLink ERROR:", msg)
            if msg_type == "CHANNEL_CLOSED" and ch == channel_id:
                print(f"⚠ Channel {channel_id} closed by server:", msg)
                break

        print("WebSocket loop ended, cleaning up…")

    print("🔌 WebSocket closed. Exiting.")


if __name__ == "__main__":
    asyncio.run(start_streamer())
