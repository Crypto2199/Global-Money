// ═══════════════════════════════════════════════
//  Global Money — js/storage.js
//  localStorage helpers + currency/crypto data constants
// ═══════════════════════════════════════════════

export const CACHE_DURATION = 3600000; // 1 hour in ms

// ── Currency Data ────────────────────────────────
export const countryMap = {
  USD:"us",EUR:"eu",GBP:"gb",JPY:"jp",CHF:"ch",
  SAR:"sa",AED:"ae",QAR:"qa",KWD:"kw",BHD:"bh",OMR:"om",
  JOD:"jo",IQD:"iq",LBP:"lb",SYP:"sy",YER:"ye",
  DZD:"dz",MAD:"ma",TND:"tn",LYD:"ly",EGP:"eg",SDG:"sd",MRU:"mr",
  CAD:"ca",AUD:"au",NZD:"nz",SGD:"sg",HKD:"hk",
  CNY:"cn",TWD:"tw",KRW:"kr",
  INR:"in",PKR:"pk",BDT:"bd",LKR:"lk",NPR:"np",
  MYR:"my",THB:"th",IDR:"id",PHP:"ph",VND:"vn",MMK:"mm",KHR:"kh",
  RUB:"ru",UAH:"ua",TRY:"tr",ILS:"il",
  SEK:"se",NOK:"no",DKK:"dk",PLN:"pl",CZK:"cz",
  HUF:"hu",RON:"ro",BGN:"bg",ISK:"is",
  GEL:"ge",AMD:"am",AZN:"az",KZT:"kz",UZS:"uz",
  MXN:"mx",BRL:"br",ARS:"ar",CLP:"cl",COP:"co",PEN:"pe",
  ZAR:"za",NGN:"ng",KES:"ke",GHS:"gh",ETB:"et",
  TZS:"tz",UGX:"ug",RWF:"rw",AOA:"ao",
};

export const currencyNames = {
  USD:"US Dollar",EUR:"Euro",GBP:"British Pound",JPY:"Japanese Yen",CHF:"Swiss Franc",
  CAD:"Canadian Dollar",AUD:"Australian Dollar",NZD:"New Zealand Dollar",
  SAR:"Saudi Riyal",AED:"UAE Dirham",QAR:"Qatari Riyal",KWD:"Kuwaiti Dinar",
  BHD:"Bahraini Dinar",OMR:"Omani Rial",JOD:"Jordanian Dinar",IQD:"Iraqi Dinar",
  LBP:"Lebanese Pound",SYP:"Syrian Pound",YER:"Yemeni Rial",
  DZD:"Algerian Dinar",MAD:"Moroccan Dirham",TND:"Tunisian Dinar",
  LYD:"Libyan Dinar",EGP:"Egyptian Pound",SDG:"Sudanese Pound",MRU:"Mauritanian Ouguiya",
  CNY:"Chinese Yuan",HKD:"Hong Kong Dollar",TWD:"Taiwan Dollar",SGD:"Singapore Dollar",
  KRW:"South Korean Won",MYR:"Malaysian Ringgit",THB:"Thai Baht",
  IDR:"Indonesian Rupiah",PHP:"Philippine Peso",VND:"Vietnamese Dong",
  INR:"Indian Rupee",PKR:"Pakistani Rupee",BDT:"Bangladeshi Taka",
  LKR:"Sri Lankan Rupee",NPR:"Nepalese Rupee",MMK:"Myanmar Kyat",KHR:"Cambodian Riel",
  TRY:"Turkish Lira",ILS:"Israeli Shekel",
  SEK:"Swedish Krona",NOK:"Norwegian Krone",DKK:"Danish Krone",
  PLN:"Polish Zloty",CZK:"Czech Koruna",HUF:"Hungarian Forint",
  RON:"Romanian Leu",BGN:"Bulgarian Lev",ISK:"Icelandic Króna",
  RUB:"Russian Ruble",UAH:"Ukrainian Hryvnia",
  GEL:"Georgian Lari",AMD:"Armenian Dram",AZN:"Azerbaijani Manat",
  KZT:"Kazakhstani Tenge",UZS:"Uzbekistani Som",
  MXN:"Mexican Peso",BRL:"Brazilian Real",ARS:"Argentine Peso",
  CLP:"Chilean Peso",COP:"Colombian Peso",PEN:"Peruvian Sol",
  ZAR:"South African Rand",NGN:"Nigerian Naira",KES:"Kenyan Shilling",
  GHS:"Ghanaian Cedi",ETB:"Ethiopian Birr",TZS:"Tanzanian Shilling",
  UGX:"Ugandan Shilling",RWF:"Rwandan Franc",AOA:"Angolan Kwanza",
};

