// ═══════════════════════════════════════════════
//  Global Money v5 — js/metals.js
//  Precious metals — live prices with data status
// ═══════════════════════════════════════════════
import { state } from "./state.js";
import { tr } from "./i18n.js";
import { getMetalsRates, getMetalsLastUpdate, loadMetals, dataStatus } from "./api.js";

export const METALS_DATA = {
  XAU: { name:"Gold",      nameAr:"الذهب",      nameFr:"Or",       icon:"🥇", color:"#f0c040", fallback: 3350,
         logo: `<svg viewBox="0 0 36 36" fill="none" xmlns="http://www.w3.org/2000/svg"><circle cx="18" cy="18" r="18" fill="#F6C243"/><circle cx="18" cy="18" r="14" fill="#E8A800"/><text x="50%" y="55%" dominant-baseline="middle" text-anchor="middle" font-size="14" font-weight="bold" fill="#FFF8DC" font-family="serif">Au</text></svg>` },
  XAG: { name:"Silver",    nameAr:"الفضة",      nameFr:"Argent",   icon:"🥈", color:"#c0c0c0", fallback: 33.5,
         logo: `<svg viewBox="0 0 36 36" fill="none" xmlns="http://www.w3.org/2000/svg"><circle cx="18" cy="18" r="18" fill="#C0C0C0"/><circle cx="18" cy="18" r="14" fill="#A8A8A8"/><text x="50%" y="55%" dominant-baseline="middle" text-anchor="middle" font-size="14" font-weight="bold" fill="#F0F0F0" font-family="serif">Ag</text></svg>` },
  XPT: { name:"Platinum",  nameAr:"البلاتين",   nameFr:"Platine",  icon:"💎", color:"#8ab4d4", fallback: 1050,
         logo: `<svg viewBox="0 0 36 36" fill="none" xmlns="http://www.w3.org/2000/svg"><circle cx="18" cy="18" r="18" fill="#8AB4D4"/><circle cx="18" cy="18" r="14" fill="#6A94B4"/><text x="50%" y="55%" dominant-baseline="middle" text-anchor="middle" font-size="14" font-weight="bold" fill="#EEF5FF" font-family="serif">Pt</text></svg>` },
  XPD: { name:"Palladium", nameAr:"البلاديوم",  nameFr:"Palladium",icon:"⚗️", color:"#a8c8d8", fallback: 1020,
         logo: `<svg viewBox="0 0 36 36" fill="none" xmlns="http://www.w3.org/2000/svg"><circle cx="18" cy="18" r="18" fill="#A8C8D8"/><circle cx="18" cy="18" r="14" fill="#88A8B8"/><text x="50%" y="55%" dominant-baseline="middle" text-anchor="middle" font-size="14" font-weight="bold" fill="#F0F8FF" font-family="serif">Pd</text></svg>` },
};

const prevClosePrices = {};

export function getMetalName(sym) {
  const d = METALS_DATA[sym];
  if (!d) return sym;
  const lang = state.lang;
  if (lang === "ar") return d.nameAr;
  if (lang === "fr") return d.nameFr;
  return d.name;
}

