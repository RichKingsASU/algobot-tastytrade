import asyncio
import json
import os
import time
import datetime as dt

import aiohttp
import websockets
from supabase import create_client, Client

TT_BASE_URL = os.getenv("TT_BASE_URL", "https://api.tastytrade.com")
TT_AUTH_TOKEN = os.getenv("TT_AUTH_TOKEN")

SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_SERVICE_ROLE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY")

supabase: Client = create_client(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)


async def get_api_quote_token(session: aiohttp.ClientSession):
    """
    GET /api-quote-tokens using your Tastytrade auth token.
    """
    headers = {
        "Authorization": f"Bearer {TT_AUTH_TOKEN}",
        "Accept": "application/json",
    }

    async with session.get(f"{TT_BASE_URL}/api-quote-tokens", headers=headers) as resp:
        resp.raise_for_status()
        data = await resp.json()
        token = data["data"]["token"]
        dxlink_url = data["data"]["dxlink-url"]
        return token, dxlink_url


async def insert_candle(symbol: str, event: dict):
    """
    Insert a Candle event into ohlcv_1m.
    The exact field names depend on DXLink's Candle schema; adapt as needed.
    Typical DXFeed CandleEvent fields: eventTime, open, high, low, close, volume, etc.
    """
    # Example – adapt to actual Candle structure you receive
    ts_epoch_ms = event["eventTime"]       # or event["time"]
    ts = dt.datetime.utcfromtimestamp(ts_epoch_ms / 1000.0)

    record = {
        "symbol": symbol,
        "ts": ts.isoformat(),
        "open": event["open"],
        "high": event["high"],
        "low": event["low"],
        "close": event["close"],
        "volume": event.get("volume", 0),
        "day_volume": event.get("dayVolume"),
        "_source": "dxlink_candle",
    }

    supabase.table("ohlcv_1m").upsert(record).execute()


async def handle_feed_data(msg: dict):
    """
    Route FEED_DATA messages coming from DXLink.
    For COMPACT format, the payload is usually something like:
      ["Candle", [ <fields...> ]]
    You will need to map this according to DXLink's COMPACT schema.
    For simplicity, assume the server sends FULL Candle events as dicts.
    """
    channel = msg.get("channel")
    data = msg.get("data")

    # You'll need to adapt this part to how COMPACT data is actually structured.
    # This is a placeholder to show the logic flow.
    if not data:
        return

    event_type = data[0]

    if event_type == "Candle":
        # Example:
        # data[1] might be [eventType, eventSymbol, open, high, low, close, volume, ...]
        fields = data[1]
        event_symbol = fields[1]          # e.g. "SPY{=1m}"
        # Strip the candle suffix to get the base symbol:
        base_symbol = event_symbol.split("{")[0]

        candle_event = {
            "eventTime": int(time.time() * 1000),
            "open": fields[2],
            "high": fields[3],
            "low": fields[4],
            "close": fields[5],
            "volume": fields[6],
        }

        await insert_candle(base_symbol, candle_event)

    # You can add handlers for Trade, Quote, Summary, etc. here as needed.


async def dxlink_streamer():
    async with aiohttp.ClientSession() as session:
        api_quote_token, dxlink_url = await get_api_quote_token(session)
        print(f"Got DXLink token, connecting to {dxlink_url}")

        async with websockets.connect(dxlink_url, ping_interval=None) as ws:
            # 1) SETUP
            setup_msg = {
                "type": "SETUP",
                "channel": 0,
                "version": "0.1-DXF-PY/0.1.0",
                "keepaliveTimeout": 60,
                "acceptKeepaliveTimeout": 60,
            }
            await ws.send(json.dumps(setup_msg))

            # small helper to send keepalive on channel 0
            async def keepalive_loop():
                while True:
                    await asyncio.sleep(30)
                    await ws.send(json.dumps({"type": "KEEPALIVE", "channel": 0}))

            asyncio.create_task(keepalive_loop())

            # Wait for AUTH_STATE UNAUTHORIZED then AUTH
            authorized = False
            feed_channel = 3

            # We'll send SETUP/AUTH/CHANNEL_REQUEST/FEED_SETUP after we see AUTH_STATE
            # and then keep reading messages forever.
            async for raw in ws:
                msg = json.loads(raw)
                msg_type = msg.get("type")

                if msg_type == "AUTH_STATE" and msg.get("state") == "UNAUTHORIZED":
                    auth_msg = {
                        "type": "AUTH",
                        "channel": 0,
                        "token": api_quote_token,
                    }
                    await ws.send(json.dumps(auth_msg))

                elif msg_type == "AUTH_STATE" and msg.get("state") == "AUTHORIZED":
                    authorized = True
                    print("DXLink AUTHORIZED")

                    # 2) CHANNEL_REQUEST
                    channel_request = {
                        "type": "CHANNEL_REQUEST",
                        "channel": feed_channel,
                        "service": "FEED",
                        "parameters": {"contract": "AUTO"},
                    }
                    await ws.send(json.dumps(channel_request))

                elif msg_type == "CHANNEL_OPENED" and msg.get("channel") == feed_channel:
                    # 3) FEED_SETUP – COMPACT format
                    feed_setup = {
                        "type": "FEED_SETUP",
                        "channel": feed_channel,
                        "acceptAggregationPeriod": 0.1,
                        "acceptDataFormat": "COMPACT",
                        "acceptEventFields": {
                            "Trade": [
                                "eventType",
                                "eventSymbol",
                                "price",
                                "dayVolume",
                                "size",
                            ],
                            "Quote": [
                                "eventType",
                                "eventSymbol",
                                "bidPrice",
                                "askPrice",
                                "bidSize",
                                "askSize",
                            ],
                            "Summary": [
                                "eventType",
                                "eventSymbol",
                                "dayOpenPrice",
                                "dayHighPrice",
                                "dayLowPrice",
                                "prevDayClosePrice",
                            ],
                            # Add Candle fields according to DXLink docs
                            "Candle": [
                                "eventType",
                                "eventSymbol",
                                "open",
                                "high",
                                "low",
                                "close",
                                "volume",
                                "dayVolume",
                            ],
                        },
                    }
                    await ws.send(json.dumps(feed_setup))

                    # 4) FEED_SUBSCRIPTION – Trade/Quote/Summary + Candle
                    now_sec = int(time.time())
                    from_24h = now_sec - 24 * 60 * 60

                    subscription = {
                        "type": "FEED_SUBSCRIPTION",
                        "channel": feed_channel,
                        "reset": True,
                        "add": [
                            # SPY real-time Trade/Quote/Summary
                            {"type": "Trade", "symbol": "SPY"},
                            {"type": "Quote", "symbol": "SPY"},
                            {"type": "Summary", "symbol": "SPY"},

                            # SPY – 1m candles for last 24h
                            {
                                "type": "Candle",
                                "symbol": "SPY{=1m}",
                                "fromTime": from_24h,
                            },

                            # IWM, same pattern
                            {"type": "Trade", "symbol": "IWM"},
                            {"type": "Quote", "symbol": "IWM"},
                            {"type": "Summary", "symbol": "IWM"},
                            {
                                "type": "Candle",
                                "symbol": "IWM{=1m}",
                                "fromTime": from_24h,
                            },
                        ],
                    }
                    await ws.send(json.dumps(subscription))

                elif msg_type == "FEED_DATA":
                    await handle_feed_data(msg)

                # You can log other messages for debugging (FEED_CONFIG, etc.)
                else:
                    # print("DXLink:", msg)
                    pass


if __name__ == "__main__":
    asyncio.run(dxlink_streamer())