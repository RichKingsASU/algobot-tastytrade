import { TastytradeClient } from "../TastytradeClient";

const log = (name: string, condition: boolean) => {
  console.log(`[${condition ? "PASS" : "FAIL"}] ${name}`);
};

console.log("--- Testing TastytradeClient ---");

let authorizationHeader = "";
let loginCalled = false;
let retryCount = 0;

const mockFetch = (url: string, options: any): Promise<Response> => {
  if (url.includes("/functions/v1/login_session")) {
    loginCalled = true;
    return Promise.resolve(new Response(JSON.stringify({ "session-token": "FAKE_SESSION_TOKEN", "expires-at": new Date(Date.now() + 10000).toISOString() }), { status: 200, headers: { 'Content-Type': 'application/json' } }));
  }

  if (options.headers) {
    const headers = new Headers(options.headers);
    console.log("Authorization header in mockFetch:", headers.get("Authorization"));
    authorizationHeader = headers.get("Authorization") || "";
  }

  if (retryCount < 1) {
    retryCount++;
    return Promise.resolve(new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 }));
  }

  return Promise.resolve(new Response(JSON.stringify({ ok: true, functionName: url.split("/").pop(), retried: retryCount > 0 }), { status: 200, headers: { 'Content-Type': 'application/json' } }));
};

(globalThis as any).fetch = mockFetch;

const client = new TastytradeClient({
  supabaseUrl: "https://dyrwkxdwszvqpzvodgxl.supabase.co",
  supabaseAnonKey: "TEST_KEY",
  enableLocalStorage: false,
  sessionHeaderName: "Authorization",
  maxRetries: 2,
  retryDelayMs: 0,
});

async function runTests() {
  // Test case a) ensureLoggedIn() obtains a token
  await client.ensureLoggedIn();
  log("ensureLoggedIn obtains token", loginCalled);

  // Test case b) callTastytradeFunction header injection
  await client.callTastytradeFunction("get_account_balances", {
    method: "GET",
    params: { account_number: "12345" },
    requireAuth: true,
  });
  log("Authorization header set", authorizationHeader === "FAKE_SESSION_TOKEN");

  // Test case c) 401 retry logic
  retryCount = 0;
  const result: any = await client.callTastytradeFunction("get_account_balances", {
    method: "GET",
    params: { account_number: "12345" },
    requireAuth: true,
  });
  log("401 retry works", result.retried === true);
}

runTests();