// supabase/functions/datafeed-symbolinfo/index.ts

import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("CUSTOM_SUPABASE_URL")!;
const SERVICE_KEY  = Deno.env.get("CUSTOM_SERVICE_KEY")!;

const supabase = createClient(SUPABASE_URL, SERVICE_KEY);

serve(async (req) => {
  try {
    const url = new URL(req.url);
    const symbol = url.searchParams.get("symbol");
    if (!symbol) {
      return new Response(JSON.stringify({ error: "Missing symbol parameter" }), { status: 400 });
    }

    // Fetch symbol details if you maintain a table of symbols
    const { data, error } = await supabase
      .from("symbols")             // assume you have a 'symbols' table
      .select("*")
      .eq("symbol", symbol)
      .single();

    if (error) {
      throw error;
    }

    const symbolInfo = {
      ticker: symbol,
      name: data?.name ?? symbol,
      description: data?.description ?? "",
      type: data?.type ?? "stock",
      session: "24x7",
      timezone: data?.timezone ?? "Etc/UTC",
      exchange: data?.exchange ?? "",
      minmov: 1,
      pricescale: data?.pricescale ?? 100,
      has_intraday: true,
      has_weekly_and_monthly: false,
      supported_resolutions: data?.supported_resolutions ?? ["1", "5", "15", "60", "1D", "1W"],
      volume_precision: 2,
      data_status: "streaming",
    };

    return new Response(JSON.stringify(symbolInfo), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });

  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), { status: 500 });
  }
});