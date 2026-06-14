// ═══════════════════════════════════════════════
//  Global Money v4.2 — js/portfolio.js
//  Portfolio Tracker: assets, P&L, total value
//  v4.2: Primary storage migrated to IndexedDB (database.js)
//        with automatic localStorage fallback for compatibility
// ═══════════════════════════════════════════════
import { state } from "./state.js";
import { safeGetJSON, safeSetJSON, currencyNames, CRYPTOS } from "./storage.js";
import { el, showToast, fmt, fmt6 } from "./ui.js";
import { tr } from "./i18n.js";
import { dbGetPortfolio, dbSetPortfolio, isDBReady } from "./database.js";
import { getMetalsRates } from "./api.js";

const PORTFOLIO_KEY = "portfolioData";
const FALLBACK      = { assets: [], updatedAt: null };

// ── Data Helpers — IndexedDB primary, localStorage fallback ───
export function getPortfolio() {
  // Synchronous read from localStorage (always available immediately)
  return safeGetJSON(PORTFOLIO_KEY, FALLBACK);
}

export async function getPortfolioAsync() {
  if (isDBReady()) {
    const data = await dbGetPortfolio();
    if (data && Array.isArray(data.assets)) return data;
  }
  return safeGetJSON(PORTFOLIO_KEY, FALLBACK);
}

async function savePortfolio(data) {
  data.updatedAt = Date.now();
  // Write to both storages for reliability
  safeSetJSON(PORTFOLIO_KEY, data);
  if (isDBReady()) {
    await dbSetPortfolio(data).catch(() => {});
  }
  return true;
}

