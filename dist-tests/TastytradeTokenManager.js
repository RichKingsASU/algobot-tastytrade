"use strict";
// TastytradeTokenManager.ts
Object.defineProperty(exports, "__esModule", { value: true });
exports.TastytradeTokenManager = void 0;
class TastytradeTokenManager {
    constructor(useLocalStorage = false) {
        this.session = null;
        this.storageKey = "tastytrade_session";
        this.useLocalStorage = useLocalStorage && typeof window !== "undefined" && window.localStorage !== null;
        if (this.useLocalStorage) {
            this.loadFromStorage();
        }
    }
    setSession(session) {
        this.session = session;
        if (this.useLocalStorage) {
            this.saveToStorage();
        }
    }
    getToken() {
        if (this.isValid()) {
            return this.session.token;
        }
        this.clear();
        return null;
    }
    isValid() {
        if (!this.session || !this.session.token) {
            return false;
        }
        if (this.session.expiresAt && Date.now() >= this.session.expiresAt) {
            return false;
        }
        return true;
    }
    clear() {
        this.session = null;
        if (this.useLocalStorage) {
            try {
                localStorage.removeItem(this.storageKey);
            }
            catch (e) {
                console.error("Error clearing from localStorage", e);
            }
        }
    }
    loadFromStorage() {
        if (!this.useLocalStorage)
            return;
        try {
            const storedSession = localStorage.getItem(this.storageKey);
            if (storedSession) {
                const parsed = JSON.parse(storedSession);
                if (parsed && parsed.token) {
                    this.session = parsed;
                }
            }
        }
        catch (e) {
            console.error("Failed to load session from storage", e);
            this.clear();
        }
    }
    saveToStorage() {
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
    }
}
exports.TastytradeTokenManager = TastytradeTokenManager;
