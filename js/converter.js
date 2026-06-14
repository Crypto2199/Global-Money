// ═══════════════════════════════════════════════
//  Global Money — js/converter.js
//  Fiat and crypto conversion, history, alerts, compare, quick rates, favorites
// ═══════════════════════════════════════════════
import { state } from "./state.js";
import { tr } from "./i18n.js";
import { CRYPTOS, countryMap, currencyNames, getAlerts, saveAlerts, getHistory, saveHistory, getFavs } from "./storage.js";
import { fmt, fmt6, animateCount } from "./ui.js";

// ── Fiat Convert ──────────────────────────────────
export async function convert() {
  const amountEl   = document.getElementById("amount");
  const resultEl   = document.getElementById("result");
  const rateInfoEl = document.getElementById("rateInfo");
  const updatedEl  = document.getElementById("updated");
  const convertBtn = document.getElementById("convertBtn");
  const copyBtn    = document.getElementById("copyBtn");
  const pctCalcEl  = document.getElementById("pctCalc");

  const val = parseFloat(amountEl?.value);
  if (isNaN(val) || val < 0 || !resultEl) return;

  if (convertBtn) { convertBtn.disabled = true; convertBtn.textContent = tr("loading"); }

  try {
    const { fromSel, toSel, fiatRates } = state;
    const fr = fiatRates[fromSel], to = fiatRates[toSel];
    if (!fr || !to) { resultEl.textContent = "Rate unavailable"; return; }

    const rate = to / fr;
    state.setLastRate(rate);
    const converted = val * rate;

    resultEl.textContent = "";
    const fromValSpan = document.createElement("span");
    fromValSpan.className = "from-val";
    fromValSpan.textContent = `${fmt(val)} ${fromSel}`;
    resultEl.appendChild(fromValSpan);

    const toValSpan = document.createElement("span");
    toValSpan.className = "to-val";
    toValSpan.textContent = "0";
    resultEl.appendChild(toValSpan);
    animateCount(toValSpan, converted);

    const toCodeSpan = document.createElement("span");
    toCodeSpan.className = "to-code-label";
    toCodeSpan.textContent = " " + toSel;
    resultEl.appendChild(toCodeSpan);

    if (rateInfoEl) {
      rateInfoEl.textContent = `${tr("rateTpl", fromSel, fmt6(rate), toSel)}  |  ${tr("rateTpl", toSel, fmt6(1 / rate), fromSel)}`;
    }
    if (updatedEl)  updatedEl.textContent = "⏱ " + new Date().toLocaleString();
    if (copyBtn)    copyBtn.style.display = "flex";
    if (pctCalcEl)  pctCalcEl.style.display = "block";

    updatePct();
    if (val > 0) addHistory(val, fromSel, converted, toSel);
    checkAlerts(fromSel, toSel, rate);
  } catch (err) {
    console.error("convert error:", err);
    if (resultEl) resultEl.textContent = "⚠️ Error. Try again.";
  } finally {
    if (convertBtn) { convertBtn.disabled = false; convertBtn.textContent = tr("convert"); }
  }
}

// ── % Calculator ──────────────────────────────────
export function updatePct() {
  const pctInput  = document.getElementById("pctInput");
  const pctResult = document.getElementById("pctResult");
  const amountEl  = document.getElementById("amount");
  if (!pctInput || !pctResult) return;
  const pct = parseFloat(pctInput.value);
  const val = parseFloat(amountEl?.value) || 0;
  if (isNaN(pct)) return;
  pctResult.textContent = `${pct}% = ${fmt(val * state.lastRate * (pct / 100))} ${state.toSel}`;
}

