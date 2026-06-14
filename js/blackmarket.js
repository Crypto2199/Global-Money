// ═══════════════════════════════════════════════
//  Global Money v5 — js/blackmarket.js
//  السوق الموازية — أسعار حية من السوق الحرة
// ═══════════════════════════════════════════════
import { state } from "./state.js";
import { tr } from "./i18n.js";
import { BLACK_MARKET_RATES, countryMap } from "./storage.js";
import { BM_MANUAL_FALLBACK, BM_PREMIUM, getFallbackRate, validateBMRate } from "./bm-config.js";

const BM_MANUAL_DATE = "14/06/2026";

let bmLastSyncTime    = null;
let bmDataSource      = "manual";
let _bmFetchInProgress = false;
let _bmRefreshTimer   = null;

// ── جلب سعر الدولار الموازي باستخدام USDT/DZD من Binance P2P ──
// نستخدم API مفتوحة لجلب سعر USDT بالدينار الجزائري
async function fetchUsdtDzdRate() {
  // محاولة Binance P2P API
  try {
    const res = await fetch("https://p2p.binance.com/bapi/c2c/v2/friendly/c2c/adv/search", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        fiat: "DZD", asset: "USDT", tradeType: "BUY",
        page: 1, rows: 10, publisherType: null
      }),
      signal: AbortSignal.timeout(8000)
    });
    if (res.ok) {
      const data = await res.json();
      const ads = data?.data;
      if (ads && ads.length > 0) {
        const prices = ads.slice(0, 5).map(a => parseFloat(a.adv?.price)).filter(p => p > 0 && p < 1000);
        if (prices.length > 0) {
          const median = prices.sort((a,b)=>a-b)[Math.floor(prices.length/2)];
          if (median > 200 && median < 400) return { rate: median, source: "live-api" };
        }
      }
    }
  } catch {}

  // محاولة ثانية — ExchangeRate-API DZD الرسمي + premium
  return null;
}

// ── جلب جميع الأسعار الموازية ────────────────────
export async function fetchAllParallelRates() {
  if (_bmFetchInProgress) return;
  _bmFetchInProgress = true;

  const { fiatRates } = state;
  const dzdOfficial = fiatRates?.DZD; // DZD/USD official

  try {
    // حاول الحصول على سعر USDT/DZD الحقيقي من السوق الحرة
    const usdtResult = await fetchUsdtDzdRate();

    if (usdtResult && usdtResult.rate) {
      const usdParallel = usdtResult.rate; // سعر الدولار في السوق الموازية
      
      // احسب باقي العملات بناءً على السعر الحقيقي للدولار
      const currencies = Object.keys(BLACK_MARKET_RATES);
      currencies.forEach(cur => {
        if (!fiatRates || !fiatRates[cur]) return;
        
        // سعر العملة مقابل USD (من API الرسمي)
        const curPerUsd = fiatRates[cur]; // كم وحدة من العملة مقابل 1 USD
        
        // سعر 1 وحدة من العملة بالدينار في السوق الموازية
        const parallelRate = usdParallel / curPerUsd;
        
        if (validateBMRate(parallelRate, cur)) {
          BLACK_MARKET_RATES[cur].parallel = parseFloat(parallelRate.toFixed(1));
          BLACK_MARKET_RATES[cur].source   = "live-api";
        }
      });

      bmLastSyncTime = new Date();
      bmDataSource   = "live-api";
      console.log(`[BM] ✅ أسعار موازية من البنش P2P: USD/DZD = ${usdParallel}`);
    } else {
      computeFromOfficialRates();
    }
  } catch (err) {
    console.warn("[BM] ⚠️ فشل الجلب — fallback:", err.message);
    computeFromOfficialRates();
  }

  _bmFetchInProgress = false;
  _refreshBMIfVisible();
}

// ── احسب من السعر الرسمي + نسبة السوق الموازية ──
function computeFromOfficialRates() {
  const { fiatRates } = state;
  
  if (!fiatRates || !fiatRates.DZD) {
    Object.keys(BLACK_MARKET_RATES).forEach(cur => {
      const fb = getFallbackRate(cur, null);
      if (fb) { BLACK_MARKET_RATES[cur].parallel = parseFloat(fb.rate.toFixed(1)); BLACK_MARKET_RATES[cur].source = "manual"; }
    });
    bmDataSource = "manual";
    return;
  }

  Object.keys(BLACK_MARKET_RATES).forEach(cur => {
    if (!fiatRates[cur]) return;
    const officialRate = fiatRates.DZD / fiatRates[cur];
    BLACK_MARKET_RATES[cur].official = officialRate;

    const premium = BM_PREMIUM[cur] || 0.20;
    const computed = officialRate * (1 + premium);
    if (validateBMRate(computed, cur)) {
      BLACK_MARKET_RATES[cur].parallel = parseFloat(computed.toFixed(1));
      BLACK_MARKET_RATES[cur].source   = "computed";
    }
  });
  
  bmLastSyncTime = new Date();
  bmDataSource   = "computed";
}

