// ═══════════════════════════════════════════════
//  Global Money v4.2 — js/state.js
//  Centralized application state with controlled mutations
//  v4.2: Added crypto UI state (cryptoChange24h, cryptoPageOpen, cryptoRenderDebounce)
//        to replace global window.* variables
// ═══════════════════════════════════════════════

const _state = {
  // Currency data
  fiatRates: {},
  cryptoRates: {},
  allFiatCodes: [],

  // Selected currencies
  fromSel: "USD",
  toSel: "DZD",
  cryptoFrom: "BTC",
  cryptoTo: "USDT",

  // UI
  currentPage: "home",
  lang: localStorage.getItem("lang") || "en",
  lastRate: 1,
  deferredInstallPrompt: null,

  // Chart
  chartMode: "tradingview",
  chartPair: "FOREX:USD-EUR",
  chartTF: "1m",
  chartType: "line",

  // ── Crypto UI State (previously window.* globals) ──
  // window._cryptoChange24h → state.cryptoChange24h
  cryptoChange24h: {},
  // window.__gmCryptoPageOpen → state.cryptoPageOpen
  cryptoPageOpen: false,
  // window.__gmCryptoRenderDebounce → state.cryptoRenderDebounce
  cryptoRenderDebounce: null,

  // ── Analytics consent ──
  analyticsConsent: localStorage.getItem("gm_analytics_consent") || null, // "granted" | "denied" | null
};

export const state = {
  // ── Getters ──────────────────────────────────────
  get fiatRates()    { return _state.fiatRates; },
  get cryptoRates()  { return _state.cryptoRates; },
  get allFiatCodes() { return _state.allFiatCodes; },
  get fromSel()      { return _state.fromSel; },
  get toSel()        { return _state.toSel; },
  get cryptoFrom()   { return _state.cryptoFrom; },
  get cryptoTo()     { return _state.cryptoTo; },
  get currentPage()  { return _state.currentPage; },
  get lang()         { return _state.lang; },
  get lastRate()     { return _state.lastRate; },
  get deferredInstallPrompt() { return _state.deferredInstallPrompt; },
  get chartMode()    { return _state.chartMode; },
  get chartPair()    { return _state.chartPair; },
  get chartTF()      { return _state.chartTF; },
  get chartType()    { return _state.chartType; },

  // Crypto UI state getters
  get cryptoChange24h()      { return _state.cryptoChange24h; },
  get cryptoPageOpen()       { return _state.cryptoPageOpen; },
  get cryptoRenderDebounce() { return _state.cryptoRenderDebounce; },

  // Analytics consent
  get analyticsConsent() { return _state.analyticsConsent; },

  // ── Setters ──────────────────────────────────────
  setFiatRates(rates) {
    _state.fiatRates = rates;
    _state.allFiatCodes = Object.keys(rates).sort();
  },
  setCryptoRates(rates)    { _state.cryptoRates = rates; },
  setFromSel(code)         { _state.fromSel = code; },
  setToSel(code)           { _state.toSel = code; },
  setCryptoFrom(code)      { _state.cryptoFrom = code; },
  setCryptoTo(code)        { _state.cryptoTo = code; },
  setCurrentPage(page)     { _state.currentPage = page; },
  setLastRate(rate)        { _state.lastRate = rate; },
  setInstallPrompt(prompt) { _state.deferredInstallPrompt = prompt; },
  setLang(lang) {
    _state.lang = lang;
    localStorage.setItem("lang", lang);
  },
  setChartMode(mode) { _state.chartMode = mode; },
  setChartPair(pair) { _state.chartPair = pair; },
  setChartTF(tf)     { _state.chartTF = tf; },
  setChartType(ct)   { _state.chartType = ct; },

  // Crypto UI state setters
  setCryptoChange24h(sym, value) {
    _state.cryptoChange24h[sym] = value;
  },
  setCryptoChange24hBatch(obj) {
    _state.cryptoChange24h = { ..._state.cryptoChange24h, ...obj };
  },
  setCryptoPageOpen(open) {
    _state.cryptoPageOpen = !!open;
  },
  setCryptoRenderDebounce(timer) {
    _state.cryptoRenderDebounce = timer;
  },
  clearCryptoRenderDebounce() {
    if (_state.cryptoRenderDebounce) {
      clearTimeout(_state.cryptoRenderDebounce);
      _state.cryptoRenderDebounce = null;
    }
  },

  // Analytics consent setter
  setAnalyticsConsent(value) {
    _state.analyticsConsent = value;
    localStorage.setItem("gm_analytics_consent", value);
  },

  // Swap helpers
  swapFiat() {
    [_state.fromSel, _state.toSel] = [_state.toSel, _state.fromSel];
  },
  swapCrypto() {
    [_state.cryptoFrom, _state.cryptoTo] = [_state.cryptoTo, _state.cryptoFrom];
  },
};
