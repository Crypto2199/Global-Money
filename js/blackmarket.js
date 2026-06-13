// ═══════════════════════════════════════════════
//  Global Money v5 — js/blackmarket.js
//  السوق الموازية — أسعار حقيقية من API + fallback
//  Config centralized in bm-config.js
// ═══════════════════════════════════════════════
import { state } from "./state.js";
import { tr } from "./i18n.js";
import { BLACK_MARKET_RATES, countryMap } from "./storage.js";
import {
  getActiveSources,
  extractAndValidate,
  getFallbackRate,
  BM_MANUAL_FALLBACK,
} from "./bm-config.js";

const BM_MANUAL_DATE = BM_MANUAL_FALLBACK.USD?.date || "13/06/2026";

let bmLastSyncTime    = null;
let bmDataSource      = "manual"; // "live-api" | "computed" | "manual"
let _bmFetchInProgress = false;

// ── جلب السعر الموازي الحقيقي من الـ API ─────────
async function fetchParallelRateForCurrency(cur) {
  const sources = getActiveSources();
  for (const src of sources) {
    try {
      const url = src.makeUrl(cur);
      const res = await fetch(url, { signal: AbortSignal.timeout(src.timeout || 6000) });
      if (!res.ok) continue;
      const json = await res.json();
      const rate = extractAndValidate(json, cur, src);
      if (rate !== null) {
        return { rate, source: "live-api", srcId: src.id };
      }
    } catch {
      // جرب المصدر التالي
    }
  }
  return null;
}

// ── جلب جميع الأسعار الموازية دفعة واحدة ────────
export async function fetchAllParallelRates() {
  if (_bmFetchInProgress) return;
  _bmFetchInProgress = true;

  const currencies = Object.keys(BLACK_MARKET_RATES);
  let successCount  = 0;

  // حاول جلب كل عملة
  const results = await Promise.allSettled(
    currencies.map(cur => fetchParallelRateForCurrency(cur))
  );

  results.forEach((result, idx) => {
    const cur = currencies[idx];
    if (result.status === "fulfilled" && result.value) {
      BLACK_MARKET_RATES[cur].parallel = parseFloat(result.value.rate.toFixed(1));
      BLACK_MARKET_RATES[cur].source   = "live-api";
      successCount++;
    }
  });

  if (successCount > 0) {
    bmLastSyncTime = new Date();
    bmDataSource   = "live-api";
    console.log(`[BM] ✅ جلب ${successCount}/${currencies.length} أسعار موازية حقيقية`);
  } else {
    // fallback: احسب من السعر الرسمي
    console.warn("[BM] ⚠️ فشل الجلب من API — استخدام الحساب من السعر الرسمي");
    computeFromOfficialRates();
  }

  _bmFetchInProgress = false;
  _refreshBMIfVisible();
}

// ── احسب من السعر الرسمي كـ fallback ─────────────
function computeFromOfficialRates() {
  const { fiatRates } = state;
  if (!fiatRates || !fiatRates.DZD) {
    // استخدم الأسعار من bm-config.js كآخر خيار
    Object.keys(BLACK_MARKET_RATES).forEach(cur => {
      const fb = getFallbackRate(cur, null);
      if (fb) {
        BLACK_MARKET_RATES[cur].parallel = parseFloat(fb.rate.toFixed(1));
        BLACK_MARKET_RATES[cur].source   = "manual";
      }
    });
    bmDataSource = "manual";
    return;
  }

  Object.keys(BLACK_MARKET_RATES).forEach(cur => {
    if (!fiatRates[cur]) return;
    const officialRate = fiatRates.DZD / fiatRates[cur];
    BLACK_MARKET_RATES[cur].official = officialRate;

    const fb = getFallbackRate(cur, officialRate);
    if (fb) {
      BLACK_MARKET_RATES[cur].parallel = parseFloat(fb.rate.toFixed(1));
      BLACK_MARKET_RATES[cur].source   = fb.source;
    }
  });
  bmDataSource = "computed";
}

// ── مزامنة تُشغَّل عند تحديث الأسعار الرسمية ─────
export function syncBlackMarketRates() {
  const { fiatRates } = state;
  if (!fiatRates || !fiatRates.DZD) return;

  // حدّث السعر الرسمي دائماً
  Object.keys(BLACK_MARKET_RATES).forEach(cur => {
    if (fiatRates[cur]) {
      BLACK_MARKET_RATES[cur].official = fiatRates.DZD / fiatRates[cur];
    }
  });

  // إذا لم يتم الجلب من API بعد، ابدأ الجلب
  if (bmDataSource === "manual" && !_bmFetchInProgress) {
    fetchAllParallelRates();
  } else {
    _refreshBMIfVisible();
  }
}

// تحديث دوري كل 10 دقائق
export function startBMAutoRefresh() {
  fetchAllParallelRates(); // جلب فوري
  setInterval(fetchAllParallelRates, 10 * 60 * 1000);
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
      ? "سعر حقيقي من السوق الموازية"
      : data.source === "computed"
      ? "محسوب من السعر الرسمي الحي"
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
      // لون النسبة: أخضر للصعود، أحمر للنزول، رمادي للصفر
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

    const offSpan = document.createElement("span");
    offSpan.className = "bm-table-off";
    offSpan.textContent = official;

    const parSpan = document.createElement("span");
    parSpan.className = "bm-table-par";
    parSpan.textContent = parallel;

    const diffSpan = document.createElement("span");
    const pctVal = pctDiff ? parseFloat(pctDiff) : 0;
    // لون النسبة: أخضر للصعود، أحمر للنزول، رمادي للصفر
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

  // شريط حالة البيانات
  const info = document.createElement("div");
  info.className = "bm-info-row";

  const dot = document.createElement("span");
  dot.className = "bm-status-dot " + (bmDataSource === "live-api" ? "live" : bmLastSyncTime ? "live" : "manual");

  let ts;
  if (bmDataSource === "live-api" && bmLastSyncTime) {
    ts = `🟢 أسعار حقيقية من السوق الموازية — ${bmLastSyncTime.toLocaleTimeString("ar-DZ")}`;
  } else if (bmLastSyncTime) {
    ts = `🔄 محسوب من السعر الرسمي — ${bmLastSyncTime.toLocaleTimeString("ar-DZ")}`;
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
    ? "✅ الأسعار الموازية من مصادر حية للسوق الجزائرية"
    : "⚠️ الأسعار الموازية تقديرية — جارٍ محاولة الجلب من المصادر الحية...";
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
    // لون الفرق: أخضر للزيادة، أحمر للنقص
    const pctNum = parseFloat(pct);
    strong.style.color = pctNum > 0 ? "var(--up)" : pctNum < 0 ? "var(--down)" : "var(--flat)";
    strong.textContent = `${diff > 0 ? "+" : ""}${diff.toLocaleString("en-US", { maximumFractionDigits: 0 })} DZD (${pctNum > 0 ? "+" : ""}${pct}%)`;
    diffNote.appendChild(strong);
  }
}
