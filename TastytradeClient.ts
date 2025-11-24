// TastytradeClient.ts
import { TastytradeTokenManager } from "./TastytradeTokenManager";

const DEFAULT_SUPABASE_URL = "https://dyrwkxdwszvqpzvodgxl.supabase.co";
const DEFAULT_FUNCTIONS_URL = `${DEFAULT_SUPABASE_URL}/functions/v1`;

export class TastytradeClient {
  private tokenManager: TastytradeTokenManager;
  private supabaseUrl: string;
  private functionsUrl: string;
  private supabaseAnonKey?: string;
  private sessionHeaderName: string;
  private maxRetries: number;
  private retryDelayMs: number;

  constructor(options?: {
    supabaseUrl?: string;
    functionsUrl?: string;
    supabaseAnonKey?: string;
    enableLocalStorage?: boolean;
    sessionHeaderName?: string;
    maxRetries?: number;
    retryDelayMs?: number;
  }) {
    this.supabaseUrl = options?.supabaseUrl || DEFAULT_SUPABASE_URL;
    this.functionsUrl = options?.functionsUrl || `${this.supabaseUrl}/functions/v1`;
    this.supabaseAnonKey = options?.supabaseAnonKey;
    this.sessionHeaderName = options?.sessionHeaderName || "Authorization";
    this.tokenManager = new TastytradeTokenManager(options?.enableLocalStorage);
    this.maxRetries = options?.maxRetries ?? 1;
    this.retryDelayMs = options?.retryDelayMs ?? 1000;
  }

  private async loginWithSupabase(): Promise<string> {
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

  async ensureLoggedIn(): Promise<string> {
    const existingToken = this.tokenManager.getToken();
    if (existingToken && this.tokenManager.isValid()) {
      return existingToken;
    }
    return this.loginWithSupabase();
  }

  private async fetchFromSupabase(
    functionName: string,
    init: RequestInit & { params?: Record<string, string | number | undefined> }
  ): Promise<Response> {
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

  async callTastytradeFunction<T>(
    functionName: string,
    options?: {
      method?: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
      params?: Record<string, string | number | undefined>;
      body?: any;
      requireAuth?: boolean;
    }
  ): Promise<T> {
    const { method = "GET", params, body, requireAuth = true } = options || {};
    let token: string | null = null;

    if (requireAuth) {
      token = await this.ensureLoggedIn();
    }

    const makeRequest = async (attempt: number): Promise<T> => {
      const headers: Record<string, string> = { "Content-Type": "application/json" };
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
        if (
          requireAuth &&
          (response.status === 401 || response.status === 403) &&
          attempt < this.maxRetries
        ) {
          this.tokenManager.clear();
          if (this.retryDelayMs > 0) {
            await new Promise((resolve) => setTimeout(resolve, this.retryDelayMs));
          }
          token = await this.loginWithSupabase();
          return makeRequest(attempt + 1);
        }
        const errorText = await response.text();
        throw new Error(
          `API call failed with status ${response.status}: ${errorText}`
        );
      }

      return response.json() as Promise<T>;
    };

    return makeRequest(0);
  }

  async getAccountBalances<T = any>(accountNumber: string): Promise<T> {
    return this.callTastytradeFunction<T>("get_account_balances", {
      params: { account_number: accountNumber },
    });
  }

  async getAccountPositions<T = any>(accountNumber: string): Promise<T> {
    return this.callTastytradeFunction<T>("get_account_positions", {
      params: { account_number: accountNumber },
    });
  }

  async getMarketMetrics<T = any>(symbolsCsv: string): Promise<T> {
    return this.callTastytradeFunction<T>("get_market_metrics", {
      params: { symbols: symbolsCsv },
    });
  }

  async getSymbolSearch<T = any>(symbol: string): Promise<T> {
    return this.callTastytradeFunction<T>("get_symbol_search", {
      params: { symbol },
    });
  }

  async postAccountOrders<T = any>(
    accountNumber: string,
    orderBody: any
  ): Promise<T> {
    return this.callTastytradeFunction<T>("post_account_orders", {
      method: "POST",
      params: { account_number: accountNumber },
      body: orderBody,
    });
  }

  async deleteAccountOrder<T = any>(
    accountNumber: string,
    orderId: string
  ): Promise<T> {
    return this.callTastytradeFunction<T>("delete_account_order", {
      method: "DELETE",
      params: { account_number: accountNumber, order_id: orderId },
    });
  }
}