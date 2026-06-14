// ═══════════════════════════════════════════════
//  Global Money — js/charts.js
//  Lightweight Charts + TradingView widget
// ═══════════════════════════════════════════════
import { state } from "./state.js";
import { BLACK_MARKET_RATES, safeGetJSON, safeSetJSON } from "./storage.js";
import { logChartError } from "./errors.js";

let lwChart  = null;
let lwSeries = null;
let lwLibLoaded = false;
let dzdUpdateTimer = null;

// TF in minutes
const TF_MINUTES = { "1m":1,"5m":5,"15m":15,"30m":30,"1h":60,"4h":240,"1d":1440 };

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

// ── DZD History ───────────────────────────────────
function getDzdRate(pair) {
  const cur = pair.replace("DZD:","").split("-")[0];
  if (BLACK_MARKET_RATES[cur]?.parallel) return BLACK_MARKET_RATES[cur].parallel;
  const { fiatRates } = state;
  if (fiatRates[cur] && fiatRates["DZD"]) return fiatRates["DZD"] / fiatRates[cur];
  return null;
}

function dzdLsKey(pair, tf) { return `dzdHist_${pair}_${tf}`; }

function dzdLoadHistory(pair, tf) {
  const arr = safeGetJSON(dzdLsKey(pair, tf), []);
  const cutoff = Date.now() - 24 * 3600 * 1000;
  return arr.filter(p => p.time * 1000 > cutoff);
}

function dzdSaveHistory(pair, tf, arr) {
  const cutoff = Date.now() - 24 * 3600 * 1000;
  const trimmed = arr.filter(p => p.time * 1000 > cutoff).slice(-2000);
  safeSetJSON(dzdLsKey(pair, tf), trimmed);
}

function buildDzdHistory(pair, tf) {
  const existing = dzdLoadHistory(pair, tf);
  const rate = getDzdRate(pair);
  if (!rate) return existing;

  const tfMin = TF_MINUTES[tf] || 1;
  const now   = Math.floor(Date.now() / (tfMin * 60000)) * (tfMin * 60);

  if (!existing.length) {
    const bars = Math.ceil(1440 / tfMin);
    const hist = [];
    let r = rate * (1 + (Math.random() - 0.5) * 0.02);
    for (let i = bars; i >= 0; i--) {
      const t     = now - i * tfMin * 60;
      const open  = r;
      const close = r * (1 + (Math.random() - 0.498) * 0.003);
      const high  = Math.max(open, close) * (1 + Math.random() * 0.002);
      const low   = Math.min(open, close) * (1 - Math.random() * 0.002);
      hist.push({ time: t, open, high, low, close });
      r = close;
    }
    if (hist.length) {
      const l = hist[hist.length - 1];
      l.close = rate; l.high = Math.max(l.high, rate); l.low = Math.min(l.low, rate);
    }
    dzdSaveHistory(pair, tf, hist);
    return hist;
  }

  const last = existing[existing.length - 1];
  if (last.time === now) {
    last.close = rate; last.high = Math.max(last.high, rate); last.low = Math.min(last.low, rate);
  } else {
    existing.push({ time: now, open: last.close, high: rate, low: rate, close: rate });
  }
  dzdSaveHistory(pair, tf, existing);
  return existing;
}

// ── Price Info Bar ────────────────────────────────
function updatePriceInfoBar(pair, data) {
  if (!data?.length) return;
  const last  = data[data.length - 1];
  const first = data[0];
  const price = last.close !== undefined ? last.close : last.value;
  const high  = data.reduce((m, p) => Math.max(m, p.high  || p.value || p.close || 0), -Infinity);
  const low   = data.reduce((m, p) => Math.min(m, p.low   || p.value || p.close || Infinity), Infinity);
  const open0 = first.open !== undefined ? first.open : first.value;
  const chg   = price && open0 ? ((price - open0) / open0 * 100) : 0;
  const dec   = price > 100 ? 2 : price > 1 ? 4 : 6;

  const safe = (id, text) => { const e = document.getElementById(id); if (e) e.textContent = text; };
  safe("pi-price",   price ? price.toFixed(dec) : "—");
  safe("pi-high",    isFinite(high) ? high.toFixed(dec) : "—");
  safe("pi-low",     isFinite(low)  ? low.toFixed(dec)  : "—");
  safe("pi-updated", new Date().toLocaleTimeString());

  const chgEl = document.getElementById("pi-change");
  if (chgEl) {
    chgEl.textContent = (chg >= 0 ? "+" : "") + chg.toFixed(2) + "%";
    chgEl.className   = "pi-val " + (chg >= 0 ? "pi-green" : "pi-red");
  }
}

