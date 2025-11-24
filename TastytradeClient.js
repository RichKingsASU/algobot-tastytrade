"use strict";
var __assign = (this && this.__assign) || function () {
    __assign = Object.assign || function(t) {
        for (var s, i = 1, n = arguments.length; i < n; i++) {
            s = arguments[i];
            for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p))
                t[p] = s[p];
        }
        return t;
    };
    return __assign.apply(this, arguments);
};
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
exports.TastytradeClient = void 0;
// TastytradeClient.ts
var TastytradeTokenManager_1 = require("./TastytradeTokenManager");
var DEFAULT_SUPABASE_URL = "https://dyrwkxdwszvqpzvodgxl.supabase.co";
var DEFAULT_FUNCTIONS_URL = "".concat(DEFAULT_SUPABASE_URL, "/functions/v1");
var TastytradeClient = /** @class */ (function () {
    function TastytradeClient(options) {
        var _a, _b;
        this.supabaseUrl = (options === null || options === void 0 ? void 0 : options.supabaseUrl) || DEFAULT_SUPABASE_URL;
        this.functionsUrl = (options === null || options === void 0 ? void 0 : options.functionsUrl) || "".concat(this.supabaseUrl, "/functions/v1");
        this.supabaseAnonKey = options === null || options === void 0 ? void 0 : options.supabaseAnonKey;
        this.sessionHeaderName = (options === null || options === void 0 ? void 0 : options.sessionHeaderName) || "Authorization";
        this.tokenManager = new TastytradeTokenManager_1.TastytradeTokenManager(options === null || options === void 0 ? void 0 : options.enableLocalStorage);
        this.maxRetries = (_a = options === null || options === void 0 ? void 0 : options.maxRetries) !== null && _a !== void 0 ? _a : 1;
        this.retryDelayMs = (_b = options === null || options === void 0 ? void 0 : options.retryDelayMs) !== null && _b !== void 0 ? _b : 1000;
    }
    TastytradeClient.prototype.loginWithSupabase = function () {
        return __awaiter(this, void 0, void 0, function () {
            var response, data, token, expiresIn, expiresAt;
            var _a, _b;
            return __generator(this, function (_c) {
                switch (_c.label) {
                    case 0: return [4 /*yield*/, this.fetchFromSupabase("login_session", {
                            method: "POST",
                            headers: { "Content-Type": "application/json" },
                        })];
                    case 1:
                        response = _c.sent();
                        if (!response.ok) {
                            throw new Error("Login failed: ".concat(response.status, " ").concat(response.statusText));
                        }
                        return [4 /*yield*/, response.json()];
                    case 2:
                        data = _c.sent();
                        token = ((_a = data === null || data === void 0 ? void 0 : data.data) === null || _a === void 0 ? void 0 : _a["session-token"]) || (data === null || data === void 0 ? void 0 : data["session-token"]) || (data === null || data === void 0 ? void 0 : data.token);
                        if (!token) {
                            throw new Error("No session token found in login response");
                        }
                        expiresIn = ((_b = data === null || data === void 0 ? void 0 : data.data) === null || _b === void 0 ? void 0 : _b["remember-me-token-expires-in-seconds"]) || (data === null || data === void 0 ? void 0 : data["remember-me-token-expires-in-seconds"]);
                        expiresAt = expiresIn ? Date.now() + expiresIn * 1000 : undefined;
                        this.tokenManager.setSession({ token: token, expiresAt: expiresAt });
                        return [2 /*return*/, token];
                }
            });
        });
    };
    TastytradeClient.prototype.ensureLoggedIn = function () {
        return __awaiter(this, void 0, void 0, function () {
            var existingToken;
            return __generator(this, function (_a) {
                existingToken = this.tokenManager.getToken();
                if (existingToken && this.tokenManager.isValid()) {
                    return [2 /*return*/, existingToken];
                }
                return [2 /*return*/, this.loginWithSupabase()];
            });
        });
    };
    TastytradeClient.prototype.fetchFromSupabase = function (functionName, init) {
        return __awaiter(this, void 0, void 0, function () {
            var url, _i, _a, _b, key, value, headers;
            return __generator(this, function (_c) {
                url = new URL("".concat(this.functionsUrl, "/").concat(functionName));
                if (init.params) {
                    for (_i = 0, _a = Object.entries(init.params); _i < _a.length; _i++) {
                        _b = _a[_i], key = _b[0], value = _b[1];
                        if (value !== undefined) {
                            url.searchParams.set(key, String(value));
                        }
                    }
                }
                headers = new Headers(init.headers || {});
                if (this.supabaseAnonKey) {
                    headers.set("apikey", this.supabaseAnonKey);
                }
                return [2 /*return*/, fetch(url.toString(), __assign(__assign({}, init), { headers: headers }))];
            });
        });
    };
    TastytradeClient.prototype.callTastytradeFunction = function (functionName, options) {
        return __awaiter(this, void 0, void 0, function () {
            var _a, _b, method, params, body, _c, requireAuth, token, makeRequest;
            var _this = this;
            return __generator(this, function (_d) {
                switch (_d.label) {
                    case 0:
                        _a = options || {}, _b = _a.method, method = _b === void 0 ? "GET" : _b, params = _a.params, body = _a.body, _c = _a.requireAuth, requireAuth = _c === void 0 ? true : _c;
                        token = null;
                        if (!requireAuth) return [3 /*break*/, 2];
                        return [4 /*yield*/, this.ensureLoggedIn()];
                    case 1:
                        token = _d.sent();
                        _d.label = 2;
                    case 2:
                        makeRequest = function (attempt) { return __awaiter(_this, void 0, void 0, function () {
                            var headers, response, errorText;
                            var _this = this;
                            return __generator(this, function (_a) {
                                switch (_a.label) {
                                    case 0:
                                        headers = { "Content-Type": "application/json" };
                                        if (requireAuth && token) {
                                            headers[this.sessionHeaderName] = token;
                                        }
                                        return [4 /*yield*/, this.fetchFromSupabase(functionName, {
                                                method: method,
                                                params: params,
                                                headers: headers,
                                                body: body ? JSON.stringify(body) : undefined,
                                            })];
                                    case 1:
                                        response = _a.sent();
                                        if (!!response.ok) return [3 /*break*/, 7];
                                        if (!(requireAuth &&
                                            (response.status === 401 || response.status === 403) &&
                                            attempt < this.maxRetries)) return [3 /*break*/, 5];
                                        this.tokenManager.clear();
                                        if (!(this.retryDelayMs > 0)) return [3 /*break*/, 3];
                                        return [4 /*yield*/, new Promise(function (resolve) { return setTimeout(resolve, _this.retryDelayMs); })];
                                    case 2:
                                        _a.sent();
                                        _a.label = 3;
                                    case 3: return [4 /*yield*/, this.loginWithSupabase()];
                                    case 4:
                                        token = _a.sent();
                                        return [2 /*return*/, makeRequest(attempt + 1)];
                                    case 5: return [4 /*yield*/, response.text()];
                                    case 6:
                                        errorText = _a.sent();
                                        throw new Error("API call failed with status ".concat(response.status, ": ").concat(errorText));
                                    case 7: return [2 /*return*/, response.json()];
                                }
                            });
                        }); };
                        return [2 /*return*/, makeRequest(0)];
                }
            });
        });
    };
    TastytradeClient.prototype.getAccountBalances = function (accountNumber) {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                return [2 /*return*/, this.callTastytradeFunction("get_account_balances", {
                        params: { account_number: accountNumber },
                    })];
            });
        });
    };
    TastytradeClient.prototype.getAccountPositions = function (accountNumber) {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                return [2 /*return*/, this.callTastytradeFunction("get_account_positions", {
                        params: { account_number: accountNumber },
                    })];
            });
        });
    };
    TastytradeClient.prototype.getMarketMetrics = function (symbolsCsv) {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                return [2 /*return*/, this.callTastytradeFunction("get_market_metrics", {
                        params: { symbols: symbolsCsv },
                    })];
            });
        });
    };
    TastytradeClient.prototype.getSymbolSearch = function (symbol) {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                return [2 /*return*/, this.callTastytradeFunction("get_symbol_search", {
                        params: { symbol: symbol },
                    })];
            });
        });
    };
    TastytradeClient.prototype.postAccountOrders = function (accountNumber, orderBody) {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                return [2 /*return*/, this.callTastytradeFunction("post_account_orders", {
                        method: "POST",
                        params: { account_number: accountNumber },
                        body: orderBody,
                    })];
            });
        });
    };
    TastytradeClient.prototype.deleteAccountOrder = function (accountNumber, orderId) {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                return [2 /*return*/, this.callTastytradeFunction("delete_account_order", {
                        method: "DELETE",
                        params: { account_number: accountNumber, order_id: orderId },
                    })];
            });
        });
    };
    return TastytradeClient;
}());
exports.TastytradeClient = TastytradeClient;
