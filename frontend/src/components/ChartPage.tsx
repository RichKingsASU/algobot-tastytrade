import React, { useState } from "react";
import { ModeToggle } from "../components/ModeToggle";
import { SymbolSelector } from "../components/SymbolSelector";
import { RealtimePriceTicker } from "../components/RealtimePriceTicker";
import { TradingViewChart } from "../components/TradingViewChart";

export const ChartPage: React.FC = () => {
  const [symbol, setSymbol] = useState("SPY");

  return (
    <div className="p-4 flex flex-col gap-4">
      <div className="flex justify-between items-center">
        <h1 className="text-xl font-semibold">Chart & Live Stream</h1>
        <ModeToggle />
      </div>

      <div className="flex justify-between items-center">
        <SymbolSelector value={symbol} onChange={setSymbol} />
        <RealtimePriceTicker symbol={symbol} />
      </div>

      <div className="border rounded-lg overflow-hidden">
        <TradingViewChart symbol={symbol} />
      </div>
    </div>
  );
};