// ── Crypto Convert ────────────────────────────────
export function convertCrypto() {
  const amountEl   = document.getElementById("cryptoAmount");
  const resultEl   = document.getElementById("cryptoResult");
  const rateInfoEl = document.getElementById("cryptoRateInfo");

  const val = parseFloat(amountEl?.value);
  if (!resultEl || isNaN(val) || val < 0) return;

  const { cryptoFrom, cryptoTo, cryptoRates } = state;
  const fp = cryptoRates[cryptoFrom], tp = cryptoRates[cryptoTo];
  if (!fp || !tp) { resultEl.textContent = "Crypto data unavailable"; return; }

  const rate = fp / tp;
  const converted = val * rate;

  resultEl.textContent = "";
  const fromValSpan = document.createElement("span");
  fromValSpan.className = "from-val";
  fromValSpan.textContent = `${fmt(val)} ${cryptoFrom}`;
  resultEl.appendChild(fromValSpan);

  const toValSpan = document.createElement("span");
  toValSpan.className = "to-val";
  resultEl.appendChild(toValSpan);
  animateCount(toValSpan, converted);

  const toCodeSpan = document.createElement("span");
  toCodeSpan.className = "to-code-label";
  toCodeSpan.textContent = " " + cryptoTo;
  resultEl.appendChild(toCodeSpan);

  if (rateInfoEl) rateInfoEl.textContent = tr("rateTpl", cryptoFrom, fmt6(rate), cryptoTo);
}

// ── Crypto Prices ─────────────────────────────────
export function renderCryptoPrices() {
  const list = document.getElementById("cryptoPriceList");
  if (!list) return;
  const { cryptoRates } = state;

  if (!Object.keys(cryptoRates).length) {
    list.textContent = "";
    const p = document.createElement("p");
    p.className = "card-sub";
    p.style.cssText = "text-align:center;padding:20px";
    p.textContent = "Loading crypto data…";
    list.appendChild(p);
    return;
  }

  list.textContent = "";
  Object.entries(CRYPTOS).forEach(([sym, info]) => {
    const price = cryptoRates[sym];
    const item = document.createElement("div");
    item.className = "crypto-price-item";

    const iconDiv = document.createElement("div");
    iconDiv.className = "cp-icon";
    iconDiv.textContent = info.icon;

    const infoDiv = document.createElement("div");
    const nameDiv = document.createElement("div");
    nameDiv.className = "cp-name";
    nameDiv.textContent = info.name;
    const symDiv = document.createElement("div");
    symDiv.className = "cp-sym";
    symDiv.textContent = sym;
    infoDiv.appendChild(nameDiv);
    infoDiv.appendChild(symDiv);

    const priceDiv = document.createElement("div");
    priceDiv.className = "cp-price";
    if (price) {
      if (price < 0.0001) {
        priceDiv.textContent = `$${price.toFixed(8)}`;
      } else if (price < 1) {
        priceDiv.textContent = `$${price.toFixed(4)}`;
      } else {
        priceDiv.textContent = `$${Number(price).toLocaleString("en-US", { maximumFractionDigits: 2 })}`;
      }
    } else {
      priceDiv.textContent = "⏳";
    }

    // 24h change from Binance
    const ch24 = state.cryptoChange24h[sym];
    const changeDiv = document.createElement("div");
    changeDiv.className = `cp-change ${ch24 == null ? "flat" : ch24 >= 0 ? "up" : "down"}`;
    if (ch24 != null) {
      const sign = ch24 >= 0 ? "+" : "";
      const arrow = ch24 > 0.01 ? "↑" : ch24 < -0.01 ? "↓" : "";
      changeDiv.textContent = `${arrow} ${sign}${ch24.toFixed(2)}%`;
    } else {
      changeDiv.textContent = "—";
    }

    const rightDiv = document.createElement("div");
    rightDiv.style.cssText = "display:flex;flex-direction:column;align-items:flex-end;gap:2px;";
    rightDiv.appendChild(priceDiv);
    rightDiv.appendChild(changeDiv);

    item.appendChild(iconDiv);
    item.appendChild(infoDiv);
    item.appendChild(rightDiv);
    list.appendChild(item);
  });
}