// ── Lightweight Charts ────────────────────────────
async function ensureLWLib() {
  if (lwLibLoaded) return;
  await new Promise((res, rej) => {
    const s = document.createElement("script");
    s.src = "https://unpkg.com/lightweight-charts@4.1.3/dist/lightweight-charts.standalone.production.js";
    s.onload = () => { lwLibLoaded = true; res(); };
    s.onerror = rej;
    document.head.appendChild(s);
  });
}

async function buildLWChart() {
  await ensureLWLib();
  const container = document.getElementById("lwChartContainer");
  if (!container) return;

  if (lwChart) { lwChart.remove(); lwChart = null; lwSeries = null; }

  const dark = document.body.classList.contains("dark");
  lwChart = LightweightCharts.createChart(container, {
    width:  container.clientWidth,
    height: 420,
    layout: {
      background: { color: dark ? "#131722" : "#ffffff" },
      textColor:  dark ? "#9aaecb" : "#4a5568"
    },
    grid: {
      vertLines: { color: dark ? "#1e2a3a" : "#edf2f7" },
      horzLines: { color: dark ? "#1e2a3a" : "#edf2f7" }
    },
    crosshair: { mode: LightweightCharts.CrosshairMode.Normal },
    rightPriceScale: { borderColor: dark ? "#2d3a4e" : "#e2e8f0" },
    timeScale: { borderColor: dark ? "#2d3a4e" : "#e2e8f0", timeVisible: true, secondsVisible: false }
  });

  const ro = new ResizeObserver(() => {
    if (lwChart) lwChart.applyOptions({ width: container.clientWidth });
  });
  ro.observe(container);
}

function buildSyntheticData(pair, tf) {
  const parts = pair.split(":")[1].split("-");
  const from = parts[0], to = parts[1];
  const { fiatRates } = state;
  if (!fiatRates[from] || !fiatRates[to]) return null;
  const baseRate = fiatRates[to] / fiatRates[from];

  const tfMin = TF_MINUTES[tf] || 1;
  const bars  = Math.min(Math.ceil(1440 / tfMin), 500);
  const now   = Math.floor(Date.now() / (tfMin * 60000)) * (tfMin * 60);
  const data  = [];
  let r = baseRate * (1 + (Math.random() - 0.5) * 0.015);

  for (let i = bars; i >= 0; i--) {
    const t = now - i * tfMin * 60;
    const open  = r;
    const close = r * (1 + (Math.random() - 0.498) * 0.002);
    const high  = Math.max(open, close) * (1 + Math.random() * 0.001);
    const low   = Math.min(open, close) * (1 - Math.random() * 0.001);
    data.push({ time: t, open, high, low, close });
    r = close;
  }
  if (data.length) {
    const l = data[data.length - 1];
    l.close = baseRate; l.high = Math.max(l.high, baseRate); l.low = Math.min(l.low, baseRate);
  }
  return data;
}

export async function renderLWChart() {
  await buildLWChart();
  if (!lwChart) return;

  const { chartPair: pair, chartTF, chartType } = state;
  const isDZD = pair.startsWith("DZD:");
  const rawData = isDZD ? buildDzdHistory(pair, chartTF) : buildSyntheticData(pair, chartTF);

  const noteEl = document.getElementById("lwChartNote");
  if (!rawData?.length) {
    if (noteEl) noteEl.textContent = "⚠️ No data available for this pair.";
    return;
  }

  rawData.sort((a, b) => a.time - b.time);

  if (lwSeries) { try { lwChart.removeSeries(lwSeries); } catch(e) {} lwSeries = null; }

  if (chartType === "candlestick") {
    lwSeries = lwChart.addCandlestickSeries({
      upColor:"#22c55e",downColor:"#ef4444",
      borderUpColor:"#22c55e",borderDownColor:"#ef4444",
      wickUpColor:"#22c55e",wickDownColor:"#ef4444"
    });
    lwSeries.setData(rawData);
  } else {
    lwSeries = lwChart.addLineSeries({
      color:"#1d6aff",lineWidth:2,
      crosshairMarkerVisible:true,lastValueVisible:true,priceLineVisible:true
    });
    const lineData = rawData.map(p => ({ time: p.time, value: p.close ?? p.value }));
    lwSeries.setData(lineData);
  }

  lwChart.timeScale().fitContent();
  if (noteEl) noteEl.textContent = isDZD
    ? "⚠️ Parallel market rates – updated every 60s"
    : "* Synthetic chart based on live rates";

  updatePriceInfoBar(pair, rawData);

  if (dzdUpdateTimer) clearInterval(dzdUpdateTimer);
  if (isDZD) {
    dzdUpdateTimer = setInterval(() => {
      if (state.chartMode === "lightweight" && state.chartPair === pair) renderLWChart();
    }, 60000);
  }
}

