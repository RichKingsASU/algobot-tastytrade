# ARCHITECTURE.md

## 1. Overview  
This document describes the high-level architecture of the *Algorithmic Trading Platform* built with:  
- Frontend: **Lovable** (Vite + React)  
- Backend: **Supabase** (Postgres + Auth + Edge Functions)  
- Charting: TradingView Charting Library  
- Brokerage & data: Tastytrade (REST + DXLink streaming)  

The system will be production-grade, GitHub-ready, supporting sandbox/live modes, real-time data streaming, user-selectable tickers, strategy engine, backtesting, and eventual broker execution.

## 2. Tri-Modal Architecture  
### 2.1 Frontend (Stateless)  
- Runs in browser (Vite/React).  
- Handles UI: symbol selector, mode toggle (sandbox/live), chart display, order ticket, strategy builder.  
- Uses Supabase Auth and Realtime subscriptions for streaming UI state updates.  
- Embeds TradingView Charting Library with custom Datafeed and Broker modules.

### 2.2 Serverless Backend (Stateless)  
- Supabase Postgres for persistent storage (users, strategies, orders, backtests).  
- Supabase Edge Functions act as API layer:  
  - Strategy creation & persistence  
  - Backtesting job submission  
  - REST trade placement (sandbox/live) with Tastytrade  
  - HTTP datafeed endpoints for charting (history, symbol info, quotes)  
  - Authentication, business-logic, risk checks  
- Supabase Realtime channels push internal system state changes (e.g., order filled, backtest complete) to frontend.

### 2.3 Streaming Service (Stateful)  
- A dedicated Node.js container/service (e.g., via Docker + Fly.io/Railway) to manage long-lived WebSocket connections to Tastytrade’s DXLink.  
- Responsibilities:  
  - Authenticate and maintain the upstream DXLink WebSocket.  
  - Handle subscribe/unsubscribe messages and multiplex subscriptions across many frontend clients.  
  - Broadcast high-frequency market data (ticks, quotes) to frontend via WebSocket or via writing to `realtime_quotes` table in Supabase.  
- This separation is required because Supabase Edge Functions cannot maintain persistent connections.

## 3. High-Level System Diagram  

[User Browser]
↕     (UI interactions)
[Frontend (Lovable)]
↕     (REST & Realtime)
[Supabase Backend]  ↔  [Streaming Service]
↘_______________________________↙
(DXLink WebSocket ↔ Tastytrade)

## 4. Core Database Schema  
Outlined are the key tables/relations:

- **profiles** — user metadata (mirrors auth.users)  
- **brokerage_credentials** — stores encrypted API keys for broker connections  
- **user_watchlists** — tracks symbols watched by each user  
- **strategies** — user-defined strategy logic (JSONB for entry/exit rule)  
- **backtests** — queuing and status of backtesting jobs  
- **backtest_results** — results and logs for completed backtests  
- **orders** — manual or strategy-initiated trades (both sandbox & live)  
- **executions** — fills (real or simulated) for orders; triggers UI markers on chart  

## 5. Dataflow by Use Case  
### 5.1 Charting & Real-Time Data  
1. Frontend selects symbol → Datafeed adapter calls `/datafeed/history`, `/datafeed/symbol_info`.  
2. Streaming Service receives tick data from DXLink, writes to `realtime_quotes`.  
3. Frontend subscribes to changes, feeds new bar or tick via Charting Library `subscribeBars()`.

### 5.2 Strategy Backtesting  
1. User submits strategy → Edge Function creates `backtests` row (status “pending”).  
2. Background job fetches historical data (via Alpaca or broker), executes logic, stores results in `backtest_results`, updates `backtests` to “completed”.  
3. Supabase Realtime broadcasts status change; frontend displays results.

### 5.3 (Future) Trade Execution  
1. Frontend initiates trade (sandbox/live) → Edge Function validates, sends to Tastytrade REST endpoint.  
2. `orders` entry created; as fills arrive (via webhook or polling) `executions` rows inserted.  
3. Frontend gets realtime UI update via Realtime channel; chart displays execution markers.

## 6. Layers & Boundaries  
- Frontend ↔ Backend: REST + Realtime (via Supabase)  
- Backend ↔ Broker Data: REST (for orders) + Streaming Service (for market data)  
- Streaming Service ↔ Broker: State-ful WebSocket DXLink  
- Backend ↔ Database: Persistent storage of state; Realtime triggers for UI updates  

## 7. CI/CD & Deployment Strategy  
- **Frontend**: On push to `main` (or `staging`), build with Vite and deploy to Vercel/Netlify.  
- **Backend**: On push to `main`, run migrations (`supabase db push`), deploy Edge Functions.  
- **Streaming Service**: Build Docker image, deploy to Fly.io/Railway on changes; ensure environment secrets managed via GitHub Secrets.  
- Two-project standard: `staging` and `production` environments for Supabase and streaming service.

## 8. Current Status vs Roadmap  
| Component                    | Status        | Notes                                     |
|-----------------------------|---------------|-------------------------------------------|
| Supabase schema & config     | ✅ Complete    | Migration run, remote DB updated          |
| Frontend scaffold             | ✅ Done        | UI and file structure in place            |
| Datafeed endpoints            | 🔧 In Progress | Stubbed endpoints ready for wiring        |
| Streaming service             | ⏳ Pending     | Not yet implemented; required for live    |
| Strategy / Backtesting engine | 🔧 In Progress | Schema defined; execution logic next      |
| Broker execution flow         | ⏳ Pending     | Waiting for sandbox credentials           |
| CI/CD pipelines               | 🔧 In Progress | Supabase linking done; GitHub Integration pending |

## 9. Glossary  
- **Sandbox**: A simulated trading environment used for testing (no real money).  
- **Live**: Production trading mode with real brokerage execution.  
- **DXLink**: Tastytrade’s high-frequency WebSocket feed for market data.  
- **Dual-Channel Model**: Market Data Channel (ticks) + System State Channel (orders/executions) feeding the UI.