// ── مزامنة عند تحديث الأسعار الرسمية ─────────────
export function syncBlackMarketRates() {
  const { fiatRates } = state;
  if (!fiatRates || !fiatRates.DZD) return;

  Object.keys(BLACK_MARKET_RATES).forEach(cur => {
    if (fiatRates[cur]) {
      BLACK_MARKET_RATES[cur].official = fiatRates.DZD / fiatRates[cur];
    }
  });

  if (!_bmFetchInProgress) fetchAllParallelRates();
  else _refreshBMIfVisible();
}

// تحديث دوري كل 5 دقائق
export function startBMAutoRefresh() {
  fetchAllParallelRates();
  if (_bmRefreshTimer) clearInterval(_bmRefreshTimer);
  _bmRefreshTimer = setInterval(fetchAllParallelRates, 5 * 60 * 1000);
}

function _refreshBMIfVisible() {
  if (state.currentPage === "blackmarket") renderBlackMarket();
}

export function renderBlackMarket() {
  renderBMRateCards();
  renderBMCompareTable();
  renderBMCalc();

  const amtEl = document.getElementById("bmAmount");
  const curEl = document.getElementById("bmCurrency");
  if (amtEl) {
    const newAmt = amtEl.cloneNode(true);
    amtEl.replaceWith(newAmt);
    newAmt.addEventListener("input", renderBMCalc);
  }
  if (curEl) {
    const newCur = curEl.cloneNode(true);
    curEl.replaceWith(newCur);
    newCur.addEventListener("change", renderBMCalc);
  }
}

function renderBMRateCards() {
  const container = document.getElementById("bmRateCards");
  if (!container) return;
  container.textContent = "";

  Object.entries(BLACK_MARKET_RATES).forEach(([cur, data]) => {
    const official = data.official ? data.official.toFixed(1) : "—";
    const parallel = data.parallel.toFixed(1);
    const diff = data.official
      ? (((data.parallel - data.official) / data.official) * 100).toFixed(1)
      : null;
    const cc = countryMap[cur];

    const card = document.createElement("div");
    card.className = "bm-rate-card";

    const hdr = document.createElement("div");
    hdr.className = "bm-card-header";
    if (cc) {
      const img = document.createElement("img");
      img.src = `https://flagcdn.com/24x18/${cc}.png`;
      img.alt = cur;
      img.style.cssText = "border-radius:3px;margin-left:6px;margin-right:6px";
      hdr.appendChild(img);
    }
    const codeSpan = document.createElement("span");
    codeSpan.className = "bm-cur-code";
    codeSpan.textContent = cur;

    const srcBadge = document.createElement("span");
    const srcLabel = data.source === "live-api" ? "🟢 Live" : data.source === "computed" ? "~محسوب" : "📋";
    srcBadge.className = `bm-src-badge ${data.source}`;
    srcBadge.textContent = srcLabel;
    srcBadge.title = data.source === "live-api"
      ? "سعر حقيقي من السوق الموازية (P2P)"
      : data.source === "computed"
      ? "محسوب من السعر الرسمي الحي + نسبة السوق"
      : "يدوي — آخر تحديث " + BM_MANUAL_DATE;
    hdr.appendChild(codeSpan);
    hdr.appendChild(srcBadge);

    const body = document.createElement("div");
    body.className = "bm-card-body";

    const makeRow = (cls, label, value) => {
      const row = document.createElement("div");
      row.className = `bm-rate-row ${cls}`;
      const lbl = document.createElement("span");
      lbl.className = "bm-rate-label";
      lbl.textContent = label;
      const val = document.createElement("span");
      val.className = "bm-rate-value";
      val.textContent = value + " ";
      const small = document.createElement("small");
      small.textContent = "DZD";
      val.appendChild(small);
      row.appendChild(lbl);
      row.appendChild(val);
      return row;
    };

    body.appendChild(makeRow("official-row", tr("bmOfficial"), official));
    body.appendChild(makeRow("parallel-row", tr("bmParallel"), parallel));

    if (diff) {
      const diffDiv = document.createElement("div");
      const diffVal = parseFloat(diff);
      diffDiv.className = "bm-diff";
      diffDiv.style.color = diffVal > 0 ? "var(--up)" : diffVal < 0 ? "var(--down)" : "var(--flat)";
      diffDiv.textContent = `${diffVal > 0 ? "+" : ""}${diff}%`;
      body.appendChild(diffDiv);
    }

    card.appendChild(hdr);
    card.appendChild(body);
    container.appendChild(card);
  });
}

