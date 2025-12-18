// GET /functions/v1/datafeed/symbol_info?symbol=XXX
import { serve } from "https://deno.land/std@0.177.0/http/server.ts";

const corsHeaders: HeadersInit = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
};

serve((req) => {
  try {
    if (req.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: corsHeaders });
    }
    if (req.method !== "GET") {
      return new Response(JSON.stringify({ error: "Method not allowed" }), {
        status: 405,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const url = new URL(req.url);
    const symbol = url.searchParams.get("symbol");
    if (!symbol) {
      return new Response(JSON.stringify({ error: "Missing symbol" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
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
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error(e);
    return new Response(JSON.stringify({ error: "Internal server error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
