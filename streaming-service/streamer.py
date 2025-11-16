import asyncio
import json
import os
import time
import datetime as dt

import aiohttp
import websockets
from supabase import create_client, Client
from dotenv import load_dotenv

load_dotenv()

TT_BASE_URL = os.getenv("TT_BASE_URL", "https://api.tastytrade.com")
TT_AUTH_TOKEN = os.getenv("TT_AUTH_TOKEN")

SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_SERVICE_ROLE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY")

supabase: Client = create_client(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)


async def get_api_quote_token(session: aiohttp.ClientSession):
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


async def upsert_candle(symbol: str, ts: dt.datetime, open_, high, low, close, volume, day_volume=None):
    record = {
        "symbol": symbol,
        "ts": ts.isoformat(),
        "open": float(open_),
        "high": float(high),
        "low": float(low),
        "close": float(close),
        "volume": float(volume),
        "day_volume": float(day_volume) if day_volume is not None else None,
        "_source": "dxlink_candle",
    }
    supabase.table("ohlcv_1m").upsert(record).execute()


async def handle_candle_compact(payload):
    """
    Handle COMPACT Candle from FEED_DATA.
    'payload' will look something like:
        ["Candle", [...field values...]]
    Exact index mapping depends on DxLink's COMPACT schema.
    We'll assume:
        [0] eventType = "Candle"
        [1] eventSymbol = "SPY{=1m}"
        [2] eventTime (ms or sec)
        [3] open
        [4] high
        [5] low
        [6] close
        [7] volume
        [8] dayVolume (optional)
    Adjust these indices once you inspect real FEED_DATA messages.
    """
    fields = payload[1]
    event_symbol = fields[1]
    base_symbol = event_symbol.split("{")[0]

    # eventTime might be ms or seconds; here assume ms
    event_time_raw = fields[2]
    if event_time_raw > 10**12:  # crude check: ms vs sec
        ts = dt.datetime.utcfromtimestamp(event_time_raw / 1000.0)
    else:
        ts = dt.datetime.utcfromtimestamp(event_time_raw)

    open_ = fields[3]
    high = fields[4]
    low = fields[5]
    close = fields[6]
    volume = fields[7]
    day_volume = fields[8] if len(fields) > 8 else None

    await upsert_candle(base_symbol, ts, open_, high, low, close, volume, day_volume)


async def handle_feed_data(msg: dict):
    """
    FEED_DATA message:
    {
      "type": "FEED_DATA",
      "channel": 3,
      "data": [...multiple events in COMPACT format...]
    }
    Often looks like:
      "data": ["Candle", [..]]
    or for multiple events:
      "data": ["Candle", [..], "Trade", [..], ...]
    """
    data = msg.get("data")
    if not data:
        return

    # data is usually a flat list: [type1, fields1, type2, fields2, ...]
    # Walk in steps of 2
    if isinstance(data, list) and len(data) >= 2 and isinstance(data[0], str):
        i = 0
        while i < len(data) - 1:
            event_type = data[i]
            fields_block = data[i + 1]
            payload = [event_type, fields_block]

            if event_type == "Candle":
                await handle_candle_compact(payload)
            else:
                # you can add handlers for "Trade", "Quote", "Summary" here if needed
                pass

            i += 2
    else:
        # unexpected structure – useful to log during first tests
        # print("Unexpected FEED_DATA structure:", data)
        return


async def dxlink_streamer():
    async with aiohttp.ClientSession() as session:
        api_quote_token, dxlink_url = await get_api_quote_token(session)
        print(f"Got DXLink token, connecting to {dxlink_url}")

        async with websockets.connect(dxlink_url, ping_interval=None) as ws:
            # SETUP
            setup_msg = {
                "type": "SETUP",
                "channel": 0,
                "version": "0.1-DXF-PY/0.1.0",
                "keepaliveTimeout": 60,
                "acceptKeepaliveTimeout": 60,
            }
            await ws.send(json.dumps(setup_msg))

            async def keepalive_loop():
                while True:
                    await asyncio.sleep(30)
                    await ws.send(json.dumps({"type": "KEEPALIVE", "channel": 0}))

            asyncio.create_task(keepalive_loop())

            feed_channel = 3

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
                    print("DXLink AUTHORIZED")

                    channel_request = {
                        "type": "CHANNEL_REQUEST",
                        "channel": feed_channel,
                        "service": "FEED",
                        "parameters": {"contract": "AUTO"},
                    }
                    await ws.send(json.dumps(channel_request))

                elif msg_type == "CHANNEL_OPENED" and msg.get("channel") == feed_channel:
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
                            "Candle": [
                                "eventType",
                                "eventSymbol",
                                "eventTime",
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

                    now_sec = int(time.time())
                    from_24h = now_sec - 24 * 60 * 60

                    subscription = {
                        "type": "FEED_SUBSCRIPTION",
                        "channel": feed_channel,
                        "reset": True,
                        "add": [
                            # SPY
                            {"type": "Trade", "symbol": "SPY"},
                            {"type": "Quote", "symbol": "SPY"},
                            {"type": "Summary", "symbol": "SPY"},
                            {"type": "Candle", "symbol": "SPY{=1m}", "fromTime": from_24h},

                            # IWM
                            {"type": "Trade", "symbol": "IWM"},
                            {"type": "Quote", "symbol": "IWM"},
                            {"type": "Summary", "symbol": "IWM"},
                            {"type": "Candle", "symbol": "IWM{=1m}", "fromTime": from_24h},
                        ],
                    }
                    await ws.send(json.dumps(subscription))

                elif msg_type == "FEED_DATA":
                    await handle_feed_data(msg)

                else:
                    # You can log other message types while debugging
                    # print("DXLink:", msg)
                    pass


if __name__ == "__main__":
    asyncio.run(dxlink_streamer())
