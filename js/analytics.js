// ═══════════════════════════════════════════════
//  Global Money — js/analytics.js
//  Historical Analytics: daily/weekly/monthly changes,
//  highs/lows/averages per currency, crypto, or metal.
//  Integrates with api.js and charts.js without breaking them.
// ═══════════════════════════════════════════════

import { safeGetJSON, safeSetJSON } from "./storage.js";
import { dbGetAnalytics, dbSetAnalytics, isDBReady } from "./database.js";

// ── Config ────────────────────────────────────────
const SNAPSHOTS_KEY_PREFIX = "gm_snap_"; // localStorage prefix for snapshots
const MAX_DAILY_SNAPSHOTS  = 90;         // keep 90 days of data
const ANALYTICS_VERSION    = 1;

// ── Snapshot Structure ────────────────────────────
// Snapshot = { ts: unixMs, rates: { USD: 1, EUR: 0.92, XAU: 2050, BTC: 65000, ... } }

/**
 * Take a snapshot of current rates and persist it.
 * Called by api.js hooks after fresh data loads.
 * @param {Object} fiatRates   - { USD:1, EUR:0.92, DZD:135, ... }
 * @param {Object} cryptoRates - { BTC:65000, ETH:3200, ... } (in USD)
 * @param {Object} metalsRates - { XAU:2050, XAG:26, XPT:980, XPD:1020 } (in USD)
 */
export function recordSnapshot(fiatRates = {}, cryptoRates = {}, metalsRates = {}) {
  try {
    const ts = Date.now();
    const rates = { ...fiatRates };

    // Merge crypto and metals into unified snapshot (USD-denominated)
    Object.entries(cryptoRates).forEach(([sym, price]) => { rates[sym] = price; });
    Object.entries(metalsRates).forEach(([sym, price]) => { rates[sym] = price; });

    // Load existing snapshots, add new one, trim
    const existing = safeGetJSON(SNAPSHOTS_KEY_PREFIX + "all", []);
    existing.push({ ts, rates });

    // Keep only last 90 days
    const cutoff = Date.now() - MAX_DAILY_SNAPSHOTS * 24 * 3600 * 1000;
    const trimmed = existing.filter(s => s.ts >= cutoff).slice(-MAX_DAILY_SNAPSHOTS * 24); // ~24 per day max

    safeSetJSON(SNAPSHOTS_KEY_PREFIX + "all", trimmed);
    return true;
  } catch (err) {
    console.warn("[GM:Analytics] recordSnapshot failed:", err.message);
    return false;
  }
}

// ── Analytics Calculation ─────────────────────────

/**
 * Calculate analytics for a single symbol from snapshot history.
 * @param {string} symbol  - e.g. "EUR", "BTC", "XAU"
 * @param {string} base    - base currency for conversion (default "USD")
 * @returns {Object} analytics
 */
