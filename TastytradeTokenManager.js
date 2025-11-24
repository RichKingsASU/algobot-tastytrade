"use strict";
// TastytradeTokenManager.ts
Object.defineProperty(exports, "__esModule", { value: true });
exports.TastytradeTokenManager = void 0;
var TastytradeTokenManager = /** @class */ (function () {
    function TastytradeTokenManager(useLocalStorage) {
        if (useLocalStorage === void 0) { useLocalStorage = false; }
        this.session = null;
        this.storageKey = "tastytrade_session";
        this.useLocalStorage = useLocalStorage && typeof window !== "undefined" && window.localStorage !== null;
        if (this.useLocalStorage) {
            this.loadFromStorage();
        }
    }
    TastytradeTokenManager.prototype.setSession = function (session) {
        this.session = session;
        if (this.useLocalStorage) {
            this.saveToStorage();
        }
    };
    TastytradeTokenManager.prototype.getToken = function () {
        if (this.isValid()) {
            return this.session.token;
        }
        this.clear();
        return null;
    };
    TastytradeTokenManager.prototype.isValid = function () {
        if (!this.session || !this.session.token) {
            return false;
        }
        if (this.session.expiresAt && Date.now() >= this.session.expiresAt) {
            return false;
        }
        return true;
    };
    TastytradeTokenManager.prototype.clear = function () {
        this.session = null;
        if (this.useLocalStorage) {
            try {
                localStorage.removeItem(this.storageKey);
            }
            catch (e) {
                console.error("Error clearing from localStorage", e);
            }
        }
    };
    TastytradeTokenManager.prototype.loadFromStorage = function () {
        if (!this.useLocalStorage)
            return;
        try {
            var storedSession = localStorage.getItem(this.storageKey);
            if (storedSession) {
                var parsed = JSON.parse(storedSession);
                if (parsed && parsed.token) {
                    this.session = parsed;
                }
            }
        }
        catch (e) {
            console.error("Failed to load session from storage", e);
            this.clear();
        }
    };
    TastytradeTokenManager.prototype.saveToStorage = function () {
        if (!this.useLocalStorage)
            return;
        if (this.session) {
            try {
                localStorage.setItem(this.storageKey, JSON.stringify(this.session));
            }
            catch (e) {
                console.error("Failed to save session to storage", e);
            }
        }
        else {
            this.clear();
        }
    };
    return TastytradeTokenManager;
}());
exports.TastytradeTokenManager = TastytradeTokenManager;
