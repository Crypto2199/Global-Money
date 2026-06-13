// ═══════════════════════════════════════════════
//  Global Money — js/database.js
//  IndexedDB unified layer + safe LocalStorage migration
//  Compatible with: storage.js, api.js, portfolio.js, watchlist.js
// ═══════════════════════════════════════════════

const DB_NAME    = "GlobalMoneyDB";
const DB_VERSION = 1;

// ── Store Definitions ─────────────────────────────
// Each store mirrors a LocalStorage key for migration compatibility
const STORES = {
  rates:     { name: "rates",     keyPath: "id" },       // cachedRates, cachedMetals
  history:   { name: "history",   keyPath: "id" },       // convHistory
  alerts:    { name: "alerts",    keyPath: "id" },       // priceAlerts
  favorites: { name: "favorites", keyPath: "id" },       // favCurrencies
  portfolio: { name: "portfolio", keyPath: "id" },       // portfolioData
  watchlist: { name: "watchlist", keyPath: "id" },       // watchlistData
  analytics: { name: "analytics", keyPath: "symbol" },  // historical analytics
  meta:      { name: "meta",      keyPath: "key" },      // migration flags, version info
};

// LocalStorage keys → IDB store mapping for migration
const LS_MIGRATION_MAP = [
  { lsKey: "cachedRates",   store: "rates",     idbKey: "cachedRates"   },
  { lsKey: "cachedMetals",  store: "rates",     idbKey: "cachedMetals"  },
  { lsKey: "convHistory",   store: "history",   idbKey: "convHistory"   },
  { lsKey: "priceAlerts",   store: "alerts",    idbKey: "priceAlerts"   },
  { lsKey: "favCurrencies", store: "favorites", idbKey: "favCurrencies" },
  { lsKey: "portfolioData", store: "portfolio", idbKey: "portfolioData" },
  { lsKey: "watchlistData", store: "watchlist", idbKey: "watchlistData" },
];

let _db = null;
let _dbReady = false;
let _initPromise = null;

// ── DB Initialization ─────────────────────────────
export function initDB() {
  if (_initPromise) return _initPromise;

  _initPromise = new Promise((resolve, reject) => {
    if (!window.indexedDB) {
      console.warn("[GM:DB] IndexedDB not supported — falling back to LocalStorage only");
      resolve(null);
      return;
    }

    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = (event) => {
      const db = event.target.result;
      Object.values(STORES).forEach(({ name, keyPath }) => {
        if (!db.objectStoreNames.contains(name)) {
          db.createObjectStore(name, { keyPath });
        }
      });
    };

    request.onsuccess = (event) => {
      _db = event.target.result;
      _dbReady = true;
      console.info("[GM:DB] IndexedDB initialized successfully");
      resolve(_db);
    };

    request.onerror = (event) => {
      console.error("[GM:DB] Failed to open IndexedDB:", event.target.error);
      resolve(null); // graceful degradation — don't reject
    };

    request.onblocked = () => {
      console.warn("[GM:DB] IndexedDB open blocked — another tab may be open");
    };
  });

  return _initPromise;
}

// ── Core IDB Operations ───────────────────────────

function _transaction(storeName, mode = "readonly") {
  if (!_db) return null;
  try {
    return _db.transaction([storeName], mode).objectStore(storeName);
  } catch (err) {
    console.warn("[GM:DB] Transaction error:", err.message);
    return null;
  }
}

function _promisify(request) {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror   = () => reject(request.error);
  });
}

/**
 * Write a value to an IDB store.
 * @param {string} storeName
 * @param {string} key       - record identifier
 * @param {*}      value     - data to store (will be serialized internally as { id: key, data: value, updatedAt })
 * @returns {Promise<boolean>}
 */
export async function dbSet(storeName, key, value) {
  try {
    await initDB();
    const store = _transaction(storeName, "readwrite");
    if (!store) return false;
    await _promisify(store.put({ id: key, data: value, updatedAt: Date.now() }));
    return true;
  } catch (err) {
    console.warn(`[GM:DB] dbSet(${storeName}, ${key}) failed:`, err.message);
    return false;
  }
}

/**
 * Read a value from an IDB store.
 * @param {string} storeName
 * @param {string} key
 * @param {*}      fallback
 * @returns {Promise<*>}
 */
export async function dbGet(storeName, key, fallback = null) {
  try {
    await initDB();
    const store = _transaction(storeName, "readonly");
    if (!store) return fallback;
    const record = await _promisify(store.get(key));
    return record !== undefined ? record.data : fallback;
  } catch (err) {
    console.warn(`[GM:DB] dbGet(${storeName}, ${key}) failed:`, err.message);
    return fallback;
  }
}

/**
 * Delete a record from an IDB store.
 */
