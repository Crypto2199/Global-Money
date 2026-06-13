// ═══════════════════════════════════════════════
//  Global Money — js/bm-config.js
//  Black Market Configuration System
//  Multi-source, validated, safe fallback, updateable
//  without touching blackmarket.js or storage.js
// ═══════════════════════════════════════════════

// ── Source Definitions ────────────────────────────
// Each source is a function that returns a URL for a given currency.
// Sources are tried in order; first valid result wins.
export const BM_SOURCES = [
  {
    id: "iqrates",
    label: "IQRates API",
    priority: 1,
    active: true,
    makeUrl: (cur) => `https://api.iqrates.com/api/v1/rates/latest?currency=${cur}&source=parallel`,
    extractRate: (json, cur) =>
      json?.data?.rate || json?.rate || json?.parallel?.rate || json?.parallel || null,
    timeout: 6000,
  },
  {
    id: "dz-rates",
    label: "DZ-Rates API",
    priority: 2,
    active: true,
    makeUrl: (cur) => `https://api.dz-rates.com/v1/parallel/${cur}`,
    extractRate: (json, cur) =>
      json?.rate || json?.parallel || json?.value || json?.[cur]?.parallel || null,
    timeout: 6000,
  },
  {
    id: "dzd-live",
    label: "DZD Live",
    priority: 3,
    active: true,
    makeUrl: (cur) => `https://dzd-live.com/api/rates?currency=${cur}`,
    extractRate: (json, cur) =>
      json?.parallel || json?.black_market || json?.rate || null,
    timeout: 5000,
  },
];

// ── Supported Currencies ──────────────────────────
// Easy to add/remove currencies without touching blackmarket.js
export const BM_CURRENCIES = ["USD", "EUR", "GBP", "SAR", "AED", "CAD"];

// ── Manual Fallback Rates ─────────────────────────
// Updated independently; last resort when all APIs fail
export const BM_MANUAL_FALLBACK = {
  USD: { rate: 245.0, date: "13/06/2026" },
  EUR: { rate: 269.5, date: "13/06/2026" },
  GBP: { rate: 310.0, date: "13/06/2026" },
  SAR: { rate: 65.2,  date: "13/06/2026" },
  AED: { rate: 66.7,  date: "13/06/2026" },
  CAD: { rate: 179.5, date: "13/06/2026" },
};

// ── Premium ratios (computed from official when API fails) ────
// BM rate ≈ official × (1 + premium)
export const BM_PREMIUM = {
  USD: 0.255,
  EUR: 0.265,
  GBP: 0.270,
  SAR: 0.258,
  AED: 0.258,
  CAD: 0.252,
};

// ── Validation ────────────────────────────────────

/**
 * Validate a parallel market rate.
 * Rate must be a positive finite number within a plausible range.
 * @param {*}      rate
 * @param {string} currency
 * @returns {boolean}
 */
export function validateBMRate(rate, currency) {
  if (rate === null || rate === undefined) return false;
  const n = parseFloat(rate);
  if (!isFinite(n) || n <= 0) return false;

  // Sanity range check: DZD rates should be within a plausible range
  const manual = BM_MANUAL_FALLBACK[currency];
  if (manual) {
    const ref = manual.rate;
    // Allow ±60% deviation from manual rate
    if (n < ref * 0.4 || n > ref * 2.5) {
      console.warn(`[GM:BMConfig] Rate sanity check failed for ${currency}: ${n} (ref: ${ref})`);
      return false;
    }
  }

  return true;
}

/**
 * Extract rate from a JSON response using a source's extractor.
 * Returns null if extraction fails or validation fails.
 */
export function extractAndValidate(json, currency, source) {
  try {
    const raw = source.extractRate(json, currency);
    const n = parseFloat(raw);
    return validateBMRate(n, currency) ? n : null;
  } catch {
    return null;
  }
}

// ── Runtime Settings (can be updated without redeploy) ────────
let _runtimeOverrides = {};

/**
 * Apply runtime overrides to BM configuration.
 * e.g. disable a broken source, update a manual rate.
 * @param {Object} overrides - { sources: { iqrates: { active: false } }, manualRates: { USD: 248 } }
 */
export function applyBMOverrides(overrides = {}) {
  _runtimeOverrides = overrides;

  // Apply source overrides
  if (overrides.sources) {
    Object.entries(overrides.sources).forEach(([id, settings]) => {
      const src = BM_SOURCES.find(s => s.id === id);
      if (src) Object.assign(src, settings);
    });
  }

  // Apply manual rate overrides
  if (overrides.manualRates) {
    Object.entries(overrides.manualRates).forEach(([cur, rate]) => {
      if (BM_MANUAL_FALLBACK[cur]) {
        BM_MANUAL_FALLBACK[cur].rate = rate;
        BM_MANUAL_FALLBACK[cur].date = new Date().toLocaleDateString("fr-DZ");
      }
    });
  }
}

/**
 * Get active sources sorted by priority.
 */
export function getActiveSources() {
  return BM_SOURCES
    .filter(s => s.active)
    .sort((a, b) => a.priority - b.priority);
}

/**
 * Get the fallback rate for a currency.
 * Priority: manual fallback → computed from official (if available).
 * @param {string} currency
 * @param {number|null} officialRate - official DZD rate for currency
 * @returns {{ rate: number, source: string }}
 */
export function getFallbackRate(currency, officialRate = null) {
  // Try computed from official + premium
  if (officialRate && isFinite(officialRate) && BM_PREMIUM[currency]) {
    const computed = officialRate * (1 + BM_PREMIUM[currency]);
    if (validateBMRate(computed, currency)) {
      return { rate: computed, source: "computed" };
    }
  }

  // Fall back to manual
  const manual = BM_MANUAL_FALLBACK[currency];
  if (manual) {
    return { rate: manual.rate, source: "manual", date: manual.date };
  }

  return null;
}

/**
 * Export config summary for debugging / UI display.
 */
export function getBMConfigStatus() {
  return {
    currencies:    BM_CURRENCIES,
    activeSources: getActiveSources().map(s => ({ id: s.id, label: s.label })),
    manualRates:   { ...BM_MANUAL_FALLBACK },
    hasOverrides:  Object.keys(_runtimeOverrides).length > 0,
  };
}