export function calcAnalytics(symbol, base = "USD") {
  const snapshots = safeGetJSON(SNAPSHOTS_KEY_PREFIX + "all", []);
  if (snapshots.length === 0) return _emptyAnalytics(symbol);

  const now = Date.now();

  // Filter snapshots by time windows
  const day7ago  = now - 7  * 24 * 3600 * 1000;
  const day30ago = now - 30 * 24 * 3600 * 1000;
  const day1ago  = now -      24 * 3600 * 1000;

  // Extract price series for the symbol (convert via base if needed)
  function getPrice(snap) {
    const rates = snap.rates;
    if (!rates) return null;
    if (base === "USD") {
      // Direct USD price
      return rates[symbol] !== undefined ? rates[symbol] : null;
    }
    // Convert: price = rates[symbol] / rates[base]  (both vs USD)
    if (rates[symbol] === undefined || rates[base] === undefined || rates[base] === 0) return null;
    return rates[symbol] / rates[base];
  }

  const allPrices  = snapshots.map(getPrice).filter(p => p !== null && isFinite(p));
  const dayPrices  = snapshots.filter(s => s.ts >= day1ago).map(getPrice).filter(p => p !== null && isFinite(p));
  const weekPrices = snapshots.filter(s => s.ts >= day7ago).map(getPrice).filter(p => p !== null && isFinite(p));
  const monPrices  = snapshots.filter(s => s.ts >= day30ago).map(getPrice).filter(p => p !== null && isFinite(p));

  if (allPrices.length === 0) return _emptyAnalytics(symbol);

  const latest = allPrices[allPrices.length - 1];

  return {
    symbol,
    base,
    latest,
    version: ANALYTICS_VERSION,
    updatedAt: now,

    // Changes
    change: {
      daily:   _pctChange(dayPrices),
      weekly:  _pctChange(weekPrices),
      monthly: _pctChange(monPrices),
      allTime: _pctChange(allPrices),
    },

    // Absolute values
    high: {
      daily:   dayPrices.length  ? Math.max(...dayPrices)  : null,
      weekly:  weekPrices.length ? Math.max(...weekPrices) : null,
      monthly: monPrices.length  ? Math.max(...monPrices)  : null,
      allTime: Math.max(...allPrices),
    },

    low: {
      daily:   dayPrices.length  ? Math.min(...dayPrices)  : null,
      weekly:  weekPrices.length ? Math.min(...weekPrices) : null,
      monthly: monPrices.length  ? Math.min(...monPrices)  : null,
      allTime: Math.min(...allPrices),
    },

    avg: {
      daily:   _avg(dayPrices),
      weekly:  _avg(weekPrices),
      monthly: _avg(monPrices),
      allTime: _avg(allPrices),
    },

    // Sample count (data density)
    sampleCount: {
      daily:   dayPrices.length,
      weekly:  weekPrices.length,
      monthly: monPrices.length,
    },
  };
}

/**
 * Calculate and persist analytics for a symbol to IDB (if available) or LS.
 */
export async function refreshAnalytics(symbol, base = "USD") {
  const data = calcAnalytics(symbol, base);

  // Persist to IDB if ready, else fall back to localStorage
  if (isDBReady()) {
    await dbSetAnalytics(symbol, data);
  } else {
    safeSetJSON(`gm_analytics_${symbol}`, data);
  }
  return data;
}

/**
 * Get cached analytics for a symbol (IDB → LS → recalculate).
 */
export async function getAnalytics(symbol, base = "USD") {
  // Try IDB first
  if (isDBReady()) {
    const cached = await dbGetAnalytics(symbol);
    if (cached && cached.updatedAt && (Date.now() - cached.updatedAt < 3600000)) {
      return cached;
    }
  }
  // Try localStorage fallback
  const lsCached = safeGetJSON(`gm_analytics_${symbol}`);
  if (lsCached && lsCached.updatedAt && (Date.now() - lsCached.updatedAt < 3600000)) {
    return lsCached;
  }
  // Recalculate
  return refreshAnalytics(symbol, base);
}

/**
 * Get analytics for multiple symbols at once.
 * @param {string[]} symbols
 * @param {string}   base
 * @returns {Promise<Object>}  { symbol: analytics, ... }
 */
export async function getBatchAnalytics(symbols, base = "USD") {
  const results = {};
  await Promise.all(symbols.map(async sym => {
    results[sym] = await getAnalytics(sym, base);
  }));
  return results;
}

/**
 * Get price series for charting purposes (time-ordered array of { time, value }).
 * @param {string} symbol
 * @param {string} window - "1d" | "7d" | "30d" | "all"
 * @param {string} base
 * @returns {Array<{time: number, value: number}>}
 */
export function getPriceSeries(symbol, window = "7d", base = "USD") {
  const snapshots = safeGetJSON(SNAPSHOTS_KEY_PREFIX + "all", []);
  const cutoffMap = {
    "1d":  Date.now() -  1 * 24 * 3600 * 1000,
    "7d":  Date.now() -  7 * 24 * 3600 * 1000,
    "30d": Date.now() - 30 * 24 * 3600 * 1000,
    "all": 0,
  };
  const cutoff = cutoffMap[window] ?? cutoffMap["7d"];

  return snapshots
    .filter(s => s.ts >= cutoff && s.rates)
    .map(s => {
      let value;
      if (base === "USD") {
        value = s.rates[symbol];
      } else {
        const sym = s.rates[symbol];
        const b   = s.rates[base];
        value = (sym !== undefined && b && b !== 0) ? sym / b : undefined;
      }
      return value !== undefined && isFinite(value) ? { time: s.ts, value } : null;
    })
    .filter(Boolean);
}