function renderBMCompareTable() {
  const el = document.getElementById("bmCompareTable");
  if (!el) return;
  el.textContent = "";

  const header = document.createElement("div");
  header.className = "bm-table-header";
  ["العملة", tr("bmOfficial"), tr("bmParallel"), "الفرق %"].forEach(text => {
    const span = document.createElement("span");
    span.textContent = text;
    header.appendChild(span);
  });
  el.appendChild(header);

  Object.entries(BLACK_MARKET_RATES).forEach(([cur, data]) => {
    const official = data.official ? data.official.toFixed(2) : "—";
    const parallel = data.parallel.toFixed(2);
    const pctDiff = data.official
      ? ((data.parallel - data.official) / data.official * 100).toFixed(1)
      : null;
    const cc = countryMap[cur];

    const row = document.createElement("div");
    row.className = "bm-table-row";

    const curSpan = document.createElement("span");
    curSpan.className = "bm-table-cur";
    if (cc) {
      const img = document.createElement("img");
      img.src = `https://flagcdn.com/16x12/${cc}.png`;
      img.alt = cur;
      img.style.cssText = "border-radius:2px;vertical-align:middle;margin:0 4px";
      curSpan.appendChild(img);
    }
    curSpan.appendChild(document.createTextNode(cur));

    const offSpan = document.createElement("span"); offSpan.className = "bm-table-off"; offSpan.textContent = official;
    const parSpan = document.createElement("span"); parSpan.className = "bm-table-par"; parSpan.textContent = parallel;
    const diffSpan = document.createElement("span");
    const pctVal = pctDiff ? parseFloat(pctDiff) : 0;
    diffSpan.className = "bm-table-diff";
    diffSpan.style.color = pctVal > 0 ? "var(--up)" : pctVal < 0 ? "var(--down)" : "var(--flat)";
    diffSpan.style.fontWeight = "700";
    diffSpan.textContent = pctDiff ? `${pctVal > 0 ? "+" : ""}${pctDiff}%` : "—";

    row.appendChild(curSpan);
    row.appendChild(offSpan);
    row.appendChild(parSpan);
    row.appendChild(diffSpan);
    el.appendChild(row);
  });

  const info = document.createElement("div");
  info.className = "bm-info-row";
  const dot = document.createElement("span");
  dot.className = "bm-status-dot " + (bmDataSource === "live-api" ? "live" : bmLastSyncTime ? "live" : "manual");

  let ts;
  if (bmDataSource === "live-api" && bmLastSyncTime) {
    ts = `🟢 أسعار من السوق الموازية (P2P) — ${bmLastSyncTime.toLocaleTimeString("ar-DZ")}`;
  } else if (bmLastSyncTime) {
    ts = `🔄 محسوب من السعر الرسمي + نسبة السوق — ${bmLastSyncTime.toLocaleTimeString("ar-DZ")}`;
  } else {
    ts = `📋 آخر تحديث يدوي: ${BM_MANUAL_DATE}`;
  }

  const noteSpan = document.createElement("span");
  noteSpan.className = "bm-update-note";
  noteSpan.textContent = ts;
  info.appendChild(dot);
  info.appendChild(noteSpan);
  el.appendChild(info);

  const disclaimer = document.createElement("p");
  disclaimer.className = "bm-parallel-note";
  disclaimer.textContent = bmDataSource === "live-api"
    ? "✅ الأسعار الموازية من بيانات P2P الحية"
    : "⚠️ الأسعار الموازية محسوبة من السعر الرسمي + نسبة السوق الحرة";
  el.appendChild(disclaimer);
}

function renderBMCalc() {
  const amountEl  = document.getElementById("bmAmount");
  const curEl     = document.getElementById("bmCurrency");
  const offEl     = document.getElementById("bmOfficialResult");
  const parEl     = document.getElementById("bmParallelResult");
  const diffNote  = document.getElementById("bmDiffNote");
  if (!amountEl || !curEl || !offEl || !parEl) return;

  const amount = parseFloat(amountEl.value) || 0;
  const cur    = curEl.value;
  const data   = BLACK_MARKET_RATES[cur];
  if (!data) return;

  const offVal = data.official ? amount * data.official : null;
  const parVal = amount * data.parallel;

  offEl.textContent = offVal
    ? offVal.toLocaleString("en-US", { maximumFractionDigits: 0 })
    : "—";
  parEl.textContent = parVal.toLocaleString("en-US", { maximumFractionDigits: 0 });

  if (offVal && diffNote) {
    const diff = parVal - offVal;
    const pct  = ((diff / offVal) * 100).toFixed(1);
    diffNote.innerHTML = "";
    const label = state.lang === "ar" ? "الفرق" : "Difference";
    diffNote.textContent = `💡 ${label}: `;
    const strong = document.createElement("strong");
    const pctNum = parseFloat(pct);
    strong.style.color = pctNum > 0 ? "var(--up)" : pctNum < 0 ? "var(--down)" : "var(--flat)";
    strong.textContent = `${diff > 0 ? "+" : ""}${diff.toLocaleString("en-US", { maximumFractionDigits: 0 })} DZD (${pctNum > 0 ? "+" : ""}${pct}%)`;
    diffNote.appendChild(strong);
  }
}
