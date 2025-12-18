// GET /functions/v1/datafeed/history?symbol=XXX&resolution=YYY&from=…&to=…
import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders: HeadersInit = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
const SUPABASE_KEY =
  Deno.env.get("SUPABASE_ANON_KEY") ?? Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

if (!SUPABASE_URL || !SUPABASE_KEY) {
  throw new Error(
    "Missing SUPABASE_URL and/or SUPABASE_ANON_KEY|SUPABASE_SERVICE_ROLE_KEY",
  );
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

type HistoricalBarRow = {
  ts: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
};

serve(async (req) => {
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
    const resolution = url.searchParams.get("resolution");
    const from = Number(url.searchParams.get("from"));
    const to = Number(url.searchParams.get("to"));

    if (!symbol || !resolution || isNaN(from) || isNaN(to)) {
      return new Response(
        JSON.stringify({ error: "Missing or invalid parameters" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }
    if (from <= 0 || to <= 0 || to <= from) {
      return new Response(JSON.stringify({ error: "Invalid time range" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // TODO: Query your historical bars table, filter by symbol & resolution & timestamp
    const { data, error } = await supabase
      .from("historical_bars")
      .select("ts, open, high, low, close, volume")
      .eq("symbol", symbol)
      .eq("resolution", resolution)
      .gte("ts", new Date(from * 1000).toISOString())
      .lte("ts", new Date(to * 1000).toISOString())
      .order("ts", { ascending: true })
      .limit(10_000);

    if (error) throw error;

    const rows = (data ?? []) as HistoricalBarRow[];
    const bars = rows.map((r) => ({
      time: Math.floor(new Date(r.ts).getTime() / 1000),
      open: r.open,
      high: r.high,
      low: r.low,
      close: r.close,
      volume: r.volume,
    }));

    return new Response(JSON.stringify({ s: "ok", bars }), {
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
