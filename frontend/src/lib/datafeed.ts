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

  subscribeBars: (
    symbolInfo: any,
    resolution: ResolutionString,
    onRealtimeCallback: (bar: Bar) => void,
    subscriberUID: string,
    onResetCacheNeeded: () => void
  ) => {
    console.log("[subscribeBars]:", symbolInfo.ticker, resolution, subscriberUID);
    const ws = new WebSocket('ws://localhost:8080');

    ws.onopen = () => {
      console.log('WebSocket connected');
      ws.send(JSON.stringify({ type: 'subscribe', symbol: symbolInfo.ticker, resolution }));
    };

    ws.onmessage = (event) => {
      const message = JSON.parse(event.data);
      // Assuming the server sends bar data in the format: { time, open, high, low, close, volume }
      onRealtimeCallback(message);
    };

    ws.onerror = (error) => {
      console.error('WebSocket error:', error);
    };

    (window as any).ws = ws;
  },

  unsubscribeBars: (subscriberUID: string) => {
    console.log("[unsubscribeBars]:", subscriberUID);
    const ws = (window as any).ws;
    if (ws) {
      ws.close();
    }
  },
};

export default datafeed;