import {
  IExternalDatafeed,
  LibrarySymbolInfo,
} from "charting_library";  // adjust path if necessary

export class CustomDatafeed implements IExternalDatafeed {
  onReady(callback: (config: any) => void): void {
    const config = {
      supports_search: true,
      supports_group_request: false,
      supports_marks: false,
      supports_time: true,
      supported_resolutions: ["1", "5", "15", "60", "D"],
    };
    setTimeout(() => callback(config), 0);
  }

  resolveSymbol(
    symbolName: string,
    onSymbolResolvedCallback: (symbolInfo: LibrarySymbolInfo) => void,
    onResolveErrorCallback: (error: string) => void
  ): void {
    fetch(`/functions/v1/datafeed/symbol_info?symbol=${encodeURIComponent(symbolName)}`)
      .then(r => r.json())
      .then(resp => {
        if (resp.s === "ok") {
          onSymbolResolvedCallback(resp.symbolInfo);
        } else {
          onResolveErrorCallback("symbol not found");
        }
      })
      .catch(err => onResolveErrorCallback(err.message));
  }

  getBars(
    symbolInfo: LibrarySymbolInfo,
    resolution: string,
    from: number,
    to: number,
    onHistoryCallback: (bars: any[], meta: any) => void,
    onErrorCallback: (error: string) => void,
    firstDataRequest: boolean
  ): void {
    fetch(`/functions/v1/datafeed/history?symbol=${encodeURIComponent(symbolInfo.ticker)}&resolution=${resolution}&from=${from}&to=${to}`)
      .then(r => r.json())
      .then(resp => {
        if (resp.s === "ok") {
          onHistoryCallback(resp.bars, { noData: resp.bars.length === 0 });
        } else {
          onErrorCallback("no data");
        }
      })
      .catch(err => onErrorCallback(err.message));
  }

  subscribeBars(
    symbolInfo: LibrarySymbolInfo,
    resolution: string,
    onRealtimeCallback: (bar: any) => void,
    subscriberUID: string,
    onResetCacheNeededCallback: () => void
  ): void {
    // TODO: wire real-time subscription via Supabase Realtime or WebSocket
    // Example: subscribe to `/realtime_quotes` table for updates
    const channel = (window as any).supabase
      .channel(`quotes-${symbolInfo.ticker}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "realtime_quotes",
          filter: `symbol=eq.${symbolInfo.ticker}`
        },
        (payload: any) => {
          const row = payload.new;
          onRealtimeCallback({
            time: Math.floor(new Date(row.ts).getTime() / 1000),
            open: row.last_price,
            high: row.last_price,
            low: row.last_price,
            close: row.last_price,
            volume: row.volume,
          });
        }
      )
      .subscribe();
    (this as any)._channel = channel;
  }

  unsubscribeBars(subscriberUID: string): void {
    (window as any).supabase.removeChannel((this as any)._channel);
  }

  getServerTime(callback: (timestamp: number) => void): void {
    callback(Math.floor(Date.now() / 1000));
  }
}
