// ═══════════════════════════════════════════════
//  Global Money v5 — js/api.js (enhanced)
// ═══════════════════════════════════════════════
import { state } from "./state.js";
import { CACHE_DURATION, CRYPTOS, BLACK_MARKET_RATES, safeGetJSON, safeSetJSON } from "./storage.js";
import { logApiError } from "./errors.js";

const FETCH_TIMEOUT_MS = 8000;
const MAX_RETRIES      = 2;

function _isValidUrl(url) {
  try { new URL(url); return true; } catch { return false; }
}
function _validateFiatResponse(data) {
  return data && data.result === "success" && data.rates
    && typeof data.rates === "object" && Object.keys(data.rates).length > 0;
}
function _validateFrankfurterResponse(data) {
  return data && data.rates && typeof data.rates === "object"
    && Object.keys(data.rates).length > 0;
}
function _validateMetalsLiveResponse(data) {
  const d = Array.isArray(data) ? data[0] : data;
  return d && (d.gold || d.silver || d.platinum || d.palladium);
}

export const dataStatus = {
  fiat:   { source: null, live: false, lastUpdate: null },
  crypto: { source: null, live: false, lastUpdate: null },
  metals: { source: null, live: false, lastUpdate: null },
};

function setStatus(type, source, live) {
  dataStatus[type].source     = source;
  dataStatus[type].live       = live;
  dataStatus[type].lastUpdate = new Date();
  _updateStatusIndicator();
}

function _updateStatusIndicator() {
  const el = document.getElementById("dataStatusBar");
  if (!el) return;
  const t  = new Date();
  const ts = `${t.getHours().toString().padStart(2,"0")}:${t.getMinutes().toString().padStart(2,"0")}:${t.getSeconds().toString().padStart(2,"0")}`;
  el.innerHTML = `
    <span class="ds-dot ${dataStatus.fiat.live   ? "ds-live" : "ds-cached"}"></span>
    <span class="ds-label">Fiat: ${dataStatus.fiat.source   || "..."}</span>
    <span class="ds-dot ${dataStatus.crypto.live ? "ds-live" : "ds-cached"}"></span>
    <span class="ds-label">Crypto: ${dataStatus.crypto.source || "..."}</span>
    <span class="ds-dot ${dataStatus.metals.live ? "ds-live" : "ds-cached"}"></span>
    <span class="ds-label">Metals: ${dataStatus.metals.source || "..."}</span>
    <span class="ds-time">⏱ ${ts}</span>
  `;
}

async function fetchWithTimeout(url, options = {}, timeoutMs = FETCH_TIMEOUT_MS) {
  if (!_isValidUrl(url)) return { data: null, error: new Error("Invalid URL") };
  const controller = new AbortController();
  const timer      = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res  = await fetch(url, { ...options, signal: controller.signal });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    return { data, error: null };
  } catch (err) {
    logApiError("fetchWithTimeout", err, { url });
    return { data: null, error: err };
  } finally {
    clearTimeout(timer);
  }
}

async function fetchWithRetry(url, options = {}, retries = MAX_RETRIES) {
  for (let attempt = 0; attempt <= retries; attempt++) {
    const { data, error } = await fetchWithTimeout(url, options);
    if (data !== null) return { data, error: null };
    if (attempt < retries) await new Promise(r => setTimeout(r, 800 * (attempt + 1)));
    else return { data: null, error };
  }
}

let _analyticsModule = null;
async function _notifyAnalytics() {
  try {
    if (!_analyticsModule) _analyticsModule = await import("./analytics.js");
    _analyticsModule.onRatesLoaded(state.fiatRates, state.cryptoRates, { ...getMetalsRates() });
  } catch { /* optional */ }
}