// ── Asset Operations ──────────────────────────────
export async function addAsset({ symbol, amount, buyPrice, type = "fiat" }) {
  if (!symbol || isNaN(parseFloat(amount)) || isNaN(parseFloat(buyPrice))) {
    return { ok: false, error: "invalid_input" };
  }
  const portfolio = await getPortfolioAsync();
  const id = `${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
  portfolio.assets.push({
    id,
    symbol: symbol.toUpperCase(),
    amount: parseFloat(amount),
    buyPrice: parseFloat(buyPrice),
    type, // "fiat" | "crypto" | "metal"
    addedAt: Date.now(),
  });
  await savePortfolio(portfolio);
  return { ok: true, id };
}

export async function editAsset(id, updates) {
  const portfolio = await getPortfolioAsync();
  const idx = portfolio.assets.findIndex(a => a.id === id);
  if (idx === -1) return { ok: false, error: "not_found" };
  if (updates.amount !== undefined)   portfolio.assets[idx].amount   = parseFloat(updates.amount);
  if (updates.buyPrice !== undefined) portfolio.assets[idx].buyPrice = parseFloat(updates.buyPrice);
  if (updates.symbol !== undefined)   portfolio.assets[idx].symbol   = updates.symbol.toUpperCase();
  await savePortfolio(portfolio);
  return { ok: true };
}

export async function removeAsset(id) {
  const portfolio = await getPortfolioAsync();
  const before = portfolio.assets.length;
  portfolio.assets = portfolio.assets.filter(a => a.id !== id);
  if (portfolio.assets.length === before) return { ok: false, error: "not_found" };
  await savePortfolio(portfolio);
  return { ok: true };
}

// ── Price Resolution ──────────────────────────────
function getCurrentPrice(asset) {
  const { fiatRates, cryptoRates } = state;

  if (asset.type === "crypto") {
    const price = cryptoRates[asset.symbol];
    if (price) {
      // Convert USDT→ target currency via fiat rates
      const dzdRate = fiatRates["DZD"] || 1;
      const usdRate = fiatRates["USD"] || 1;
      return { priceUSD: price, priceDZD: price * (dzdRate / usdRate) };
    }
    return null;
  }

  if (asset.type === "metal") {
    // metals stored in USD/oz
    const m = getMetalsRates();
    if (m && m[asset.symbol]) {
      const priceUSD = m[asset.symbol];
      const dzdRate = fiatRates["DZD"] || 1;
      const usdRate = fiatRates["USD"] || 1;
      return { priceUSD, priceDZD: priceUSD * (dzdRate / usdRate) };
    }
    return null;
  }

  // fiat: buyPrice stored in buyPrice currency, convert to DZD
  if (fiatRates[asset.symbol] && fiatRates["DZD"]) {
    const priceInDZD = fiatRates["DZD"] / fiatRates[asset.symbol];
    return { priceUSD: fiatRates["USD"] ? (1 / fiatRates[asset.symbol]) : null, priceDZD: priceInDZD };
  }
  return null;
}

// ── Calculations ──────────────────────────────────
export function calcAssetStats(asset) {
  const current = getCurrentPrice(asset);
  if (!current) {
    return {
      currentPriceDZD: null,
      currentValueDZD: null,
      costBasisDZD: asset.amount * asset.buyPrice,
      pnlDZD: null,
      pnlPct: null,
    };
  }
  const currentValueDZD = asset.amount * current.priceDZD;
  const costBasisDZD    = asset.amount * asset.buyPrice;
  const pnlDZD          = currentValueDZD - costBasisDZD;
  const pnlPct          = costBasisDZD !== 0 ? (pnlDZD / costBasisDZD) * 100 : 0;
  return {
    currentPriceDZD: current.priceDZD,
    currentValueDZD,
    costBasisDZD,
    pnlDZD,
    pnlPct,
  };
}

export function calcPortfolioTotal() {
  const portfolio = getPortfolio();
  let totalValueDZD = 0;
  let totalCostDZD  = 0;
  portfolio.assets.forEach(asset => {
    const stats = calcAssetStats(asset);
    if (stats.currentValueDZD !== null) totalValueDZD += stats.currentValueDZD;
    totalCostDZD += stats.costBasisDZD;
  });
  const totalPnlDZD = totalValueDZD - totalCostDZD;
  const totalPnlPct = totalCostDZD !== 0 ? (totalPnlDZD / totalCostDZD) * 100 : 0;
  return { totalValueDZD, totalCostDZD, totalPnlDZD, totalPnlPct, count: portfolio.assets.length };
}

// ── Render ────────────────────────────────────────
export function renderPortfolio() {
  const container = document.getElementById("portfolioContainer");
  if (!container) return;

  const portfolio = getPortfolio();
  const totals = calcPortfolioTotal();
  const lang = state.lang;

  // Clear
  container.textContent = "";

  // ── Summary card ──
  const summary = document.createElement("div");
  summary.className = "portfolio-summary";

  const totalLabel = el("div", lang === "ar" ? "إجمالي المحفظة" : lang === "fr" ? "Valeur totale" : "Total Portfolio", { className: "pf-label" });
  const totalVal = el("div", `${fmt(totals.totalValueDZD)} DZD`, { className: "pf-total-value" });

  const pnlSign = totals.totalPnlDZD >= 0 ? "+" : "";
  const pnlColor = totals.totalPnlDZD >= 0 ? "var(--up-color, #22c55e)" : "var(--down-color, #ef4444)";
  const pnlEl = el("div", `${pnlSign}${fmt(totals.totalPnlDZD)} DZD  (${pnlSign}${totals.totalPnlPct.toFixed(2)}%)`,
    { className: "pf-pnl", style: `color:${pnlColor}` });

  const costEl = el("div",
    `${lang === "ar" ? "التكلفة:" : "Cost:"} ${fmt(totals.totalCostDZD)} DZD`,
    { className: "pf-cost" });

  summary.append(totalLabel, totalVal, pnlEl, costEl);
  container.appendChild(summary);

  // ── Add asset form ──
  container.appendChild(_buildAddForm());

  // ── Assets list ──
  if (!portfolio.assets.length) {
    const empty = el("div",
      lang === "ar" ? "لا توجد أصول. أضف أصلاً جديداً." : lang === "fr" ? "Aucun actif. Ajoutez-en un." : "No assets yet. Add one above.",
      { className: "pf-empty" });
    container.appendChild(empty);
    return;
  }

  const list = document.createElement("div");
  list.className = "portfolio-list";

  portfolio.assets.forEach(asset => {
    const stats = calcAssetStats(asset);
    const card = _buildAssetCard(asset, stats, lang);
    list.appendChild(card);
  });

  container.appendChild(list);
}

function _buildAddForm() {
  const lang = state.lang;
  const form = document.createElement("div");
  form.className = "pf-add-form";

  const title = el("h3",
    lang === "ar" ? "إضافة أصل جديد" : lang === "fr" ? "Ajouter un actif" : "Add Asset",
    { className: "pf-form-title" });

  // Type selector
  const typeWrap = document.createElement("div");
  typeWrap.className = "pf-form-row";
  const typeLabel = el("label", lang === "ar" ? "النوع:" : "Type:", { className: "pf-form-label" });
  const typeSelect = document.createElement("select");
  typeSelect.className = "pf-select";
  typeSelect.id = "pfTypeSelect";
  [["fiat", lang === "ar" ? "عملة" : "Fiat"],
   ["crypto", lang === "ar" ? "كريبتو" : "Crypto"],
   ["metal", lang === "ar" ? "معدن" : "Metal"]].forEach(([v, t]) => {
    const opt = el("option", t);
    opt.value = v;
    typeSelect.appendChild(opt);
  });
  typeWrap.append(typeLabel, typeSelect);

  // Symbol input
  const symWrap = document.createElement("div");
  symWrap.className = "pf-form-row";
  const symLabel = el("label", lang === "ar" ? "الرمز:" : "Symbol:", { className: "pf-form-label" });
  const symInput = document.createElement("input");
  symInput.type = "text";
  symInput.placeholder = "BTC / USD / XAU";
  symInput.className = "pf-input";
  symInput.id = "pfSymbol";
  symWrap.append(symLabel, symInput);

  // Amount input
  const amtWrap = document.createElement("div");
  amtWrap.className = "pf-form-row";
  const amtLabel = el("label", lang === "ar" ? "الكمية:" : "Amount:", { className: "pf-form-label" });
  const amtInput = document.createElement("input");
  amtInput.type = "number";
  amtInput.placeholder = "1.5";
  amtInput.className = "pf-input";
  amtInput.id = "pfAmount";
  amtInput.min = "0";
  amtInput.step = "any";
  amtWrap.append(amtLabel, amtInput);

  // Buy price input (in DZD)
  const buyWrap = document.createElement("div");
  buyWrap.className = "pf-form-row";
  const buyLabel = el("label", lang === "ar" ? "سعر الشراء (DZD):" : "Buy Price (DZD):", { className: "pf-form-label" });
  const buyInput = document.createElement("input");
  buyInput.type = "number";
  buyInput.placeholder = "0.00";
  buyInput.className = "pf-input";
  buyInput.id = "pfBuyPrice";
  buyInput.min = "0";
  buyInput.step = "any";
  buyWrap.append(buyLabel, buyInput);

  // Add button
  const addBtn = document.createElement("button");
  addBtn.className = "pf-btn pf-btn-add";
  addBtn.textContent = lang === "ar" ? "إضافة" : lang === "fr" ? "Ajouter" : "Add Asset";
  addBtn.addEventListener("click", async () => {
    addBtn.disabled = true;
    const result = await addAsset({
      symbol: symInput.value.trim(),
      amount: amtInput.value,
      buyPrice: buyInput.value,
      type: typeSelect.value,
    });
    addBtn.disabled = false;
    if (result.ok) {
      symInput.value = "";
      amtInput.value = "";
      buyInput.value = "";
      showToast(lang === "ar" ? "✅ تمت الإضافة" : "✅ Asset added");
      renderPortfolio();
    } else {
      showToast(lang === "ar" ? "⚠️ بيانات غير صحيحة" : "⚠️ Invalid input");
    }
  });

  form.append(title, typeWrap, symWrap, amtWrap, buyWrap, addBtn);
  return form;
}

function _buildAssetCard(asset, stats, lang) {
  const card = document.createElement("div");
  card.className = "pf-asset-card";

  const nameStr = CRYPTOS[asset.symbol]?.name
    || currencyNames[asset.symbol]
    || asset.symbol;

  const header = document.createElement("div");
  header.className = "pf-asset-header";

  const nameEl = el("div", `${asset.symbol} · ${nameStr}`, { className: "pf-asset-name" });
  const typeTag = el("span", asset.type, { className: `pf-type-tag pf-type-${asset.type}` });

  header.append(nameEl, typeTag);

  const amtEl = el("div",
    `${lang === "ar" ? "الكمية:" : "Qty:"} ${fmt6(asset.amount)}`,
    { className: "pf-asset-row" });

  const costEl = el("div",
    `${lang === "ar" ? "التكلفة:" : "Cost:"} ${fmt(stats.costBasisDZD)} DZD`,
    { className: "pf-asset-row" });

  let valueEl, pnlEl;
  if (stats.currentValueDZD !== null) {
    valueEl = el("div",
      `${lang === "ar" ? "القيمة الحالية:" : "Current:"} ${fmt(stats.currentValueDZD)} DZD`,
      { className: "pf-asset-row pf-asset-value" });

    const pnlSign = stats.pnlDZD >= 0 ? "+" : "";
    const pnlColor = stats.pnlDZD >= 0 ? "var(--up-color,#22c55e)" : "var(--down-color,#ef4444)";
    pnlEl = el("div",
      `P&L: ${pnlSign}${fmt(stats.pnlDZD)} DZD (${pnlSign}${stats.pnlPct.toFixed(2)}%)`,
      { className: "pf-asset-row pf-asset-pnl", style: `color:${pnlColor};font-weight:600` });
  } else {
    valueEl = el("div",
      lang === "ar" ? "السعر غير متوفر" : "Price unavailable",
      { className: "pf-asset-row pf-asset-na" });
    pnlEl = document.createElement("div");
  }

  // Delete button
  const delBtn = document.createElement("button");
  delBtn.className = "pf-btn pf-btn-del";
  delBtn.textContent = lang === "ar" ? "حذف" : "Remove";
  delBtn.addEventListener("click", async () => {
    delBtn.disabled = true;
    const result = await removeAsset(asset.id);
    if (result.ok) {
      showToast(lang === "ar" ? "🗑️ تم الحذف" : "🗑️ Removed");
      renderPortfolio();
    } else {
      delBtn.disabled = false;
      showToast(lang === "ar" ? "⚠️ تعذر الحذف" : "⚠️ Could not remove");
    }
  });

  card.append(header, amtEl, costEl, valueEl, pnlEl, delBtn);
  return card;
}