export function renderMetals() {
  const grid = document.getElementById("metalsGrid");
  if (!grid) return;

  const metalsRates = getMetalsRates();
  const hasRates = Object.keys(metalsRates).length > 0;

  if (!hasRates) {
    grid.innerHTML = `<div class="metals-loading-wrap">
      <div class="metals-spinner"></div>
      <p>${tr("loading")}</p>
    </div>`;
    loadMetals().then(() => renderMetals());
    return;
  }

  // شريط حالة المعادن
  const statusEl = document.getElementById("metalsDataStatus");
  if (statusEl) {
    const ms = dataStatus.metals;
    const isLive = ms.live;
    const lastUpdate = getMetalsLastUpdate();
    const ts = lastUpdate ? lastUpdate.toLocaleTimeString() : "—";
    statusEl.innerHTML = `
      <span class="ds-dot ${isLive ? "ds-live" : "ds-cached"}"></span>
      <span>${ms.source || "..."}</span>
      <span style="opacity:.6">— ${ts}</span>
      ${!isLive ? '<span class="metals-stale-warn">⚠️ استخدام بيانات مخزنة</span>' : ""}
    `;
    statusEl.style.display = "flex";
  }

  grid.textContent = "";
  Object.entries(METALS_DATA).forEach(([sym, d]) => {
    const price = metalsRates[sym] || d.fallback;
    const isFallback = !metalsRates[sym];
    const name = getMetalName(sym);

    const prevClose = prevClosePrices[sym] || null;
    let change = 0;
    let hasRealChange = false;
    if (prevClose && prevClose > 0 && prevClose !== price) {
      change = parseFloat(((price - prevClose) / prevClose * 100).toFixed(2));
      hasRealChange = true;
    }
    const isPos = change >= 0;

    const card = document.createElement("div");
    card.className = "metal-card";

    // رأس البطاقة
    const header = document.createElement("div");
    header.className = "metal-card-header";
    header.style.cssText = `background:linear-gradient(135deg,${d.color}22,${d.color}11);border-color:${d.color}44`;

    const iconSpan = document.createElement("div");
    iconSpan.className = "metal-icon";
    if (d.logo) {
      iconSpan.innerHTML = d.logo;
    } else {
      iconSpan.textContent = d.icon;
    }

    const headerText = document.createElement("div");
    headerText.className = "metal-header-text";

    const codeSpan = document.createElement("span");
    codeSpan.className = "metal-code";
    codeSpan.textContent = sym;

    const nameSpan = document.createElement("span");
    nameSpan.className = "metal-name";
    nameSpan.textContent = name;

    headerText.appendChild(codeSpan);
    headerText.appendChild(nameSpan);

    const badge = document.createElement("div");
    badge.className = `metal-badge ${isPos ? "pos" : "neg"}`;
    if (isFallback) {
      badge.textContent = "—";
      badge.className = "metal-badge flat";
      badge.title = "Fallback price";
    } else if (hasRealChange) {
      badge.textContent = `${isPos ? "+" : ""}${change}%`;
    } else {
      badge.textContent = "—";
      badge.className = "metal-badge flat";
    }

    header.appendChild(iconSpan);
    header.appendChild(headerText);
    header.appendChild(badge);

    // جسم البطاقة
    const body = document.createElement("div");
    body.className = "metal-card-body";

    const priceDiv = document.createElement("div");
    priceDiv.className = "metal-price" + (isFallback ? " metal-price-fallback" : "");
    priceDiv.textContent = `$${Number(price).toLocaleString("en-US", { maximumFractionDigits: 2 })}`;
    if (isFallback) priceDiv.title = "Fallback estimate";

    const unitDiv = document.createElement("div");
    unitDiv.className = "metal-unit";
    unitDiv.textContent = "USD / troy oz";

    const convDiv = document.createElement("div");
    convDiv.className = "metal-conversions";

    const s1 = document.createElement("span");
    s1.textContent = `$${(price / 31.1035).toFixed(2)}/g`;
    const s2 = document.createElement("span");
    s2.textContent = `$${(price / 31.1035 * 1000).toFixed(0)}/kg`;
    convDiv.appendChild(s1);
    convDiv.appendChild(s2);

    // سعر بالدينار الجزائري
    const { fiatRates } = state;
    if (fiatRates && fiatRates.DZD) {
      const dzdPrice = price * (fiatRates.DZD / (fiatRates.USD || 1));
      const dzdDiv = document.createElement("div");
      dzdDiv.className = "metal-dzd-price";
      dzdDiv.textContent = `≈ ${dzdPrice.toLocaleString("en-US", { maximumFractionDigits: 0 })} DZD/oz`;
      body.appendChild(priceDiv);
      body.appendChild(unitDiv);
      body.appendChild(dzdDiv);
      body.appendChild(convDiv);
    } else {
      body.appendChild(priceDiv);
      body.appendChild(unitDiv);
      body.appendChild(convDiv);
    }

    card.appendChild(header);
    card.appendChild(body);
    grid.appendChild(card);
  });

  const updEl = document.getElementById("metalsUpdated");
  if (updEl) {
    const lastUpdate = getMetalsLastUpdate();
    if (lastUpdate) {
      updEl.textContent = `⏱ ${tr("metalsUpdatedTpl", lastUpdate.toLocaleTimeString())}`;
      updEl.style.color = "var(--text3)";
    } else {
      updEl.textContent = "⚠️ يتم استخدام بيانات مخزنة — تحقق من الاتصال";
      updEl.style.color = "#f59e0b";
    }
  }

  renderMetalsCalc();
}

export function setMetalsPrevClose(rates) {
  Object.keys(rates).forEach(sym => {
    if (!prevClosePrices[sym] && rates[sym] > 0) {
      prevClosePrices[sym] = rates[sym];
    }
  });
}

export function updateMetalsPrevClose(rates) {
  Object.keys(rates).forEach(sym => {
    prevClosePrices[sym] = rates[sym];
  });
}

export function renderMetalsCalc() {
  const amtEl = document.getElementById("metalsAmount");
  const unitEl = document.getElementById("metalsUnit");
  const curEl = document.getElementById("metalsCurrency");
  const resEl = document.getElementById("metalsCalcResult");
  if (!amtEl || !unitEl || !curEl || !resEl) return;

  const amount = parseFloat(amtEl.value) || 1;
  const unit = unitEl.value;
  const cur = curEl.value;
  let multiplier = 1;
  if (unit === "g")  multiplier = 1 / 31.1035;
  if (unit === "kg") multiplier = 1000 / 31.1035;

  const { fiatRates } = state;
  const fxRate  = fiatRates[cur] || 1;
  const usdRate = fiatRates["USD"] || 1;
  const metalsRates = getMetalsRates();

  resEl.textContent = "";
  Object.entries(METALS_DATA).forEach(([sym, d]) => {
    const priceUSD   = (metalsRates[sym] || d.fallback) * multiplier * amount;
    const priceLocal = priceUSD * (fxRate / usdRate);
    const name = getMetalName(sym);

    const item = document.createElement("div");
    item.className = "metals-calc-item";

    const iconSpan = document.createElement("div");
    iconSpan.className = "metals-calc-icon";
    if (d.logo) {
      iconSpan.innerHTML = d.logo;
    } else {
      iconSpan.textContent = d.icon;
    }

    const nameSpan = document.createElement("span");
    nameSpan.className = "metals-calc-name";
    nameSpan.textContent = name;

    const valSpan = document.createElement("span");
    valSpan.className = "metals-calc-val";
    valSpan.textContent = `${cur} ${Number(priceLocal).toLocaleString("en-US", { maximumFractionDigits: 2 })}`;

    item.appendChild(iconSpan);
    item.appendChild(nameSpan);
    item.appendChild(valSpan);
    resEl.appendChild(item);
  });
}
