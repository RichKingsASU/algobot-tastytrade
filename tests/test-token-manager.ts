import { TastytradeTokenManager } from "../TastytradeTokenManager";

const log = (name: string, condition: boolean) => {
  console.log(`[${condition ? "PASS" : "FAIL"}] ${name}`);
};

console.log("--- Testing TastytradeTokenManager ---");

// Test case a) In-memory behavior
const mgr = new TastytradeTokenManager(false);
log("In-memory: isValid() is initially false", mgr.isValid() === false);
log("In-memory: getToken() is initially null", mgr.getToken() === null);

const sessionResponse = { "session-token": "ABC123", "remember-me-token": null, "user": { "email": "test@test.com" }, "expires-at": new Date(Date.now() + 10000).toISOString() };
mgr.setSession({ token: sessionResponse["session-token"], expiresAt: new Date(sessionResponse["expires-at"]).getTime() });
log("In-memory: isValid() is true after setting session", mgr.isValid() === true);
log("In-memory: getToken() returns correct token", mgr.getToken() === "ABC123");

mgr.clear();
log("In-memory: isValid() is false after clear", mgr.isValid() === false);
log("In-memory: getToken() is null after clear", mgr.getToken() === null);

// Test case b) Expiry behavior
const expiredSessionResponse = { "session-token": "DEF456", "remember-me-token": null, "user": { "email": "test@test.com" }, "expires-at": new Date(Date.now() - 1000).toISOString() };
mgr.setSession({ token: expiredSessionResponse["session-token"], expiresAt: new Date(expiredSessionResponse["expires-at"]).getTime() });
log("Expiry: isValid() is false for expired token", mgr.isValid() === false);
log("Expiry: getToken() returns null for expired token", mgr.getToken() === null);

// localStorage tests
if (typeof window === 'undefined' || typeof window.localStorage === 'undefined') {
  console.log("--- Skipping localStorage tests (not in a browser environment) ---");
} else {
  // localStorage tests would go here
}