// ── History ───────────────────────────────────────
export function addHistory(val, from, conv, to) {
  const h = getHistory();
  h.unshift({ val: fmt(val), from, conv: fmt(conv), to, time: new Date().toLocaleTimeString() });
  saveHistory(h);
}

export function renderHistory() {
  const el = document.getElementById("historyList");
  if (!el) return;
  const h = getHistory();
  el.textContent = "";
  if (!h.length) {
    const p = document.createElement("p");
    p.className = "no-history";
    p.textContent = tr("noHistory");
    el.appendChild(p);
    return;
  }
  h.forEach(e => {
    const item = document.createElement("div");
    item.className = "history-item";
    const main = document.createElement("span");
    main.textContent = `${e.val} ${e.from} → ${e.conv} ${e.to}`;
    const time = document.createElement("span");
    time.className = "hist-time";
    time.textContent = e.time;
    item.appendChild(main);
    item.appendChild(time);
    el.appendChild(item);
  });
}

// ── Price Alerts ──────────────────────────────────
export function renderAlerts() {
  const el = document.getElementById("alertsList");
  if (!el) return;
  const alerts = getAlerts();
  el.textContent = "";
  alerts.forEach((a, i) => {
    const item = document.createElement("div");
    item.className = "alert-item";
    const span = document.createElement("span");
    span.textContent = `${a.from}→${a.to} ${a.dir === "above" ? "↑" : "↓"} ${a.target}`;
    const btn = document.createElement("button");
    btn.className = "del-alert";
    btn.textContent = "✕";
    btn.addEventListener("click", () => {
      const arr = getAlerts();
      arr.splice(i, 1);
      saveAlerts(arr);
      renderAlerts();
    });
    item.appendChild(span);
    item.appendChild(btn);
    el.appendChild(item);
  });
}

export function checkAlerts(from, to, rate) {
  const alerts = getAlerts();
  let changed = false;
  alerts.forEach(a => {
    if (a.from !== from || a.to !== to || !a.active) return;
    if ((a.dir === "above" && rate >= a.target) || (a.dir === "below" && rate <= a.target)) {
      if (Notification.permission === "granted")
        new Notification("Global Money 🔔", {
          body: `${from}→${to} = ${rate.toFixed(4)}`,
          icon: "favicon.png"
        });
      a.active = false;
      changed = true;
    }
  });
  if (changed) saveAlerts(alerts);
}

// ── Compare ───────────────────────────────────────
export function renderCompare() {
  const { fiatRates, fromSel } = state;
  const fr = fiatRates[fromSel] || 1;
  const a  = document.getElementById("cmpA")?.value;
  const b  = document.getElementById("cmpB")?.value;
  if (!a || !b) return;

  const ra  = fiatRates[a] / fr;
  const rb  = fiatRates[b] / fr;
  const val = parseFloat(document.getElementById("amount")?.value) || 1;
  const el  = document.getElementById("compareResult");
  if (!el) return;

  el.textContent = "";

  const makeRow = (cur, rate) => {
    const row = document.createElement("div");
    row.className = "cmp-result-row";
    const main = document.createElement("span");
    const strong = document.createElement("strong");
    strong.textContent = `${fmt(val * rate)} ${cur}`;
    main.textContent = `${fmt(val)} ${fromSel} → `;
    main.appendChild(strong);
    const rateSpan = document.createElement("span");
    rateSpan.className = "cmp-rate";
    rateSpan.textContent = `1 ${fromSel} = ${fmt6(rate)} ${cur}`;
    row.appendChild(main);
    row.appendChild(rateSpan);
    return row;
  };

  el.appendChild(makeRow(a, ra));
  el.appendChild(makeRow(b, rb));

  const winner = document.createElement("div");
  winner.className = "cmp-winner";
  winner.textContent = ra > rb
    ? `💡 ${a} is stronger: 1 ${fromSel} = ${fmt6(ra)} ${a} vs ${fmt6(rb)} ${b}`
    : `💡 ${b} is stronger: 1 ${fromSel} = ${fmt6(rb)} ${b} vs ${fmt6(ra)} ${a}`;
  el.appendChild(winner);
}

