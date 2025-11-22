import os
import requests
from supabase import create_client, Client
from dotenv import load_dotenv

load_dotenv()

SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_KEY")
TASTY_LOGIN = os.getenv("TASTYTRADE_USERNAME")
TASTY_PASSWORD = os.getenv("TASTYTRADE_PASSWORD")

supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)
TASTY_API_URL = "https://api.tastyworks.com/sessions"

def regenerate_token():
    payload = {
        "login": TASTY_LOGIN,
        "password": TASTY_PASSWORD,
        "remember-me": True
    }

    headers = {"Content-Type": "application/json"}
    response = requests.post(TASTY_API_URL, json=payload, headers=headers)
    if response.status_code not in [200, 201]:
        raise Exception(f"Login failed: {response.status_code} - {response.text}")

    data = response.json()["data"]
    user = data["user"]

    supabase.table("tastytrade_sessions").insert({
        "email": user["email"],
        "username": user["username"],
        "external_id": user["external-id"],
        "session_token": data["session-token"],
        "remember_token": data["remember-token"],
        "session_expiration": data["session-expiration"]
    }).execute()
    print("✅ New session and remember-token saved to Supabase.")

if __name__ == "__main__":
    regenerate_token()