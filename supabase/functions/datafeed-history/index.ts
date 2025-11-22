// GET /functions/v1/datafeed/history?symbol=XXX&resolution=YYY&from=…&to=…
import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("CUSTOM_SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("CUSTOM_SERVICE_KEY")!;
const supabase = createClient(SUPABASE_URL, SERVICE_KEY);

serve(async (req) => {
  try {
    const url = new URL(req.url);
    const symbol = url.searchParams.get("symbol");
    const resolution = url.searchParams.get("resolution");
    const from = Number(url.searchParams.get("from"));
    const to = Number(url.searchParams.get("to"));

    if (!symbol || !resolution || isNaN(from) || isNaN(to)) {
      return new Response(JSON.stringify({ error: "Missing or invalid parameters" }), { status: 400 });
    }

    // TODO: Query your historical bars table, filter by symbol & resolution & timestamp
    const { data, error } = await supabase
      .from("historical_bars")
      .select("ts, open, high, low, close, volume")
      .eq("symbol", symbol)
      .eq("resolution", resolution)
      .gte("ts", new Date(from * 1000).toISOString())
      .lte("ts", new Date(to * 1000).toISOString())
      .order("ts", { ascending: true });

    if (error) throw error;

    const bars = data.map((r: any) => ({
      time: Math.floor(new Date(r.ts).getTime() / 1000),
      open: r.open,
      high: r.high,
      low: r.low,
      close: r.close,
      volume: r.volume,
    }));

    return new Response(JSON.stringify({ s: "ok", bars }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error(e);
    return new Response(JSON.stringify({ error: "Internal server error" }), { status: 500 });
  }
});
