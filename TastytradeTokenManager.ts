// TastytradeTokenManager.ts

class TastytradeTokenManager {
  private session: { token: string; expiresAt?: number } | null = null;
  private storageKey = "tastytrade_session";
  private useLocalStorage: boolean;

  constructor(useLocalStorage: boolean = false) {
    this.useLocalStorage = useLocalStorage && typeof window !== "undefined" && window.localStorage !== null;
    if (this.useLocalStorage) {
      this.loadFromStorage();
    }
  }

  setSession(session: { token: string; expiresAt?: number }): void {
    this.session = session;
    if (this.useLocalStorage) {
      this.saveToStorage();
    }
  }

  getToken(): string | null {
    if (this.isValid()) {
      return this.session!.token;
    }
    this.clear();
    return null;
  }

  isValid(): boolean {
    if (!this.session || !this.session.token) {
      return false;
    }
    if (this.session.expiresAt && Date.now() >= this.session.expiresAt) {
      return false;
    }
    return true;
  }

  clear(): void {
    this.session = null;
    if (this.useLocalStorage) {
      try {
        localStorage.removeItem(this.storageKey);
      } catch (e) {
        console.error("Error clearing from localStorage", e);
      }
    }
  }

  private loadFromStorage(): void {
    if (!this.useLocalStorage) return;
    try {
      const storedSession = localStorage.getItem(this.storageKey);
      if (storedSession) {
        const parsed = JSON.parse(storedSession);
        if (parsed && parsed.token) {
          this.session = parsed;
        }
      }
    } catch (e) {
      console.error("Failed to load session from storage", e);
      this.clear();
    }
  }

  private saveToStorage(): void {
    if (!this.useLocalStorage) return;
    if (this.session) {
      try {
        localStorage.setItem(this.storageKey, JSON.stringify(this.session));
      } catch (e) {
        console.error("Failed to save session to storage", e);
      }
    } else {
      this.clear();
    }
  }
}

export { TastytradeTokenManager };
