// supabase/functions/login_session/index.ts
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

serve(async (_req: Request) => {
  try {
    const BASE =
      Deno.env.get("TASTYTRADE_BASE_URL") ??
      Deno.env.get("TASTYTRADE_PROD_URL");
    const USER =
      Deno.env.get("TASTYTRADE_USERNAME") ??
      Deno.env.get("TASTYTRADE_PROD_USERNAME");
    const PASS =
      Deno.env.get("TASTYTRADE_PASSWORD") ??
      Deno.env.get("TASTYTRADE_PROD_PASSWORD");

    if (!BASE || !USER || !PASS) {
      return new Response(
        JSON.stringify({
          error: "Missing TASTYTRADE_* env vars for login_session.",
        }),
        { status: 500, headers: { "Content-Type": "application/json" } },
      );
    }

    const resp = await fetch(`${BASE}/sessions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify({
        login: USER,
        password: PASS,
        "remember-me": true,
      }),
    });

    const text = await resp.text();
    return new Response(text, {
      status: resp.status,
      headers: {
        "Content-Type": resp.headers.get("Content-Type") ?? "application/json",
      },
    });
  } catch (err) {
    return new Response(
      JSON.stringify({ error: "login_session error", details: String(err) }),
      { status: 500, headers: { "Content-Type": "application/json" } },
    );
  }
});