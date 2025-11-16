// GET /functions/v1/datafeed/symbol_info?symbol=XXX
import { serve } from "https://deno.land/std@0.177.0/http/server.ts";

serve(async (req) => {
  try {
    const url = new URL(req.url);
    const symbol = url.searchParams.get("symbol");
    if (!symbol) {
      return new Response(JSON.stringify({ error: "Missing symbol" }), { status: 400 });
    }

    // TODO: Map your symbol to TradingView symbol metadata
    const symbolInfo = {
      name: symbol,
      ticker: symbol,
      description: `${symbol} description`,
      type: "stock",
      session: "0930-1600",
      timezone: "America/New_York",
      exchange: "NYSE",
      minmov: 1,
      pricescale: 100,
      has_intraday: true,
      supported_resolutions: ["1", "5", "15", "60", "D"],
      has_weekly_and_monthly: true,
    };

    return new Response(JSON.stringify({ s: "ok", symbolInfo }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error(e);
    return new Response(JSON.stringify({ error: "Internal server error" }), { status: 500 });
  }
});
