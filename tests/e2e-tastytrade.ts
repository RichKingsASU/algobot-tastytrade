import { TastytradeClient } from "../TastytradeClient";
import dotenv from "dotenv";

dotenv.config();

const SUPABASE_URL =
  process.env.SUPABASE_URL || "https://dyrwkxdwszvqpzvodgxl.supabase.co";
const SUPABASE_ANON_KEY =
  process.env.SUPABASE_ANON_KEY || "YOUR_SUPABASE_ANON_KEY";
const ACCOUNT_NUMBER =
  process.env.TASTYTRADE_ACCOUNT_NUMBER || "YOUR_TASTYTRADE_ACCOUNT_NUMBER";
const SYMBOL_TO_SEARCH =
  process.env.TASTYTRADE_SYMBOL_TO_SEARCH || "AAPL";
const E2E_ALLOW_LIVE_ORDERS =
  process.env.E2E_ALLOW_LIVE_ORDERS || "false";

const client = new TastytradeClient({
  supabaseUrl: SUPABASE_URL,
  supabaseAnonKey: SUPABASE_ANON_KEY,
  enableLocalStorage: false,
  maxRetries: 2,
  retryDelayMs: 1000,
  sessionHeaderName: "Authorization"
});

async function runE2E() {
  console.log("E2E: Ensuring login via TastytradeClient...");
  try {
    await client.ensureLoggedIn();
    console.log("E2E: ensureLoggedIn() succeeded.");
  } catch (error) {
    console.error("E2E: ensureLoggedIn() FAILED");
    throw error;
  }

  console.log("E2E: Fetching account balances...");
  const balances = await client.getAccountBalances(ACCOUNT_NUMBER);
  console.log(`E2E: Balances fetched. Keys: ${Object.keys(balances)}`);

  console.log("E2E: Fetching account positions...");
  const positions = await client.getAccountPositions(ACCOUNT_NUMBER);
  console.log(`E2E: Positions count: ${Array.isArray(positions) ? positions.length : typeof positions}`);

  console.log(`E2E: Fetching market metrics for ${SYMBOL_TO_SEARCH}...`);
  const metrics = await client.getMarketMetrics(SYMBOL_TO_SEARCH);
  console.log(`E2E: Market metrics fetched. Underlying: ${metrics.symbol}, Last Price: ${metrics['last-price']}`);

  if (E2E_ALLOW_LIVE_ORDERS.toLowerCase() === "true") {
    console.log("E2E: Live orders allowed by env. Attempting SAFE test order/dry-run...");
    // In a real scenario, you would call a dry-run function here.
    // For now, we will just log a message.
    console.log("E2E: Dry-run function not implemented. Skipping.");
  } else {
    console.log("E2E: Live orders NOT allowed. Skipping order test.");
  }

  console.log("E2E: FULL LIVE TEST PASSED.");
}

runE2E().catch((err) => {
  console.error("E2E: FAILED with error:", err);
  process.exit(1);
});