/**
 * Render an analytics mini-card into a DOM element.
 * Non-invasive: only touches the given container element.
 * @param {string}      symbol
 * @param {HTMLElement} container
 * @param {string}      base
 */
export async function renderAnalyticsCard(symbol, container, base = "USD") {
  if (!container) return;
  const data = await getAnalytics(symbol, base);

  const fmt = (n, dp = 2) => (n !== null && n !== undefined && isFinite(n))
    ? n.toLocaleString("en-US", { minimumFractionDigits: dp, maximumFractionDigits: dp })
    : "—";

  const pctColor = pct => {
    if (pct === null || pct === undefined || !isFinite(pct)) return "var(--text-muted, #888)";
    return pct > 0 ? "var(--up, #22c55e)" : pct < 0 ? "var(--down, #ef4444)" : "var(--flat, #888)";
  };

  const pctStr = (pct) => {
    if (pct === null || pct === undefined || !isFinite(pct)) return "—";
    return `${pct > 0 ? "+" : ""}${pct.toFixed(2)}%`;
  };

  container.innerHTML = `
    <div class="analytics-card" style="font-size:0.82em;padding:8px 0;border-top:1px solid var(--border, #e5e7eb);margin-top:6px;">
      <div style="display:flex;gap:12px;flex-wrap:wrap;">
        <span style="color:${pctColor(data.change.daily)};font-weight:600;" title="التغير اليومي">
          يوم: ${pctStr(data.change.daily)}
        </span>
        <span style="color:${pctColor(data.change.weekly)};font-weight:600;" title="التغير الأسبوعي">
          أسبوع: ${pctStr(data.change.weekly)}
        </span>
        <span style="color:${pctColor(data.change.monthly)};font-weight:600;" title="التغير الشهري">
          شهر: ${pctStr(data.change.monthly)}
        </span>
      </div>
      <div style="display:flex;gap:12px;flex-wrap:wrap;margin-top:4px;color:var(--text-muted,#888);">
        <span title="أعلى قيمة (شهرية)">↑ ${fmt(data.high.monthly)}</span>
        <span title="أدنى قيمة (شهرية)">↓ ${fmt(data.low.monthly)}</span>
        <span title="متوسط (شهري)">∅ ${fmt(data.avg.monthly)}</span>
      </div>
    </div>
  `;
}

// ── Helpers ───────────────────────────────────────

function _pctChange(prices) {
  if (prices.length < 2) return null;
  const first = prices[0];
  const last  = prices[prices.length - 1];
  if (first === 0 || !isFinite(first) || !isFinite(last)) return null;
  return ((last - first) / first) * 100;
}

function _avg(prices) {
  if (prices.length === 0) return null;
  return prices.reduce((a, b) => a + b, 0) / prices.length;
}

function _emptyAnalytics(symbol) {
  return {
    symbol,
    base: "USD",
    latest: null,
    version: ANALYTICS_VERSION,
    updatedAt: Date.now(),
    change:  { daily: null, weekly: null, monthly: null, allTime: null },
    high:    { daily: null, weekly: null, monthly: null, allTime: null },
    low:     { daily: null, weekly: null, monthly: null, allTime: null },
    avg:     { daily: null, weekly: null, monthly: null, allTime: null },
    sampleCount: { daily: 0, weekly: 0, monthly: 0 },
  };
}

// ── Auto-hook: record snapshot after api loads ────
// This hooks into the global event system if api.js dispatches events,
// or can be called directly by api.js

/**
 * Hook to call after fresh fiat/crypto/metals data is loaded.
 * Keeps analytics up to date automatically.
 */
export function onRatesLoaded(fiatRates, cryptoRates, metalsRates) {
  // Non-blocking — analytics is secondary to main app function
  setTimeout(() => {
    recordSnapshot(fiatRates || {}, cryptoRates || {}, metalsRates || {});
  }, 500);
}
