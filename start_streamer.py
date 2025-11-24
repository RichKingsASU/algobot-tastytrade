# start_streamer.py

import os
import asyncio
import json
from datetime import datetime, timedelta, timezone

import httpx
import websockets
from supabase import create_client
from dotenv import load_dotenv

load_dotenv()  # Expects SUPABASE_URL and SUPABASE_KEY in .env

# ─────────────────────────────────────────────────────────────────────────────
# 1) Supabase Setup
# ─────────────────────────────────────────────────────────────────────────────
SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_KEY")
if not all([SUPABASE_URL, SUPABASE_KEY]):
    raise RuntimeError("Missing SUPABASE_URL or SUPABASE_KEY in .env")

supabase = create_client(SUPABASE_URL, SUPABASE_KEY)

import httpx  # you already import this above

SUPABASE_FUNCTIONS_URL = os.getenv(
    "SUPABASE_FUNCTIONS_URL",
    SUPABASE_URL.rstrip("/") + "/functions/v1",
)

async def fetch_session_via_supabase_login() -> str:
    """
    Call the Supabase Edge Function 'login_session' to get a Tastytrade session token.
    """
    url = f"{SUPABASE_FUNCTIONS_URL}/login_session"
    headers = {
        "Content-Type": "application/json",
        # If you have anon key / auth turned on, uncomment this:
        # "apikey": os.getenv("SUPABASE_ANON_KEY", ""),
    }
    async with httpx.AsyncClient(timeout=15.0) as client:
        resp = await client.post(url, headers=headers, json={})

    if not (200 <= resp.status_code < 300):
        raise RuntimeError(f"login_session failed: {resp.status_code} {resp.text}")

    data = resp.json()
    # Adjust these to match your actual login_session JSON structure:
    token = (
        data.get("session_token")
        or data.get("session-token")
        or data.get("data", {}).get("session_token")
        or data.get("data", {}).get("session-token")
    )
    if not token:
        raise RuntimeError(f"Could not find session_token in login_session response: {data}")

    return token


# ─────────────────────────────────────────────────────────────────────────────
# 2) Tastyworks Production Username (must match what's stored in user_tokens)
# ─────────────────────────────────────────────────────────────────────────────
TASTY_USERNAME = "richkingsasu@gmail.com"  # same as used in login_store.py
#TASTY_API_BASE = "https://api.tastyworks.com" # Production URL
TASTY_API_BASE = "https://api.cert.tastyworks.com" # Sandbox URL

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


async def get_api_quote_token(session_token):
    """
    Use the session_token to call GET /api-quote-tokens on production,
    returning (quote_token, quote_expiration: datetime, dxlink_url).
    """
    # — Remove “Bearer ” and add User-Agent —
    headers = {
        "User-Agent": "my-custom-client/1.0",
        "Authorization": session_token
    }

    url = f"{TASTY_API_BASE}/api-quote-tokens"
    timeout = httpx.Timeout(15.0)

    print(f"→ HTTP GET {url} with headers={headers}")
    async with httpx.AsyncClient(timeout=timeout) as client:
        resp = await client.get(url, headers=headers)
    print("← HTTP status:", resp.status_code)
    try:
        print("← Raw response JSON:", json.dumps(resp.json(), indent=2))
    except Exception:
        print("← Response text:", resp.text)

    if not (200 <= resp.status_code < 300):
        print("Quote-token failed:", resp.status_code, resp.text)
        raise RuntimeError("Cannot fetch quote token; ensure account has streaming enabled")

    data = resp.json().get("data", {})
    token = data.get("token") or data.get("quote_token")
    dxlink_url = data.get("dxlink-url") or data.get("dxlink_url")
    if not token or not dxlink_url:
        raise RuntimeError(f"Missing token or dxlink-url in: {data}")

    now_utc = datetime.now(timezone.utc)
    quote_exp = now_utc + timedelta(hours=24)
    return token, quote_exp, dxlink_url