// ── Fiat Rates ─────────────────────────────────
export async function loadFiat() {
  const cached = safeGetJSON("cachedRates");
  if (cached?.time && (Date.now() - cached.time < CACHE_DURATION)) {
    state.setFiatRates(cached.rates);
    updateBlackMarketOfficialRates();
    setStatus("fiat", "Cache", false);
    _callBMSync();
    return { fromCache: true };
  }

  const { data } = await fetchWithRetry("https://open.er-api.com/v6/latest/USD");
  if (_validateFiatResponse(data)) {
    state.setFiatRates(data.rates);
    safeSetJSON("cachedRates", { rates: data.rates, time: Date.now() });
    updateBlackMarketOfficialRates();
    setStatus("fiat", "ExchangeRate-API ✓", true);
    _callBMSync();
    _notifyAnalytics();
    return { fromCache: false };
  }

  const { data: d2 } = await fetchWithRetry("https://api.frankfurter.app/latest?from=USD");
  if (_validateFrankfurterResponse(d2)) {
    d2.rates.USD = 1;
    state.setFiatRates(d2.rates);
    safeSetJSON("cachedRates", { rates: d2.rates, time: Date.now() });
    updateBlackMarketOfficialRates();
    setStatus("fiat", "Frankfurter ✓", true);
    _callBMSync();
    _notifyAnalytics();
    return { fromCache: false };
  }

  const stale = safeGetJSON("cachedRates");
  if (stale?.rates) {
    state.setFiatRates(stale.rates);
    updateBlackMarketOfficialRates();
    setStatus("fiat", "Stale Cache ⚠", false);
    return { fromCache: true, stale: true };
  }
  throw new Error("Failed to load fiat rates");
}

// ── Crypto — Binance WebSocket ──────────────────
let _binanceWs           = null;
let _wsConnected         = false;
let _wsReconnectTimer    = null;
let _wsReconnectAttempts = 0;
const MAX_WS_RECONNECTS  = 10;

// Extended symbol list including MATIC(POL), AVAX, LINK, UNI, LTC, ATOM, TRX, SHIB, NEAR
const _binanceSymbols = [
  "btcusdt","ethusdt","bnbusdt","solusdt","xrpusdt",
  "adausdt","dogeusdt","dotusdt","polusdt","avaxusdt",
  "linkusdt","uniusdt","ltcusdt","atomusdt","trxusdt",
  "shibusdt","nearusdt"
];
const _symMap = {
  btcusdt:"BTC",  ethusdt:"ETH",  bnbusdt:"BNB",  solusdt:"SOL",
  xrpusdt:"XRP",  adausdt:"ADA",  dogeusdt:"DOGE", dotusdt:"DOT",
  polusdt:"MATIC", maticusdt:"MATIC", avaxusdt:"AVAX", linkusdt:"LINK", uniusdt:"UNI",
  ltcusdt:"LTC",  atomusdt:"ATOM", trxusdt:"TRX",  shibusdt:"SHIB",
  nearusdt:"NEAR"
};

export function getCryptoWsConnected() { return _wsConnected; }

function _startBinanceWS() {
  if (_binanceWs && _binanceWs.readyState <= 1) return;
  if (_wsReconnectAttempts >= MAX_WS_RECONNECTS) {
    setStatus("crypto", "WS Max Retries ✗", false);
    return;
  }

  const streams = _binanceSymbols.map(s => `${s}@ticker`).join("/");
  const wsUrl   = `wss://stream.binance.com:9443/stream?streams=${streams}`;

  try {
    _binanceWs = new WebSocket(wsUrl);

    _binanceWs.onopen = () => {
      _wsConnected        = true;
      _wsReconnectAttempts = 0;
      setStatus("crypto", "Binance WS 🔴", true);
      if (_wsReconnectTimer) { clearTimeout(_wsReconnectTimer); _wsReconnectTimer = null; }
    };

    _binanceWs.onmessage = (evt) => {
      try {
        const msg = JSON.parse(evt.data);
        const d   = msg.data;
        if (!d || !d.s) return;
        const sym = _symMap[d.s.toLowerCase()];
        if (!sym) return;
        const price = parseFloat(d.c);
        if (isNaN(price) || price <= 0) return;

        const rates = { ...state.cryptoRates };
        rates[sym]  = price;
        rates.USDT  = rates.USDT || 1;

        state.setCryptoChange24h(sym, parseFloat(d.P));
        state.setCryptoRates(rates);
        setStatus("crypto", "Binance WS 🔴", true);

        import("./ticker.js").then(m => m.refreshTickerSymbol && m.refreshTickerSymbol(sym, price)).catch(() => {});
        if (state.cryptoPageOpen) {
          state.clearCryptoRenderDebounce();
          state.setCryptoRenderDebounce(setTimeout(() => {
            import("./converter.js").then(m => m.renderCryptoPrices && m.renderCryptoPrices()).catch(() => {});
          }, 800));
        }
      } catch { /* ignore parse errors */ }
    };

    _binanceWs.onerror = () => { _wsConnected = false; };

    _binanceWs.onclose = () => {
      _wsConnected = false;
      _wsReconnectAttempts++;
      setStatus("crypto", `WS Reconnecting… (${_wsReconnectAttempts})`, false);
      const delay = Math.min(5000 * Math.pow(1.5, _wsReconnectAttempts - 1), 60000);
      _wsReconnectTimer = setTimeout(_startBinanceWS, delay);
    };
  } catch {
    _fallbackCryptoHTTP();
  }
}