export function populateCompare() {
  const cmpA = document.getElementById("cmpA");
  const cmpB = document.getElementById("cmpB");
  const { allFiatCodes } = state;
  if (!cmpA || !allFiatCodes.length) return;

  cmpA.textContent = "";
  cmpB.textContent = "";
  allFiatCodes.forEach(c => {
    const optA = document.createElement("option");
    optA.value = c;
    optA.textContent = `${c} — ${currencyNames[c] || c}`;
    const optB = optA.cloneNode(true);
    cmpA.appendChild(optA);
    cmpB.appendChild(optB);
  });
  cmpA.value = "EUR";
  cmpB.value = "GBP";
  cmpA.addEventListener("change", renderCompare);
  cmpB.addEventListener("change", renderCompare);
}

// ── Quick Rates ───────────────────────────────────
export function renderMultiTable() {
  const tableEl = document.getElementById("multiTable");
  const { fiatRates, fromSel } = state;
  if (!tableEl || !Object.keys(fiatRates).length) return;

  const val  = parseFloat(document.getElementById("amount")?.value) || 1;
  const fr   = fiatRates[fromSel] || 1;
  const list = getFavs().filter(c => c !== fromSel && fiatRates[c]).slice(0, 10);

  tableEl.textContent = "";
  if (!list.length) return;

  list.forEach(c => {
    const rate = fiatRates[c] / fr;
    const conv = fmt(val * rate);
    const row = document.createElement("div");
    row.className = "tbl-row";

    const left = document.createElement("span");
    left.className = "tbl-left";
    const cc = countryMap[c];
    if (cc) {
      const img = document.createElement("img");
      img.src = `https://flagcdn.com/16x12/${cc}.png`;
      img.alt = "";
      img.className = "tbl-flag";
      left.appendChild(img);
    }
    const codeSpan = document.createElement("span");
    codeSpan.className = "tbl-code";
    codeSpan.textContent = c;
    const nameSpan = document.createElement("span");
    nameSpan.className = "tbl-name";
    nameSpan.textContent = currencyNames[c] || c;
    left.appendChild(codeSpan);
    left.appendChild(nameSpan);

    const valSpan = document.createElement("span");
    valSpan.className = "tbl-val";
    valSpan.textContent = conv;

    row.appendChild(left);
    row.appendChild(valSpan);
    tableEl.appendChild(row);
  });
}

// ── Favorites ─────────────────────────────────────
export function renderFavChips() {
  const chips = document.getElementById("favChips");
  if (!chips) return;
  const { fromSel, allFiatCodes } = state;
  const favs = getFavs().filter(c => c !== fromSel && allFiatCodes.includes(c));

  chips.textContent = "";
  favs.forEach(c => {
    const btn = document.createElement("button");
    btn.className = "fav-chip";
    btn.dataset.code = c;
    btn.textContent = c;
    btn.addEventListener("click", () => {
      state.setToSel(c);
      import("./ui.js").then(({ updateSelDisplay }) => updateSelDisplay());
      convert();
    });
    chips.appendChild(btn);
  });
}

export function openFavPicker() {
  const list = document.getElementById("favPickerList");
  if (!list) return;
  const current = getFavs();
  const codes = state.allFiatCodes.slice(0, 80);

  list.textContent = "";
  codes.forEach(c => {
    const label = document.createElement("label");
    label.className = "fav-pick-item";
    const cb = document.createElement("input");
    cb.type = "checkbox";
    cb.className = "fav-pick";
    cb.value = c;
    if (current.includes(c)) cb.checked = true;
    const codeSpan = document.createElement("span");
    codeSpan.textContent = c;
    const nameSmall = document.createElement("small");
    nameSmall.textContent = currencyNames[c] || "";
    label.appendChild(cb);
    label.appendChild(codeSpan);
    label.appendChild(nameSmall);
    list.appendChild(label);
  });
}