async def get_streamer_symbol(session_token, equity_symbol: str) -> str:
    """
    Given "SPY", call GET /instruments/equities/SPY on production
    and return the "streamer-symbol" field.
    """
    # — Remove “Bearer ” and add User-Agent —
    headers = {
        "User-Agent": "my-custom-client/1.0",
        "Authorization": session_token
    }

    url = f"{TASTY_API_BASE}/instruments/equities/{equity_symbol}"
    timeout = httpx.Timeout(15.0)

    print(f"→ HTTP GET {url} with headers={headers}")
    async with httpx.AsyncClient(timeout=timeout) as client:
        resp = await client.get(url, headers=headers)
    print("← HTTP status:", resp.status_code)
    try:
        print("← Raw response JSON:", json.dumps(resp.json(), indent=2))
    except Exception:
        print("← Response text:", resp.text)

    if not (200 <= resp.status_code < 300):
        raise RuntimeError(f"Failed to fetch symbol for {equity_symbol}: {resp.text}")

    data = resp.json().get("data", {})
    items = data.get("items", [])
    if not items or "streamer-symbol" not in items[0]:
        raise RuntimeError(f"No streamer-symbol in response for {equity_symbol}: {data}")

    symbol = items[0]["streamer-symbol"]
    print(f"← Parsed streamer-symbol for {equity_symbol}: {symbol}")
    return symbol