export const CRYPTOS = {
  BTC:{ name:"Bitcoin",  id:"bitcoin",       icon:"₿" },
  ETH:{ name:"Ethereum", id:"ethereum",      icon:"Ξ" },
  BNB:{ name:"BNB",      id:"binancecoin",   icon:"◆" },
  SOL:{ name:"Solana",   id:"solana",        icon:"◎" },
  XRP:{ name:"XRP",      id:"ripple",        icon:"✕" },
  ADA:{ name:"Cardano",  id:"cardano",       icon:"₳" },
  DOGE:{name:"Dogecoin", id:"dogecoin",      icon:"Ð" },
  USDT:{name:"Tether",   id:"tether",        icon:"₮" },
  MATIC:{name:"Polygon", id:"matic-network", icon:"⬡" },
  DOT:{ name:"Polkadot", id:"polkadot",      icon:"●" },
};

// ── Black Market Rates (DZD per 1 unit) ──────────
// Parallel market rates — static approximations, official fetched live
export const BLACK_MARKET_RATES = {
  USD: { official: null, parallel: 245.0, source: "manual" },
  EUR: { official: null, parallel: 269.5, source: "manual" },
  GBP: { official: null, parallel: 310.0, source: "manual" },
  SAR: { official: null, parallel: 65.2,  source: "manual" },
  AED: { official: null, parallel: 66.7,  source: "manual" },
  CAD: { official: null, parallel: 179.5, source: "manual" },
};
export const BM_LAST_UPDATE = "13/06/2026";

export const DEFAULT_FAVS = ["EUR","GBP","SAR","AED","DZD","MAD","CAD","JPY"];

// ── localStorage helpers ──────────────────────────
export function safeGetJSON(key, fallback = null) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch (err) {
    // Import lazily to avoid circular dependency
    import("./errors.js").then(({ logStorageError }) => logStorageError("safeGetJSON", err, { key })).catch(() => {});
    return fallback;
  }
}

export function safeSetJSON(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch (err) {
    import("./errors.js").then(({ logStorageError }) => logStorageError("safeSetJSON", err, { key })).catch(() => {});
    return false;
  }
}

export function getFavs() {
  return safeGetJSON("favCurrencies", DEFAULT_FAVS);
}

export function getAlerts() {
  return safeGetJSON("priceAlerts", []);
}

export function saveAlerts(alerts) {
  safeSetJSON("priceAlerts", alerts);
}

export function getHistory() {
  return safeGetJSON("convHistory", []);
}

export function saveHistory(history) {
  safeSetJSON("convHistory", history.slice(0, 20));
}

// ══════════════════════════════════════════════════════
//  VALIDATION LAYER
// ══════════════════════════════════════════════════════

/**
 * Validate rates object: must be a non-empty object with numeric values.
 */
export function validateRates(rates) {
  if (!rates || typeof rates !== "object" || Array.isArray(rates)) return false;
  const keys = Object.keys(rates);
  if (keys.length === 0) return false;
  return keys.every(k => typeof rates[k] === "number" && isFinite(rates[k]) && rates[k] >= 0);
}

/**
 * Validate a portfolio asset entry.
 */
export function validateAsset(asset) {
  if (!asset || typeof asset !== "object") return false;
  if (typeof asset.symbol !== "string" || !asset.symbol.trim()) return false;
  if (typeof asset.amount !== "number"   || !isFinite(asset.amount)   || asset.amount < 0) return false;
  if (typeof asset.buyPrice !== "number" || !isFinite(asset.buyPrice) || asset.buyPrice < 0) return false;
  return true;
}

/**
 * Validate a watchlist item.
 */
export function validateWatchItem(item) {
  if (!item || typeof item !== "object") return false;
  if (typeof item.symbol !== "string" || !item.symbol.trim()) return false;
  return ["fiat", "crypto", "metal"].includes(item.type);
}

/**
 * Validate a price alert entry.
 */
export function validateAlert(alert) {
  if (!alert || typeof alert !== "object") return false;
  if (typeof alert.from !== "string" || typeof alert.to !== "string") return false;
  if (typeof alert.target !== "number" || !isFinite(alert.target)) return false;
  return true;
}

// ══════════════════════════════════════════════════════
//  DATA SANITIZATION
// ══════════════════════════════════════════════════════

/**
 * Sanitize a string: strip control chars, trim.
 */
export function sanitizeStr(s, maxLen = 20) {
  if (typeof s !== "string") return "";
  return s.replace(/[^\w$€£¥₿]/g, "").slice(0, maxLen).toUpperCase();
}

/**
 * Sanitize a numeric value.
 */
