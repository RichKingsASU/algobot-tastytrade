# audit_agent.py

import psycopg2
from pathlib import Path
import os

REPO_PATH = Path(".")
PG_URI = os.getenv("SUPABASE_PG_URI")  # Set your Supabase Postgres URI

def check_code_usage(term: str):
    return any(term in f.read_text(errors="ignore") for f in REPO_PATH.rglob("*.py"))

def audit_supabase():
    conn = psycopg2.connect(PG_URI)
    cur = conn.cursor()

    print("🔍 Checking extensions...")
    cur.execute("SELECT extname FROM pg_extension;")
    extensions = {row[0] for row in cur.fetchall()}
    print("    Installed:", extensions)
    for ext in ["pg_partman", "pg_cron"]:
        print(f"    ✅ {ext}" if ext in extensions else f"    ❌ {ext} not installed")

    print("🔍 Checking table partitioning...")
    for table in ["market_candles", "market_ticks"]:
        cur.execute(f"""
            SELECT relname, relkind 
            FROM pg_class 
            WHERE relname = '{table}' AND relkind = 'p';
        """)
        result = cur.fetchone()
        print(f"    ✅ {table} is partitioned" if result else f"    ❌ {table} not partitioned")

    print("🔍 Checking BRIN indexes...")
    cur.execute("""
        SELECT indexname FROM pg_indexes 
        WHERE indexdef LIKE '%USING brin%' 
        AND tablename IN ('market_candles', 'market_ticks');
    """)
    brin_indexes = cur.fetchall()
    print("    ✅ Found BRIN index" if brin_indexes else "    ❌ No BRIN index found")

    print("🔍 Checking RLS on strategy_configurations...")
    cur.execute("""
        SELECT relrowsecurity 
        FROM pg_class WHERE relname = 'strategy_configurations';
    """)
    rls = cur.fetchone()
    print("    ✅ RLS enabled" if rls and rls[0] else "    ❌ RLS not enabled")

    cur.close()
    conn.close()

def audit_repo_code():
    print("🔍 Auditing codebase usage patterns...")
    checks = {
        "Hexital": check_code_usage("hexital"),
        "DXLinkStreamer": check_code_usage("DXLinkStreamer"),
        "fetch_historical": check_code_usage("fetch_historical"),
        "supabase": check_code_usage("supabase"),
        "last_heartbeat": check_code_usage("last_heartbeat")
    }
    for k, v in checks.items():
        print(f"    ✅ {k}" if v else f"    ❌ {k} not detected")

if __name__ == "__main__":
    print("🔧 Starting audit...\n")
    audit_supabase()
    print()
    audit_repo_code()