async def main():
    # 1) RETRIEVE LATEST session_token FROM Supabase.user_tokens
    print("⏳ Retrieving latest session_token from Supabase…")
    query = (
        supabase.table("user_tokens")
        .select("id, session_token")
        .eq("username", TASTY_USERNAME)
        .order("created_at", desc=True)
        .limit(1)
        .execute()
    )
    print("← Supabase query result:", query)

    if not getattr(query, "data", None):
        print(f"⚠️ No user_tokens row found for username = {TASTY_USERNAME}")
        print("⏳ Calling login_session via Supabase to create a fresh session_token...")

        try:
            session_token = await fetch_session_via_supabase_login()
            print("✅ Obtained session_token from login_session.")
        except Exception as e:
            print("❌ Failed to obtain session_token via login_session:", e)
            return

        # Insert new row into user_tokens
        insert_res = (
            supabase.table("user_tokens")
            .insert({
                "username": TASTY_USERNAME,
                "session_token": session_token,
            })
            .execute()
        )
        print("← Supabase insert result for new user_tokens row:", insert_res)

        # Re-query to get id + session_token consistently
        query = (
            supabase.table("user_tokens")
            .select("id, session_token")
            .eq("username", TASTY_USERNAME)
            .order("created_at", desc=True)
            .limit(1)
            .execute()
        )

    if not getattr(query, "data", None):
        print("❌ Still no user_tokens row after login attempt. Aborting.")
        return

    row = query.data[0]
    row_id = row["id"]
    session_token = row["session_token"]
    print(f"✅ Using session_token (user_tokens.id = {row_id}): {session_token}")

    # 2) FETCH QUOTE TOKEN AND dxlink_url, THEN UPDATE Supabase
    print("⏳ Fetching quote token…")
    try:
        quote_token, quote_exp, dxlink_url = await get_api_quote_token(session_token)
    except Exception as e:
        print("❌ Exception in get_api_quote_token:", e)
        return
    print("✅ quote_token acquired:", quote_token)
    print("   quote_expiration (UTC):", quote_exp.isoformat())
    print("   dxlink_url:", dxlink_url)

    update_res = (
        supabase.table("user_tokens")
        .update({
            "quote_token": quote_token,
            "quote_token_expiration": quote_exp.isoformat()
        })
        .eq("id", row_id)
        .execute()
    )
    print("← Supabase update result for quote_token:", update_res)
    status = getattr(update_res, "status_code", None)
    if status and not (200 <= status < 300):
        print("❌ Failed to update quote_token:", update_res)
        return
    print(f"→ Updated user_tokens.id={row_id} with quote_token")

    # 3) RESOLVE STREAMER SYMBOLS FOR SPY
    print("⏳ Resolving streamer-symbols for SPY…")
    streamer_symbols = {}
    for sym in ["SPY"]:
        try:
            streamer_symbols[sym] = await get_streamer_symbol(session_token, sym)
        except Exception as e:
            print(f"❌ Error fetching streamer-symbol for {sym}:", e)
            return
    print("✅ streamer-symbols:", streamer_symbols)

    # 4) OPEN WEB SOCKET & START STREAM
    print(f"⏳ Opening WebSocket to {dxlink_url} …")
    async with websockets.connect(dxlink_url) as ws:
        print("✅ WebSocket connected")

        # 4a) SEND SETUP
        setup_msg = {
            "type": "SETUP",
            "channel": 0,
            "version": "0.1-PY/0.1.0",
            "keepaliveTimeout": 60,
            "acceptKeepaliveTimeout": 60
        }
        print("\n--- SENT (SETUP) ---")
        print(json.dumps(setup_msg, indent=2))
        await ws.send(json.dumps(setup_msg))

        # 4b) RECEIVE SETUP ACK
        raw = await ws.recv()
        print("\n--- RECEIVED (SETUP) ---")
        print(raw)

        # 4c) RECEIVE AUTH_STATE UNAUTHORIZED
        raw = await ws.recv()
        print("\n--- RECEIVED (AUTH_STATE UNAUTHORIZED) ---")
        print(raw)

        # 4d) SEND AUTH (with quote_token)
        auth_msg = {"type": "AUTH", "channel": 0, "token": quote_token}
        print("\n--- SENT (AUTH) ---")
        print(json.dumps(auth_msg, indent=2))
        await ws.send(json.dumps(auth_msg))

        # 4e) RECEIVE AUTH_STATE AUTHORIZED
        raw = await ws.recv()
        print("\n--- RECEIVED (AUTH_STATE AUTHORIZED) ---")
        print(raw)

        # 4f) SEND CHANNEL_REQUEST (channel=3, service=FEED)
        channel_request = {
            "type": "CHANNEL_REQUEST",
            "channel": 3,
            "service": "FEED",
            "parameters": {"contract": "AUTO"}
        }
        print("\n--- SENT (CHANNEL_REQUEST) ---")
        print(json.dumps(channel_request, indent=2))
        await ws.send(json.dumps(channel_request))

        # 4g) RECEIVE CHANNEL_OPENED
        raw = await ws.recv()
        print("\n--- RECEIVED (CHANNEL_OPENED) ---")
        print(raw)

        # 4h) SEND FEED_SETUP (compact, Quote only)
        feed_setup = {
            "type": "FEED_SETUP",
            "channel": 3,
            "acceptAggregationPeriod": 0.1,
            "acceptDataFormat": "COMPACT",
            "acceptEventFields": {
                "Quote": ["eventType", "eventSymbol", "bidPrice", "askPrice", "bidSize", "askSize"]
            }
        }
        print("\n--- SENT (FEED_SETUP) ---")
        print(json.dumps(feed_setup, indent=2))
        await ws.send(json.dumps(feed_setup))

        # 4i) RECEIVE FEED_CONFIG
        raw = await ws.recv()
        print("\n--- RECEIVED (FEED_CONFIG) ---")
        print(raw)

        # 4j) SEND FEED_SUBSCRIPTION (subscribe to SPY)
        subscription = {
            "type": "FEED_SUBSCRIPTION",
            "channel": 3,
            "add": [
                {"type": "Quote", "symbol": streamer_symbols["SPY"]},
            ]
        }
        print("\n--- SENT (FEED_SUBSCRIPTION) ---")
        print(json.dumps(subscription, indent=2))
        await ws.send(json.dumps(subscription))

        # 4k) RECEIVE FEED_DATA (first batch)
        raw = await ws.recv()
        print("\n--- RECEIVED (FEED_DATA) ---")
        print(raw)

        # Close connection
        await ws.close()
        print("\nWebSocket closed.")

if __name__ == "__main__":
    asyncio.run(main())