export function sanitizeNum(v, fallback = 0, min = 0, max = Number.MAX_SAFE_INTEGER) {
  const n = parseFloat(v);
  if (!isFinite(n)) return fallback;
  return Math.max(min, Math.min(max, n));
}

/**
 * Sanitize portfolio data structure.
 */
export function sanitizePortfolio(data) {
  if (!data || typeof data !== "object" || !Array.isArray(data.assets)) {
    return { assets: [], updatedAt: null };
  }
  return {
    assets: data.assets
      .filter(validateAsset)
      .map(a => ({
        ...a,
        symbol:   sanitizeStr(a.symbol),
        amount:   sanitizeNum(a.amount,   0, 0),
        buyPrice: sanitizeNum(a.buyPrice, 0, 0),
      })),
    updatedAt: typeof data.updatedAt === "number" ? data.updatedAt : null,
  };
}

/**
 * Sanitize watchlist data structure.
 */
export function sanitizeWatchlist(data) {
  if (!data || typeof data !== "object" || !Array.isArray(data.items)) {
    return { items: [] };
  }
  return {
    items: data.items
      .filter(validateWatchItem)
      .map(i => ({
        symbol:   sanitizeStr(i.symbol),
        type:     ["fiat","crypto","metal"].includes(i.type) ? i.type : "fiat",
        addedAt:  typeof i.addedAt === "number" ? i.addedAt : Date.now(),
      })),
  };
}

// ══════════════════════════════════════════════════════
//  CORRUPTION RECOVERY
// ══════════════════════════════════════════════════════

const _RECOVERY_KEYS = [
  { key: "portfolioData",  fallback: { assets: [], updatedAt: null },  sanitize: sanitizePortfolio },
  { key: "watchlistData",  fallback: { items: [] },                    sanitize: sanitizeWatchlist },
  { key: "cachedRates",    fallback: null,                             sanitize: d => (validateRates(d?.rates) ? d : null) },
  { key: "cachedMetals",   fallback: null,                             sanitize: d => (d?.rates ? d : null) },
  { key: "priceAlerts",    fallback: [],                               sanitize: d => (Array.isArray(d) ? d.filter(validateAlert) : []) },
  { key: "favCurrencies",  fallback: DEFAULT_FAVS,                     sanitize: d => (Array.isArray(d) ? d.filter(s => typeof s === "string") : DEFAULT_FAVS) },
  { key: "convHistory",    fallback: [],                               sanitize: d => (Array.isArray(d) ? d.slice(0, 20) : []) },
];

/**
 * Scan localStorage for corrupt/invalid data and recover.
 * Returns a report of what was fixed.
 */
export function recoverCorruptStorage() {
  const report = { checked: 0, recovered: [], errors: [] };

  _RECOVERY_KEYS.forEach(({ key, fallback, sanitize }) => {
    report.checked++;
    const raw = localStorage.getItem(key);

    // Key doesn't exist — skip (not corrupt, just absent)
    if (raw === null) return;

    let parsed;
    try {
      parsed = JSON.parse(raw);
    } catch (parseErr) {
      // JSON is corrupt — reset to fallback
      import("./errors.js").then(({ logStorageError }) =>
        logStorageError("recoverCorruptStorage:parseErr", parseErr, { key })
      ).catch(() => {});
      if (fallback !== null) {
        try { localStorage.setItem(key, JSON.stringify(fallback)); } catch (_) {}
      } else {
        localStorage.removeItem(key);
      }
      report.recovered.push({ key, reason: "json_parse_error" });
      return;
    }

    // Sanitize and check if result differs
    if (sanitize) {
      let sanitized;
      try {
        sanitized = sanitize(parsed);
      } catch (sanitizeErr) {
        sanitized = fallback;
      }

      if (sanitized === null) {
        localStorage.removeItem(key);
        report.recovered.push({ key, reason: "invalid_structure_removed" });
        return;
      }

      const sanitizedStr = JSON.stringify(sanitized);
      if (sanitizedStr !== raw) {
        try {
          localStorage.setItem(key, sanitizedStr);
          report.recovered.push({ key, reason: "sanitized" });
        } catch (writeErr) {
          report.errors.push({ key, err: writeErr.message });
        }
      }
    }
  });

  return report;
}

/**
 * Run corruption check on app startup.
 * Call once from app.js after DOMContentLoaded.
 */
export function initStorageHealth() {
  try {
    const report = recoverCorruptStorage();
    if (report.recovered.length > 0) {
      console.info("[GM:Storage] Recovered corrupt keys:", report.recovered.map(r => r.key).join(", "));
    }
    return report;
  } catch (err) {
    console.warn("[GM:Storage] Health check failed:", err.message);
    return null;
  }
}