export async function dbDelete(storeName, key) {
  try {
    await initDB();
    const store = _transaction(storeName, "readwrite");
    if (!store) return false;
    await _promisify(store.delete(key));
    return true;
  } catch (err) {
    console.warn(`[GM:DB] dbDelete(${storeName}, ${key}) failed:`, err.message);
    return false;
  }
}

/**
 * Get all records from a store.
 */
export async function dbGetAll(storeName) {
  try {
    await initDB();
    const store = _transaction(storeName, "readonly");
    if (!store) return [];
    const records = await _promisify(store.getAll());
    return records || [];
  } catch (err) {
    console.warn(`[GM:DB] dbGetAll(${storeName}) failed:`, err.message);
    return [];
  }
}

/**
 * Clear all records in a store.
 */
export async function dbClear(storeName) {
  try {
    await initDB();
    const store = _transaction(storeName, "readwrite");
    if (!store) return false;
    await _promisify(store.clear());
    return true;
  } catch (err) {
    console.warn(`[GM:DB] dbClear(${storeName}) failed:`, err.message);
    return false;
  }
}

// ── Convenience wrappers matching storage.js API ──

export async function dbGetRates(key)      { return dbGet("rates",     key); }
export async function dbSetRates(key, val) { return dbSet("rates",     key, val); }
export async function dbGetHistory()       { return dbGet("history",   "convHistory", []); }
export async function dbSetHistory(arr)    { return dbSet("history",   "convHistory", arr); }
export async function dbGetAlerts()        { return dbGet("alerts",    "priceAlerts", []); }
export async function dbSetAlerts(arr)     { return dbSet("alerts",    "priceAlerts", arr); }
export async function dbGetFavs()          { return dbGet("favorites", "favCurrencies"); }
export async function dbSetFavs(arr)       { return dbSet("favorites", "favCurrencies", arr); }
export async function dbGetPortfolio()     { return dbGet("portfolio", "portfolioData"); }
export async function dbSetPortfolio(obj)  { return dbSet("portfolio", "portfolioData", obj); }
export async function dbGetWatchlist()     { return dbGet("watchlist", "watchlistData"); }
export async function dbSetWatchlist(obj)  { return dbSet("watchlist", "watchlistData", obj); }

// ── Analytics store (used by analytics.js) ────────

export async function dbGetAnalytics(symbol)      { return dbGet("analytics", symbol); }
export async function dbSetAnalytics(symbol, data) {
  try {
    await initDB();
    const store = _transaction("analytics", "readwrite");
    if (!store) return false;
    await _promisify(store.put({ symbol, ...data, updatedAt: Date.now() }));
    return true;
  } catch (err) {
    console.warn(`[GM:DB] dbSetAnalytics(${symbol}) failed:`, err.message);
    return false;
  }
}
export async function dbGetAllAnalytics() { return dbGetAll("analytics"); }

// ── Safe Migration from LocalStorage → IndexedDB ──

const MIGRATION_FLAG = "gm_idb_migrated_v1";

/**
 * One-time migration: copy LocalStorage data into IndexedDB.
 * Data in LocalStorage is NOT deleted (backward compatibility).
 * Safe to call multiple times — runs only once per device.
 */
export async function migrateFromLocalStorage() {
  // Check if already migrated
  const alreadyDone = localStorage.getItem(MIGRATION_FLAG);
  if (alreadyDone === "true") return { skipped: true };

  await initDB();
  if (!_db) {
    console.warn("[GM:DB] IDB not available — migration skipped");
    return { skipped: true, reason: "no_idb" };
  }

  const report = { migrated: [], skipped: [], errors: [] };

  for (const { lsKey, store, idbKey } of LS_MIGRATION_MAP) {
    try {
      const raw = localStorage.getItem(lsKey);
      if (raw === null) { report.skipped.push(lsKey); continue; }

      let parsed;
      try { parsed = JSON.parse(raw); }
      catch { report.errors.push({ key: lsKey, reason: "json_parse" }); continue; }

      const ok = await dbSet(store, idbKey, parsed);
      if (ok) {
        report.migrated.push(lsKey);
      } else {
        report.errors.push({ key: lsKey, reason: "idb_write_failed" });
      }
    } catch (err) {
      report.errors.push({ key: lsKey, reason: err.message });
    }
  }

  // Mark migration done
  localStorage.setItem(MIGRATION_FLAG, "true");

  if (report.migrated.length > 0) {
    console.info("[GM:DB] Migration complete:", report.migrated.join(", "));
  }
  if (report.errors.length > 0) {
    console.warn("[GM:DB] Migration errors:", report.errors);
  }

  return report;
}

/**
 * Run DB initialization + migration.
 * Call once from app.js after DOMContentLoaded.
 */
export async function initDatabase() {
  try {
    await initDB();
    const migrationResult = await migrateFromLocalStorage();
    return { ok: true, migration: migrationResult };
  } catch (err) {
    console.warn("[GM:DB] initDatabase failed:", err.message);
    return { ok: false, error: err.message };
  }
}

export function isDBReady() { return _dbReady; }
