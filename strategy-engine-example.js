"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __generator = (this && this.__generator) || function (thisArg, body) {
    var _ = { label: 0, sent: function() { if (t[0] & 1) throw t[1]; return t[1]; }, trys: [], ops: [] }, f, y, t, g = Object.create((typeof Iterator === "function" ? Iterator : Object).prototype);
    return g.next = verb(0), g["throw"] = verb(1), g["return"] = verb(2), typeof Symbol === "function" && (g[Symbol.iterator] = function() { return this; }), g;
    function verb(n) { return function (v) { return step([n, v]); }; }
    function step(op) {
        if (f) throw new TypeError("Generator is already executing.");
        while (g && (g = 0, op[0] && (_ = 0)), _) try {
            if (f = 1, y && (t = op[0] & 2 ? y["return"] : op[0] ? y["throw"] || ((t = y["return"]) && t.call(y), 0) : y.next) && !(t = t.call(y, op[1])).done) return t;
            if (y = 0, t) op = [op[0] & 2, t.value];
            switch (op[0]) {
                case 0: case 1: t = op; break;
                case 4: _.label++; return { value: op[1], done: false };
                case 5: _.label++; y = op[1]; op = [0]; continue;
                case 7: op = _.ops.pop(); _.trys.pop(); continue;
                default:
                    if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) { _ = 0; continue; }
                    if (op[0] === 3 && (!t || (op[1] > t[0] && op[1] < t[3]))) { _.label = op[1]; break; }
                    if (op[0] === 6 && _.label < t[1]) { _.label = t[1]; t = op; break; }
                    if (t && _.label < t[2]) { _.label = t[2]; _.ops.push(op); break; }
                    if (t[2]) _.ops.pop();
                    _.trys.pop(); continue;
            }
            op = body.call(thisArg, _);
        } catch (e) { op = [6, e]; y = 0; } finally { f = t = 0; }
        if (op[0] & 5) throw op[1]; return { value: op[0] ? op[1] : void 0, done: true };
    }
};
Object.defineProperty(exports, "__esModule", { value: true });
var TastytradeClient_1 = require("./TastytradeClient");
var dotenv = require("dotenv");
dotenv.config();
var SUPABASE_URL = process.env.SUPABASE_URL || "https://dyrwkxdwszvqpzvodgxl.supabase.co";
var SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || "YOUR_SUPABASE_ANON_KEY";
var ACCOUNT_NUMBER = process.env.TASTYTRADE_ACCOUNT_NUMBER || "YOUR_TASTYTRADE_ACCOUNT_NUMBER";
var SYMBOL_TO_SEARCH = process.env.TASTYTRADE_SYMBOL_TO_SEARCH || "AAPL";
var client = new TastytradeClient_1.TastytradeClient({
    supabaseUrl: SUPABASE_URL,
    supabaseAnonKey: SUPABASE_ANON_KEY,
    enableLocalStorage: false,
    maxRetries: 2,
    retryDelayMs: 2000,
});
function runStrategyEngine() {
    return __awaiter(this, void 0, void 0, function () {
        var marketMetrics, balances, orderBody, orderResponse, error_1;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    _a.trys.push([0, 5, , 6]);
                    console.log("Strategy Engine: Ensuring login...");
                    return [4 /*yield*/, client.ensureLoggedIn()];
                case 1:
                    _a.sent();
                    console.log("Strategy Engine: Successfully logged in/refreshed token.");
                    console.log("Fetching market metrics for ".concat(SYMBOL_TO_SEARCH, "..."));
                    return [4 /*yield*/, client.getMarketMetrics(SYMBOL_TO_SEARCH)];
                case 2:
                    marketMetrics = _a.sent();
                    console.log(JSON.stringify(marketMetrics, null, 2));
                    console.log("Fetching account balances for ".concat(ACCOUNT_NUMBER, "..."));
                    return [4 /*yield*/, client.getAccountBalances(ACCOUNT_NUMBER)];
                case 3:
                    balances = _a.sent();
                    console.log(JSON.stringify(balances, null, 2));
                    // This is a simulated example and must be adapted before real trading.
                    console.log("Simulating order submission...");
                    orderBody = {
                        "time-in-force": "Day",
                        "order-type": "Limit",
                        "price": "150.00",
                        "legs": [
                            {
                                "instrument-type": "Equity",
                                "symbol": "MSFT",
                                "quantity": 1,
                                "action": "Buy to Open"
                            }
                        ]
                    };
                    return [4 /*yield*/, client.postAccountOrders(ACCOUNT_NUMBER, orderBody)];
                case 4:
                    orderResponse = _a.sent();
                    console.log(JSON.stringify(orderResponse, null, 2));
                    return [3 /*break*/, 6];
                case 5:
                    error_1 = _a.sent();
                    console.error("Strategy Engine Error:", error_1.message);
                    return [3 /*break*/, 6];
                case 6: return [2 /*return*/];
            }
        });
    });
}
runStrategyEngine();
/*
Example .env content:

SUPABASE_URL="https://dyrwkxdwszvqpzvodgxl.supabase.co"
SUPABASE_ANON_KEY="YOUR_SUPABASE_ANON_KEY"
TASTYTRADE_ACCOUNT_NUMBER="YOUR_TASTYTRADE_ACCOUNT_NUMBER"
TASTYTRADE_SYMBOL_TO_SEARCH="AAPL"
TASTYTRADE_BASE_URL="https://api.tastytrade.com"
TASTYTRADE_USERNAME="YOUR_TASTYTRADE_USERNAME"
TASTYTRADE_PASSWORD="YOUR_TASTYTRADE_PASSWORD"

How to install:
npm install dotenv typescript @types/node

How to compile and run:
npx tsc strategy-engine-example.ts
node strategy-engine-example.js
*/ 