async function _fallbackCryptoHTTP() {
  // CoinGecko — all cryptos including MATIC
  const ids      = Object.values(CRYPTOS).map(c => c.id).join(",");
  const { data } = await fetchWithRetry(
    `https://api.coingecko.com/api/v3/simple/price?ids=${ids}&vs_currencies=usd&include_24hr_change=true`
  );
  if (data && typeof data === "object") {
    const rates = {};
    Object.entries(CRYPTOS).forEach(([sym, info]) => {
      if (data[info.id]?.usd && data[info.id].usd > 0) {
        rates[sym] = data[info.id].usd;
        state.setCryptoChange24h(sym, data[info.id].usd_24h_change || 0);
      }
    });
    if (Object.keys(rates).length > 0) {
      rates.USDT = rates.USDT || 1;
      state.setCryptoRates(rates);
      setStatus("crypto", "CoinGecko ✓", true);
      return;
    }
  }

  // Binance REST fallback — extended list
  const binancePairs = [
    "BTCUSDT","ETHUSDT","BNBUSDT","SOLUSDT","XRPUSDT",
    "ADAUSDT","DOGEUSDT","DOTUSDT","POLUSDT","AVAXUSDT",
    "LINKUSDT","UNIUSDT","LTCUSDT","ATOMUSDT","TRXUSDT"
  ];
  const symbolMap = {
    BTCUSDT:"BTC", ETHUSDT:"ETH", BNBUSDT:"BNB", SOLUSDT:"SOL", XRPUSDT:"XRP",
    ADAUSDT:"ADA", DOGEUSDT:"DOGE", DOTUSDT:"DOT", POLUSDT:"MATIC", MATICUSDT:"MATIC", AVAXUSDT:"AVAX",
    LINKUSDT:"LINK", UNIUSDT:"UNI", LTCUSDT:"LTC", ATOMUSDT:"ATOM", TRXUSDT:"TRX"
  };
  try {
    const { data: binData } = await fetchWithRetry(
      "https://api.binance.com/api/v3/ticker/24hr?symbols=" + JSON.stringify(binancePairs)
    );
    if (binData && Array.isArray(binData)) {
      const rates = { ...state.cryptoRates };
      binData.forEach(item => {
        const sym   = symbolMap[item.symbol];
        const price = parseFloat(item.lastPrice);
        if (sym && price > 0) {
          rates[sym] = price;
          state.setCryptoChange24h(sym, parseFloat(item.priceChangePercent));
        }
      });
      rates.USDT = rates.USDT || 1;
      state.setCryptoRates(rates);
      setStatus("crypto", "Binance REST ✓", true);
    }
  } catch (e) {
    logApiError("_fallbackCryptoHTTP:binanceREST", e);
    setStatus("crypto", "Unavailable ✗", false);
  }
}

export async function loadCrypto() {
  _startBinanceWS();
  await _fallbackCryptoHTTP();
}

// ── Metals ──────────────────────────────────────
let metalsRates     = {};
let metalsPrevRates = {};
let metalsLastUpdate = null;

export function getMetalsRates()     { return metalsRates; }
export function getMetalsPrevRates() { return metalsPrevRates; }
export function getMetalsLastUpdate() { return metalsLastUpdate; }

