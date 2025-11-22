import os
import requests
from supabase import create_client, Client
from dotenv import load_dotenv

load_dotenv()

SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_KEY")
TASTY_LOGIN = os.getenv("TASTYTRADE_USERNAME")

supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)
TASTY_API_URL = "https://api.cert.tastyworks.com/sessions"

def get_latest_tokens():
    response = supabase.table("tastytrade_sessions").select("*").order("created_at", desc=True).limit(1).execute()
    items = response.data
    return items[0] if items else None

def create_session_with_remember_token(remember_token):
    payload = {
        "login": TASTY_LOGIN,
        "remember-token": remember_token,
        "remember-me": True
    }

    headers = {"Content-Type": "application/json"}
    response = requests.post(TASTY_API_URL, json=payload, headers=headers)

    if response.status_code not in [200, 201]:
        raise Exception(f"❌ Login failed: {response.status_code} - {response.text}")

    data = response.json()["data"]
    return {
        "session_token": data["session-token"],
        "remember_token": data["remember-token"],
        "session_expiration": data["session-expiration"]
    }

def store_session(tokens):
    last = get_latest_tokens()
    supabase.table("tastytrade_sessions").insert({
        "email": os.getenv("TASTYTRADE_USERNAME"),
        "username": last.get("username") if last else "unknown",
        "external_id": last.get("external_id") if last else None,
        "session_token": tokens["session_token"],
        "remember_token": tokens["remember_token"],
        "session_expiration": tokens["session_expiration"]
    }).execute()
    print("✅ Session updated in Supabase.")

def get_valid_session_token():
    last = get_latest_tokens()
    if not last:
        raise Exception("❌ No remember-token found. Please log in manually once.")
    new_tokens = create_session_with_remember_token(last["remember_token"])
    store_session(new_tokens)
    return new_tokens["session_token"]

if __name__ == "__main__":
    try:
        token = get_valid_session_token()
        print(f"Successfully retrieved session token: {token[:10]}...")
    except Exception as e:
        print(e)
