"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.TastytradeClient = void 0;
// TastytradeClient.ts
const TastytradeTokenManager_1 = require("./TastytradeTokenManager");
const DEFAULT_SUPABASE_URL = "https://dyrwkxdwszvqpzvodgxl.supabase.co";
const DEFAULT_FUNCTIONS_URL = `${DEFAULT_SUPABASE_URL}/functions/v1`;
class TastytradeClient {
    constructor(options) {
        this.supabaseUrl = options?.supabaseUrl || DEFAULT_SUPABASE_URL;
        this.functionsUrl = options?.functionsUrl || `${this.supabaseUrl}/functions/v1`;
        this.supabaseAnonKey = options?.supabaseAnonKey;
        this.sessionHeaderName = options?.sessionHeaderName || "Authorization";
        this.tokenManager = new TastytradeTokenManager_1.TastytradeTokenManager(options?.enableLocalStorage);
        this.maxRetries = options?.maxRetries ?? 1;
        this.retryDelayMs = options?.retryDelayMs ?? 1000;
    }
    async loginWithSupabase() {
        const response = await this.fetchFromSupabase("login_session", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
        });
        if (!response.ok) {
            throw new Error(`Login failed: ${response.status} ${response.statusText}`);
        }
        const data = await response.json();
        const token = data?.data?.["session-token"] || data?.["session-token"] || data?.token;
        if (!token) {
            throw new Error("No session token found in login response");
        }
        const expiresIn = data?.data?.["remember-me-token-expires-in-seconds"] || data?.["remember-me-token-expires-in-seconds"];
        const expiresAt = expiresIn ? Date.now() + expiresIn * 1000 : undefined;
        this.tokenManager.setSession({ token, expiresAt });
        return token;
    }
    async ensureLoggedIn() {
        const existingToken = this.tokenManager.getToken();
        if (existingToken && this.tokenManager.isValid()) {
            return existingToken;
        }
        return this.loginWithSupabase();
    }
    async fetchFromSupabase(functionName, init) {
        const url = new URL(`${this.functionsUrl}/${functionName}`);
        if (init.params) {
            for (const [key, value] of Object.entries(init.params)) {
                if (value !== undefined) {
                    url.searchParams.set(key, String(value));
                }
            }
        }
        const headers = new Headers(init.headers || {});
        if (this.supabaseAnonKey) {
            headers.set("apikey", this.supabaseAnonKey);
        }
        return fetch(url.toString(), { ...init, headers });
    }
    async callTastytradeFunction(functionName, options) {
        const { method = "GET", params, body, requireAuth = true } = options || {};
        let token = null;
        if (requireAuth) {
            token = await this.ensureLoggedIn();
        }
        const makeRequest = async (attempt) => {
            const headers = { "Content-Type": "application/json" };
            if (requireAuth && token) {
                headers[this.sessionHeaderName] = token;
            }
            const response = await this.fetchFromSupabase(functionName, {
                method,
                params,
                headers,
                body: body ? JSON.stringify(body) : undefined,
            });
            if (!response.ok) {
                if (requireAuth &&
                    (response.status === 401 || response.status === 403) &&
                    attempt < this.maxRetries) {
                    this.tokenManager.clear();
                    if (this.retryDelayMs > 0) {
                        await new Promise((resolve) => setTimeout(resolve, this.retryDelayMs));
                    }
                    token = await this.loginWithSupabase();
                    return makeRequest(attempt + 1);
                }
                const errorText = await response.text();
                throw new Error(`API call failed with status ${response.status}: ${errorText}`);
            }
            return response.json();
        };
        return makeRequest(0);
    }
    async getAccountBalances(accountNumber) {
        return this.callTastytradeFunction("get_account_balances", {
            params: { account_number: accountNumber },
        });
    }
    async getAccountPositions(accountNumber) {
        return this.callTastytradeFunction("get_account_positions", {
            params: { account_number: accountNumber },
        });
    }
    async getMarketMetrics(symbolsCsv) {
        return this.callTastytradeFunction("get_market_metrics", {
            params: { symbols: symbolsCsv },
        });
    }
    async getSymbolSearch(symbol) {
        return this.callTastytradeFunction("get_symbol_search", {
            params: { symbol },
        });
    }
    async postAccountOrders(accountNumber, orderBody) {
        return this.callTastytradeFunction("post_account_orders", {
            method: "POST",
            params: { account_number: accountNumber },
            body: orderBody,
        });
    }
    async deleteAccountOrder(accountNumber, orderId) {
        return this.callTastytradeFunction("delete_account_order", {
            method: "DELETE",
            params: { account_number: accountNumber, order_id: orderId },
        });
    }
}
exports.TastytradeClient = TastytradeClient;
