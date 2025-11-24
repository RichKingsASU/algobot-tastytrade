import { TastytradeClient } from "./TastytradeClient";
import * as dotenv from "dotenv";

dotenv.config();

const SUPABASE_URL =
  process.env.SUPABASE_URL || "https://dyrwkxdwszvqpzvodgxl.supabase.co";
const SUPABASE_ANON_KEY =
  process.env.SUPABASE_ANON_KEY || "YOUR_SUPABASE_ANON_KEY";
const ACCOUNT_NUMBER =
  process.env.TASTYTRADE_ACCOUNT_NUMBER || "YOUR_TASTYTRADE_ACCOUNT_NUMBER";
const SYMBOL_TO_SEARCH =
  process.env.TASTYTRADE_SYMBOL_TO_SEARCH || "AAPL";

const client = new TastytradeClient({
  supabaseUrl: SUPABASE_URL,
  supabaseAnonKey: SUPABASE_ANON_KEY,
  enableLocalStorage: false,
  maxRetries: 2,
  retryDelayMs: 2000,
});

async function runStrategyEngine() {
  try {
    console.log("Strategy Engine: Ensuring login...");
    await client.ensureLoggedIn();
    console.log("Strategy Engine: Successfully logged in/refreshed token.");

    console.log(`Fetching market metrics for ${SYMBOL_TO_SEARCH}...`);
    const marketMetrics = await client.getMarketMetrics(SYMBOL_TO_SEARCH);
    console.log(JSON.stringify(marketMetrics, null, 2));

    console.log(`Fetching account balances for ${ACCOUNT_NUMBER}...`);
    const balances = await client.getAccountBalances(ACCOUNT_NUMBER);
    console.log(JSON.stringify(balances, null, 2));

    // This is a simulated example and must be adapted before real trading.
    console.log("Simulating order submission...");
    const orderBody = {
      "time-in-force": "Day",
      "order-type": "Limit",
      "price": "150.00",
      "legs": [
        {
          "instrument-type": "Equity",
          "symbol": "MSFT",
          "quantity": 1,
          "action": "Buy to Open"
        }
      ]
    };
    const orderResponse = await client.postAccountOrders(ACCOUNT_NUMBER, orderBody);
    console.log(JSON.stringify(orderResponse, null, 2));

  } catch (error) {
    console.error("Strategy Engine Error:", error.message);
  }
}

runStrategyEngine();

/*
Example .env content:

SUPABASE_URL="https://dyrwkxdwszvqpzvodgxl.supabase.co"
SUPABASE_ANON_KEY="YOUR_SUPABASE_ANON_KEY"
TASTYTRADE_ACCOUNT_NUMBER="YOUR_TASTYTRADE_ACCOUNT_NUMBER"
TASTYTRADE_SYMBOL_TO_SEARCH="AAPL"
TASTYTRADE_BASE_URL="https://api.tastytrade.com"
TASTYTRADE_USERNAME="YOUR_TASTYTRADE_USERNAME"
TASTYTRADE_PASSWORD="YOUR_TASTYTRADE_PASSWORD"

How to install:
npm install dotenv typescript @types/node

How to compile and run:
npx tsc strategy-engine-example.ts
node strategy-engine-example.js
*/