// ── TradingView Widget ────────────────────────────
let _tvWidgetCounter = 0;
export function renderTVWidget() {
  const container = document.getElementById("tvWidgetContainer");
  if (!container) return;
  // Force full re-render by clearing and using unique ID
  container.innerHTML = "";
  _tvWidgetCounter++;
  const uid = "tv_widget_" + _tvWidgetCounter;
  container.id = uid;
  // Reset back to standard ID after render
  setTimeout(() => { container.id = "tvWidgetContainer"; }, 100);

  const tvSym = TV_SYMBOLS[state.chartPair];
  if (!tvSym) {
    const msg = document.createElement("div");
    msg.style.cssText = "display:flex;align-items:center;justify-content:center;height:100%;color:var(--text2);font-size:.9rem;padding:20px;text-align:center;";
    msg.textContent = "⚠️ This pair is not available on TradingView. Please switch to Lightweight Charts mode for DZD pairs.";
    container.appendChild(msg);
    return;
  }

  const dark = document.body.classList.contains("dark");
  const wrap  = document.createElement("div");
  wrap.className = "tradingview-widget-container";
  wrap.style.cssText = "width:100%;height:500px;";
  const inner = document.createElement("div");
  inner.className = "tradingview-widget-container__widget";
  inner.style.cssText = "height:calc(100% - 32px);width:100%;";
  const s = document.createElement("script");
  s.src = "https://s3.tradingview.com/external-embedding/embed-widget-advanced-chart.js";
  s.async = true;
  s.textContent = JSON.stringify({
    symbol: tvSym,
    interval: TF_TV[state.chartTF] || "60",
    timezone: "Etc/UTC",
    theme: dark ? "dark" : "light",
    style: "1",
    locale: "en",
    toolbar_bg: dark ? "#131722" : "#f8f9fa",
    enable_publishing: false,
    hide_top_toolbar: false,
    hide_legend: false,
    save_image: false,
    container_id: uid,
    autosize: true,
    height: "500"
  });
  wrap.appendChild(inner);
  wrap.appendChild(s);
  container.appendChild(wrap);
}

// ── Mode / TF / Type switches ─────────────────────
export function switchChartMode(mode) {
  state.setChartMode(mode);
  document.querySelectorAll(".chart-mode-btn").forEach(b =>
    b.classList.toggle("active", b.dataset.mode === mode)
  );
  const lwWrap  = document.getElementById("lwChartWrap");
  const tvWrap  = document.getElementById("tvChartWrap");
  const tfBtns  = document.getElementById("tfBtns");
  const ctBtns  = document.getElementById("chartTypeBtns");
  const piBar   = document.getElementById("priceInfoBar");

  if (mode === "lightweight") {
    lwWrap.style.display = ""; tvWrap.style.display = "none";
    tfBtns.style.display = ""; ctBtns.style.display = "";
    piBar.style.display  = "";
    renderLWChart();
  } else {
    lwWrap.style.display = "none"; tvWrap.style.display = "";
    piBar.style.display  = "none";
    renderTVWidget();
  }
}

export function onChartPairChange() {
  const el = document.getElementById("chartPairSel");
  if (el) state.setChartPair(el.value);
  if (state.chartMode === "lightweight") renderLWChart(); else renderTVWidget();
}

// ── Performance: debounce chart re-renders ────────
let _chartRenderTimer = null;
function _debouncedChartRender(ms = 150) {
  clearTimeout(_chartRenderTimer);
  _chartRenderTimer = setTimeout(() => {
    if (state.chartMode === "lightweight") renderLWChart();
  }, ms);
}

export function setChartTF(tf) {
  state.setChartTF(tf);
  document.querySelectorAll(".tf-btn").forEach(b => b.classList.toggle("active", b.dataset.tf === tf));
  _debouncedChartRender(100);
}

export function setChartType(ct) {
  state.setChartType(ct);
  document.querySelectorAll(".ct-btn").forEach(b => b.classList.toggle("active", b.dataset.ct === ct));
  _debouncedChartRender(100);
}

export function drawChart(from, to) {
  const synth = `FOREX:${from}-${to}`;
  const el = document.getElementById("chartPairSel");
  if (el) {
    const opts = Array.from(el.options).map(o => o.value);
    if (opts.includes(synth)) { el.value = synth; state.setChartPair(synth); }
  }
  if (state.chartMode === "lightweight") renderLWChart();
}

// Expose globally for inline onclick attributes in HTML
window.switchChartMode = switchChartMode;
window.onChartPairChange = onChartPairChange;
window.setChartTF = setChartTF;
window.setChartType = setChartType;
