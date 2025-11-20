// frontend/src/lib/datafeed.ts

import { widget as TradingViewWidget, ResolutionString } from "some-type-defs";  
// adjust import path as per your setup

interface Bar { time: number; open: number; high: number; low: number; close: number; volume: number; }

const configuration = {
  supports_search: true,
  supports_group_request: false,
  supported_resolutions: ["1", "5", "15", "60", "1D", "1W"],
  supports_marks: false,
  supports_timescale_marks: false,
  supports_time: true,
};

const datafeed = {
  onReady: (callback: (cfg: typeof configuration) => void) => {
    console.log("[onReady]");  
    setTimeout(() => callback(configuration), 0);
  },

  searchSymbols: async (
    userInput: string,
    exchange: string,
    symbolType: string,
    onResultReady: (results: any[]) => void
  ) => {
    console.log("[searchSymbols]:", userInput);
    // Implement search logic or return hard-coded list
    onResultReady([]);
  },

  resolveSymbol: async (
    symbolName: string,
    onSymbolResolved: (symbolInfo: any) => void,
    onResolveError: (error: string) => void
  ) => {
    console.log("[resolveSymbol]:", symbolName);
    try {
      const res = await fetch(`/functions/v1/datafeed-symbolinfo?symbol=${encodeURIComponent(symbolName)}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const info = await res.json();
      onSymbolResolved(info);
    } catch (err) {
      console.error(err);
      onResolveError((err as Error).message);
    }
  },

  getBars: async (
    symbolInfo: any,
    resolution: ResolutionString,
    periodParams: { from: number; to: number; countBack: number; firstDataRequest: boolean; },
    onHistoryCallback: (bars: Bar[], meta?: { noData?: boolean }) => void,
    onErrorCallback: (error: string) => void
  ) => {
    console.log("[getBars]:", symbolInfo.ticker, resolution, periodParams);
    try {
      const query = `symbol=${encodeURIComponent(symbolInfo.ticker)}&resolution=${encodeURIComponent(resolution)}&from=${periodParams.from}&to=${periodParams.to}`;
      const res = await fetch(`/functions/v1/datafeed-history?${query}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const body = await res.json();
      if (body.s !== "ok" || !Array.isArray(body.bars)) {
        throw new Error("Unexpected response");
      }
      const bars: Bar[] = body.bars.map((r: any) => ({
        time: r.time * 1000,   // convert seconds → ms if needed
        open: r.open,
        high: r.high,
        low: r.low,
        close: r.close,
        volume: r.volume,
      }));
      onHistoryCallback(bars);
    } catch (err) {
      console.error(err);
      onErrorCallback((err as Error).message);
    }
  },

const wsUrl = 'ws://localhost:8080';  // adjust if deployed elsewhere
const subscribers: Record<string, WebSocket> = {};

const datafeed = {
  // … existing onReady, resolveSymbol, getBars methods …

  subscribeBars: (
    symbolInfo: any,
    resolution: string,
    onRealtimeCallback: (bar: any) => void,
    subscriberUID: string,
    onResetCacheNeededCallback: () => void
  ) => {
    console.log('[subscribeBars]:', subscriberUID, symbolInfo, resolution);

    // Create WebSocket connection or reuse
    const ws = new WebSocket(wsUrl);
    ws.onopen = () => {
      ws.send(
        JSON.stringify({
          action: 'subscribe',
          uid: subscriberUID,
          symbol: symbolInfo.ticker,
          resolution
        })
      );
    };

    ws.onmessage = (ev) => {
      try {
        const msg = JSON.parse(ev.data);
        // Ensure msg has new bar data matching symbol/resolution
        const bar = {
          time: msg.time,      // ensure this is ms since epoch
          open: msg.open,
          high: msg.high,
          low: msg.low,
          close: msg.close,
          volume: msg.volume
        };
        onRealtimeCallback(bar);
      } catch (err) {
        console.error('[subscribeBars] message parse error', err);
      }
    };

    ws.onerror = (err) => console.error('[subscribeBars] ws error', err);

    // Store for unsubscribe
    subscribers[subscriberUID] = ws;
  },

  unsubscribeBars: (subscriberUID: string) => {
    console.log('[unsubscribeBars]:', subscriberUID);
    const ws = subscribers[subscriberUID];
    if (ws) {
      ws.send(
        JSON.stringify({ action: 'unsubscribe', uid: subscriberUID })
      );
      ws.close();
      delete subscribers[subscriberUID];
    }
  },
};
};

export default datafeed;