export async function loadMetals() {
  const cached = safeGetJSON("cachedMetals");
  if (cached?.time && (Date.now() - cached.time < CACHE_DURATION)) {
    metalsPrevRates  = { ...metalsRates };
    metalsRates      = { ...cached.rates };
    metalsLastUpdate = new Date(cached.time);
    setStatus("metals", "Cache", false);
    _notifyMetalsLoaded();
    return { fromCache: true };
  }

  if (Object.keys(metalsRates).length > 0) metalsPrevRates = { ...metalsRates };

  const { data: d1 } = await fetchWithRetry("https://api.metals.live/v1/spot/gold,silver,platinum,palladium");
  if (d1 && _validateMetalsLiveResponse(d1)) {
    const d = Array.isArray(d1) ? d1[0] : d1;
    if (d.gold      && d.gold > 0)      metalsRates.XAU = d.gold;
    if (d.silver    && d.silver > 0)    metalsRates.XAG = d.silver;
    if (d.platinum  && d.platinum > 0)  metalsRates.XPT = d.platinum;
    if (d.palladium && d.palladium > 0) metalsRates.XPD = d.palladium;
    if (Object.keys(metalsRates).length >= 2) {
      metalsLastUpdate = new Date();
      safeSetJSON("cachedMetals", { rates: metalsRates, time: Date.now(), prev: metalsPrevRates });
      setStatus("metals", "metals.live ✓", true);
      _notifyMetalsLoaded();
      _notifyAnalytics();
      return { fromCache: false };
    }
  }

  const { data: d2 } = await fetchWithRetry("https://data-asg.goldprice.org/dbXRates/USD");
  if (d2?.items?.[0]) {
    const item = d2.items[0];
    if (item.xauPrice && item.xauPrice > 0) metalsRates.XAU = item.xauPrice;
    if (item.xagPrice && item.xagPrice > 0) metalsRates.XAG = item.xagPrice;
    if (Object.keys(metalsRates).length >= 1) {
      metalsLastUpdate = new Date();
      safeSetJSON("cachedMetals", { rates: metalsRates, time: Date.now(), prev: metalsPrevRates });
      setStatus("metals", "GoldPrice.org ✓", true);
      _notifyMetalsLoaded();
      return { fromCache: false };
    }
  }

  if (cached?.rates) {
    metalsRates      = { ...cached.rates };
    if (cached.prev) metalsPrevRates = cached.prev;
    metalsLastUpdate = null;
    setStatus("metals", "Stale Cache ⚠", false);
    _notifyMetalsLoaded();
    return { fromCache: true, stale: true };
  }

  const { METALS_DATA } = await import("./metals.js");
  Object.entries(METALS_DATA).forEach(([sym, d]) => {
    if (!metalsRates[sym]) metalsRates[sym] = d.fallback;
  });
  metalsLastUpdate = null;
  setStatus("metals", "Fallback ⚠", false);
  _notifyMetalsLoaded();
  return { fromCache: false, fallback: true };
}

function _notifyMetalsLoaded() {
  import("./metals.js").then(({ setMetalsPrevClose }) => {
    setMetalsPrevClose(metalsPrevRates);
  }).catch(() => {});
}

export function startAutoRefresh(onRefresh) {
  setInterval(async () => {
    try {
      const { data } = await fetchWithRetry("https://open.er-api.com/v6/latest/USD");
      if (_validateFiatResponse(data)) {
        state.setFiatRates(data.rates);
        safeSetJSON("cachedRates", { rates: data.rates, time: Date.now() });
        updateBlackMarketOfficialRates();
        setStatus("fiat", "ExchangeRate-API ✓", true);
        _callBMSync();
        _notifyAnalytics();
        if (onRefresh) onRefresh();
      }
    } catch (err) { logApiError("autoRefresh:fiat", err); }
  }, 5 * 60 * 1000);

  setInterval(async () => {
    if (!_wsConnected) await _fallbackCryptoHTTP();
  }, 60_000);

  setInterval(async () => {
    try { await loadMetals(); } catch { /* ignore */ }
  }, 5 * 60 * 1000);

  setInterval(_updateStatusIndicator, 1000);
}

function updateBlackMarketOfficialRates() {
  const rates = state.fiatRates;
  Object.keys(BLACK_MARKET_RATES).forEach(cur => {
    if (rates[cur] && rates["DZD"])
      BLACK_MARKET_RATES[cur].official = rates["DZD"] / rates[cur];
  });
}

function _callBMSync() {
  import("./blackmarket.js").then(({ syncBlackMarketRates }) => {
    syncBlackMarketRates();
  }).catch(() => {});
}
