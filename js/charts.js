// ═══════════════════════════════════════════════
//  Global Money — js/charts.js
//  TradingView widget only
// ═══════════════════════════════════════════════
import { state } from "./state.js";

// TradingView symbol map
const TV_SYMBOLS = {
  "FOREX:USD-EUR":"FX:EURUSD","FOREX:USD-GBP":"FX:GBPUSD","FOREX:USD-JPY":"FX:USDJPY",
  "FOREX:USD-CHF":"FX:USDCHF","FOREX:EUR-GBP":"FX:EURGBP","FOREX:EUR-JPY":"FX:EURJPY",
  "FOREX:GBP-JPY":"FX:GBPJPY","FOREX:USD-CAD":"FX:USDCAD","FOREX:USD-AUD":"FX:AUDUSD",
  "FOREX:USD-NZD":"FX:NZDUSD","FOREX:USD-CNY":"FX:USDCNH","FOREX:USD-TRY":"FX:USDTRY",
  "FOREX:USD-MAD":"FX:USDMAD",
  "CRYPTO:BTC-USD":"BINANCE:BTCUSDT","CRYPTO:ETH-USD":"BINANCE:ETHUSDT",
  "CRYPTO:BNB-USD":"BINANCE:BNBUSDT","CRYPTO:XRP-USD":"BINANCE:XRPUSDT",
  "CRYPTO:SOL-USD":"BINANCE:SOLUSDT","CRYPTO:ADA-USD":"BINANCE:ADAUSDT",
  "CRYPTO:DOGE-USD":"BINANCE:DOGEUSDT",
  "METALS:XAU-USD":"TVC:GOLD","METALS:XAG-USD":"TVC:SILVER"
};

const TF_TV = { "1m":"1","5m":"5","15m":"15","30m":"30","1h":"60","4h":"240","1d":"D" };

// ── TradingView Widget ────────────────────────────
export function renderTVWidget() {
  const container = document.getElementById("tvWidgetContainer");
  if (!container) return;

  // Force full re-render by wiping and recreating
  container.innerHTML = "";

  const tvSym = TV_SYMBOLS[state.chartPair];
  if (!tvSym) {
    container.innerHTML = `<div style="display:flex;align-items:center;justify-content:center;height:100%;color:var(--text2);font-size:.9rem;padding:20px;text-align:center;">⚠️ هذا الزوج غير متاح على TradingView.</div>`;
    return;
  }

  const dark = document.body.classList.contains("dark");
  const tf   = TF_TV[state.chartTF] || "60";

  // Use iframe embed which is more reliable for pair switching
  const widgetConfig = {
    autosize: true,
    symbol: tvSym,
    interval: tf,
    timezone: "Etc/UTC",
    theme: dark ? "dark" : "light",
    style: "1",
    locale: "en",
    enable_publishing: false,
    hide_top_toolbar: false,
    hide_legend: false,
    save_image: false,
    allow_symbol_change: false,
    container_id: "tvWidgetContainer"
  };

  const wrap  = document.createElement("div");
  wrap.className = "tradingview-widget-container";
  wrap.style.cssText = "width:100%;height:520px;";
  const inner = document.createElement("div");
  inner.className = "tradingview-widget-container__widget";
  inner.style.cssText = "height:calc(100% - 32px);width:100%;";
  const s = document.createElement("script");
  s.src = "https://s3.tradingview.com/external-embedding/embed-widget-advanced-chart.js";
  s.async = true;
  s.textContent = JSON.stringify(widgetConfig);
  wrap.appendChild(inner);
  wrap.appendChild(s);
  container.appendChild(wrap);
}

// ── Mode switches (kept for compat, always TradingView) ─────────
export function switchChartMode(mode) {
  state.setChartMode("tradingview");
  renderTVWidget();
}

export function onChartPairChange() {
  const el = document.getElementById("chartPairSel");
  if (el) state.setChartPair(el.value);
  renderTVWidget();
}

export function setChartTF(tf) {
  state.setChartTF(tf);
  renderTVWidget();
}

export function setChartType(ct) {
  state.setChartType(ct);
  // No-op for TradingView (widget has its own controls)
}

export function drawChart(from, to) {
  const synth = `FOREX:${from}-${to}`;
  const el = document.getElementById("chartPairSel");
  if (el) {
    const opts = Array.from(el.options).map(o => o.value);
    if (opts.includes(synth)) { el.value = synth; state.setChartPair(synth); }
    // If not found, keep current pair in select but load TV anyway
  }
  renderTVWidget();
}

export function renderLWChart() {
  // Redirects to TradingView
  renderTVWidget();
}

// Expose globally
window.switchChartMode  = switchChartMode;
window.onChartPairChange = onChartPairChange;
window.setChartTF       = setChartTF;
window.setChartType     = setChartType;
