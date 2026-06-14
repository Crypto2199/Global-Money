// ═══════════════════════════════════════════════
//  Global Money — js/portfolio.js
//  Portfolio Tracker: all currencies (fiat/crypto/metal)
//  Reference currency: USD
// ═══════════════════════════════════════════════
import { state } from "./state.js";
import { safeGetJSON, safeSetJSON, currencyNames, CRYPTOS, countryMap } from "./storage.js";
import { el, showToast, fmt, fmt6 } from "./ui.js";
import { tr } from "./i18n.js";
import { dbGetPortfolio, dbSetPortfolio, isDBReady } from "./database.js";
import { getMetalsRates } from "./api.js";

const PORTFOLIO_KEY = "portfolioData";
const FALLBACK      = { assets: [], updatedAt: null };

// Metal symbols & names
const METALS = {
  XAU: { name: "Gold",     icon: "🥇", unit: "oz" },
  XAG: { name: "Silver",   icon: "🥈", unit: "oz" },
  XPT: { name: "Platinum", icon: "⬡",  unit: "oz" },
  XPD: { name: "Palladium",icon: "◈",  unit: "oz" },
};

// ── Data Helpers ──────────────────────────────────
export function getPortfolio() {
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
  safeSetJSON(PORTFOLIO_KEY, data);
  if (isDBReady()) await dbSetPortfolio(data).catch(() => {});
  return true;
}

// ── Asset Operations ──────────────────────────────
export async function addAsset({ symbol, amount, buyPrice, type }) {
  if (!symbol || isNaN(parseFloat(amount)) || isNaN(parseFloat(buyPrice))) {
    return { ok: false, error: "invalid_input" };
  }
  const portfolio = await getPortfolioAsync();
  const id = `${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
  portfolio.assets.push({
    id,
    symbol: symbol.toUpperCase(),
    amount: parseFloat(amount),
    buyPrice: parseFloat(buyPrice), // stored in USD
    type,
    addedAt: Date.now(),
  });
  await savePortfolio(portfolio);
  return { ok: true, id };
}
export async function removeAsset(id) {
  const portfolio = await getPortfolioAsync();
  const before = portfolio.assets.length;
  portfolio.assets = portfolio.assets.filter(a => a.id !== id);
  if (portfolio.assets.length === before) return { ok: false };
  await savePortfolio(portfolio);
  return { ok: true };
}
export async function editAsset(id, updates) {
  const portfolio = await getPortfolioAsync();
  const idx = portfolio.assets.findIndex(a => a.id === id);
  if (idx === -1) return { ok: false };
  if (updates.amount   !== undefined) portfolio.assets[idx].amount   = parseFloat(updates.amount);
  if (updates.buyPrice !== undefined) portfolio.assets[idx].buyPrice = parseFloat(updates.buyPrice);
  await savePortfolio(portfolio);
  return { ok: true };
}

// ── Price in USD ──────────────────────────────────
function getPriceUSD(asset) {
  const { fiatRates, cryptoRates } = state;

  if (asset.type === "crypto") {
    // cryptoRates are in USD directly
    return cryptoRates[asset.symbol] || null;
  }

  if (asset.type === "metal") {
    const m = getMetalsRates();
    return (m && m[asset.symbol]) ? m[asset.symbol] : null;
  }

  // fiat: 1 unit of asset.symbol in USD
  if (!fiatRates || !fiatRates["USD"] || !fiatRates[asset.symbol]) return null;
  // fiatRates are relative to USD base
  return 1 / fiatRates[asset.symbol]; // USD per 1 unit of currency
}

// ── Stats (all in USD) ─────────────────────────────
export function calcAssetStats(asset) {
  const priceUSD = getPriceUSD(asset);
  if (priceUSD === null) {
    return {
      priceUSD: null,
      currentValueUSD: null,
      costBasisUSD: asset.amount * asset.buyPrice,
      pnlUSD: null,
      pnlPct: null,
    };
  }
  const currentValueUSD = asset.amount * priceUSD;
  const costBasisUSD    = asset.amount * asset.buyPrice;
  const pnlUSD          = currentValueUSD - costBasisUSD;
  const pnlPct          = costBasisUSD !== 0 ? (pnlUSD / costBasisUSD) * 100 : 0;
  return { priceUSD, currentValueUSD, costBasisUSD, pnlUSD, pnlPct };
}

export function calcPortfolioTotal() {
  const portfolio = getPortfolio();
  let totalValueUSD = 0, totalCostUSD = 0;
  portfolio.assets.forEach(asset => {
    const s = calcAssetStats(asset);
    if (s.currentValueUSD !== null) totalValueUSD += s.currentValueUSD;
    totalCostUSD += s.costBasisUSD;
  });
  const pnlUSD = totalValueUSD - totalCostUSD;
  const pnlPct = totalCostUSD !== 0 ? (pnlUSD / totalCostUSD) * 100 : 0;
  return { totalValueUSD, totalCostUSD, pnlUSD, pnlPct, count: portfolio.assets.length };
}

// ── Format USD ────────────────────────────────────
function fmtUSD(n) {
  if (n == null || !isFinite(n)) return "—";
  return "$" + n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}
function fmtUSDlong(n) {
  if (n == null || !isFinite(n)) return "—";
  const abs = Math.abs(n);
  const dec = abs < 0.001 ? 8 : abs < 1 ? 6 : abs < 100 ? 4 : 2;
  return "$" + n.toLocaleString("en-US", { minimumFractionDigits: dec, maximumFractionDigits: dec });
}

// ── Build full currency list for dropdown ─────────
function buildCurrencyList() {
  const items = [];

  // Crypto
  Object.entries(CRYPTOS).forEach(([sym, info]) => {
    items.push({ sym, name: info.name, icon: info.icon, type: "crypto", group: "Crypto" });
  });

  // Fiat — all in currencyNames
  Object.entries(currencyNames).forEach(([sym, name]) => {
    const cc = countryMap[sym];
    const flag = cc ? `https://flagcdn.com/16x12/${cc}.png` : null;
    items.push({ sym, name, flag, type: "fiat", group: "Fiat" });
  });

  // Metals
  Object.entries(METALS).forEach(([sym, info]) => {
    items.push({ sym, name: info.name, icon: info.icon, type: "metal", group: "Metals" });
  });

  return items;
}

// ── Searchable Currency Dropdown ──────────────────
function buildSearchDropdown(containerId, onSelect) {
  const wrap = document.createElement("div");
  wrap.className = "pf-dropdown-wrap";

  const display = document.createElement("div");
  display.className = "pf-dropdown-display";
  display.id = containerId + "_display";
  display.innerHTML = `<span class="pf-dd-placeholder">— اختر عملة / Select —</span>`;
  display.tabIndex = 0;

  const panel = document.createElement("div");
  panel.className = "pf-dropdown-panel";
  panel.style.display = "none";

  const searchInput = document.createElement("input");
  searchInput.type = "text";
  searchInput.placeholder = "🔍 Search...";
  searchInput.className = "pf-dd-search";

  const list = document.createElement("div");
  list.className = "pf-dd-list";

  const allItems = buildCurrencyList();
  let selectedSym = null;
  let selectedType = null;

  function renderList(filter = "") {
    list.innerHTML = "";
    const q = filter.toLowerCase();
    const filtered = allItems.filter(i =>
      i.sym.toLowerCase().includes(q) || i.name.toLowerCase().includes(q)
    );

    // Group by type
    const groups = { Crypto: [], Fiat: [], Metals: [] };
    filtered.forEach(i => (groups[i.group] || []).push(i));

    Object.entries(groups).forEach(([grp, grpItems]) => {
      if (!grpItems.length) return;
      const grpEl = document.createElement("div");
      grpEl.className = "pf-dd-group";
      grpEl.textContent = grp === "Crypto" ? "₿ Crypto" : grp === "Fiat" ? "🌍 Fiat" : "🥇 Metals";
      list.appendChild(grpEl);

      grpItems.forEach(item => {
        const row = document.createElement("div");
        row.className = "pf-dd-item" + (item.sym === selectedSym ? " selected" : "");
        row.dataset.sym  = item.sym;
        row.dataset.type = item.type;

        const left = document.createElement("div");
        left.className = "pf-dd-left";
        if (item.flag) {
          const img = document.createElement("img");
          img.src = item.flag; img.alt = item.sym;
          img.style.cssText = "width:16px;height:12px;border-radius:2px;flex-shrink:0;";
          left.appendChild(img);
        } else if (item.icon) {
          const ic = document.createElement("span");
          ic.className = "pf-dd-icon";
          ic.textContent = item.icon;
          left.appendChild(ic);
        }
        const sym = document.createElement("span");
        sym.className = "pf-dd-sym";
        sym.textContent = item.sym;
        const name = document.createElement("span");
        name.className = "pf-dd-name";
        name.textContent = item.name;
        left.appendChild(sym);
        left.appendChild(name);
        row.appendChild(left);

        row.addEventListener("click", () => {
          selectedSym  = item.sym;
          selectedType = item.type;
          display.innerHTML = "";
          if (item.flag) {
            const img = document.createElement("img");
            img.src = item.flag; img.alt = item.sym;
            img.style.cssText = "width:16px;height:12px;border-radius:2px;margin-inline-end:6px;";
            display.appendChild(img);
          } else if (item.icon) {
            const ic = document.createElement("span");
            ic.style.marginInlineEnd = "6px";
            ic.textContent = item.icon;
            display.appendChild(ic);
          }
          const t = document.createElement("span");
          t.textContent = `${item.sym} · ${item.name}`;
          display.appendChild(t);
          panel.style.display = "none";
          onSelect(item.sym, item.type);
        });
        list.appendChild(row);
      });
    });

    if (!filtered.length) {
      const empty = document.createElement("div");
      empty.className = "pf-dd-empty";
      empty.textContent = "No results";
      list.appendChild(empty);
    }
  }

  searchInput.addEventListener("input", () => renderList(searchInput.value));
  display.addEventListener("click", (e) => {
    e.stopPropagation();
    const isOpen = panel.style.display !== "none";
    panel.style.display = isOpen ? "none" : "block";
    if (!isOpen) { searchInput.value = ""; renderList(); searchInput.focus(); }
  });
  document.addEventListener("click", () => { panel.style.display = "none"; });
  panel.addEventListener("click", e => e.stopPropagation());

  renderList();
  panel.appendChild(searchInput);
  panel.appendChild(list);
  wrap.appendChild(display);
  wrap.appendChild(panel);

  wrap.getSelected = () => ({ sym: selectedSym, type: selectedType });
  return wrap;
}

// ── Render ────────────────────────────────────────
export function renderPortfolio() {
  const container = document.getElementById("portfolioContainer");
  if (!container) return;

  const portfolio = getPortfolio();
  const totals    = calcPortfolioTotal();
  const lang      = state.lang;

  container.innerHTML = "";

  // ── Summary ──
  const summary = document.createElement("div");
  summary.className = "portfolio-summary";

  const totalLabel = el("div",
    lang === "ar" ? "إجمالي المحفظة (USD)" : lang === "fr" ? "Valeur totale (USD)" : "Total Portfolio (USD)",
    { className: "pf-label" });

  const totalVal = el("div", fmtUSD(totals.totalValueUSD), { className: "pf-total-value" });

  const pnlSign  = totals.pnlUSD >= 0 ? "+" : "";
  const pnlColor = totals.pnlUSD >= 0 ? "var(--up,#22c55e)" : "var(--down,#ef4444)";
  const pnlEl    = el("div",
    `${pnlSign}${fmtUSD(totals.pnlUSD)}  (${pnlSign}${totals.pnlPct.toFixed(2)}%)`,
    { className: "pf-pnl", style: `color:${pnlColor}` });

  const costEl = el("div",
    `${lang === "ar" ? "تكلفة الشراء:" : "Cost Basis:"} ${fmtUSD(totals.totalCostUSD)}`,
    { className: "pf-cost" });

  const assetCount = el("div",
    `${totals.count} ${lang === "ar" ? "أصل" : lang === "fr" ? "actifs" : "assets"}`,
    { className: "pf-count" });

  summary.append(totalLabel, totalVal, pnlEl, costEl, assetCount);
  container.appendChild(summary);

  // ── Add form ──
  container.appendChild(_buildAddForm(lang));

  // ── Asset list ──
  if (!portfolio.assets.length) {
    container.appendChild(el("div",
      lang === "ar" ? "لا توجد أصول. أضف أصلاً جديداً." :
      lang === "fr" ? "Aucun actif. Ajoutez-en un." :
      "No assets yet. Add your first asset above.",
      { className: "pf-empty" }));
    return;
  }

  const list = document.createElement("div");
  list.className = "portfolio-list";
  portfolio.assets.forEach(asset => {
    list.appendChild(_buildAssetCard(asset, calcAssetStats(asset), lang));
  });
  container.appendChild(list);
}

// ── Add Form ──────────────────────────────────────
function _buildAddForm(lang) {
  const form = document.createElement("div");
  form.className = "pf-add-form";

  const title = el("h3",
    lang === "ar" ? "➕ إضافة أصل جديد" : lang === "fr" ? "➕ Ajouter un actif" : "➕ Add New Asset",
    { className: "pf-form-title" });

  // Currency searchable dropdown
  const ddLabel = el("label",
    lang === "ar" ? "العملة / الأصل:" : "Currency / Asset:",
    { className: "pf-form-label" });

  let selectedSym  = null;
  let selectedType = null;

  const dropdown = buildSearchDropdown("pfCurrencyDd", (sym, type) => {
    selectedSym  = sym;
    selectedType = type;
    // Auto-fill current market price as buy price hint
    const hint = _getCurrentPriceHint(sym, type);
    if (hint !== null) buyInput.placeholder = hint.toFixed(hint < 0.001 ? 8 : hint < 1 ? 6 : 2);
  });

  // Amount
  const amtLabel = el("label",
    lang === "ar" ? "الكمية:" : lang === "fr" ? "Quantité:" : "Amount:",
    { className: "pf-form-label" });
  const amtInput = document.createElement("input");
  amtInput.type = "number"; amtInput.placeholder = "1.0";
  amtInput.className = "pf-input"; amtInput.id = "pfAmount";
  amtInput.min = "0"; amtInput.step = "any";

  // Buy price in USD
  const buyLabel = el("label",
    lang === "ar" ? "سعر الشراء (USD):" : lang === "fr" ? "Prix d'achat (USD):" : "Buy Price (USD):",
    { className: "pf-form-label" });
  const buyInput = document.createElement("input");
  buyInput.type = "number"; buyInput.placeholder = "0.00";
  buyInput.className = "pf-input"; buyInput.id = "pfBuyPrice";
  buyInput.min = "0"; buyInput.step = "any";

  // Fill price button
  const fillBtn = document.createElement("button");
  fillBtn.className = "pf-btn pf-btn-ghost";
  fillBtn.textContent = lang === "ar" ? "📊 السعر الحالي" : "📊 Use Market Price";
  fillBtn.addEventListener("click", () => {
    if (!selectedSym) { showToast(lang === "ar" ? "اختر عملة أولاً" : "Select a currency first"); return; }
    const p = _getCurrentPriceHint(selectedSym, selectedType);
    if (p !== null) {
      buyInput.value = p;
      showToast("✅ " + (lang === "ar" ? "تم تعبئة السعر الحالي" : "Market price filled"));
    } else {
      showToast("⚠️ " + (lang === "ar" ? "السعر غير متاح" : "Price unavailable"));
    }
  });

  // Add button
  const addBtn = document.createElement("button");
  addBtn.className = "pf-btn pf-btn-add";
  addBtn.textContent = lang === "ar" ? "إضافة للمحفظة" : lang === "fr" ? "Ajouter" : "Add to Portfolio";
  addBtn.addEventListener("click", async () => {
    if (!selectedSym) { showToast(lang === "ar" ? "⚠️ اختر عملة" : "⚠️ Select a currency"); return; }
    addBtn.disabled = true;
    const result = await addAsset({
      symbol:   selectedSym,
      amount:   amtInput.value,
      buyPrice: buyInput.value,
      type:     selectedType,
    });
    addBtn.disabled = false;
    if (result.ok) {
      amtInput.value = ""; buyInput.value = "";
      showToast(lang === "ar" ? "✅ تمت الإضافة" : "✅ Asset added");
      renderPortfolio();
    } else {
      showToast(lang === "ar" ? "⚠️ بيانات غير صحيحة" : "⚠️ Invalid input");
    }
  });

  const row1 = document.createElement("div"); row1.className = "pf-form-section";
  row1.appendChild(ddLabel); row1.appendChild(dropdown);

  const row2 = document.createElement("div"); row2.className = "pf-form-row";
  row2.appendChild(amtLabel); row2.appendChild(amtInput);

  const row3 = document.createElement("div"); row3.className = "pf-form-row";
  const buyRow = document.createElement("div"); buyRow.className = "pf-buy-row";
  buyRow.appendChild(buyInput); buyRow.appendChild(fillBtn);
  row3.appendChild(buyLabel); row3.appendChild(buyRow);

  form.append(title, row1, row2, row3, addBtn);
  return form;
}

function _getCurrentPriceHint(sym, type) {
  const { fiatRates, cryptoRates } = state;
  if (type === "crypto") return cryptoRates[sym] || null;
  if (type === "metal") { const m = getMetalsRates(); return (m && m[sym]) ? m[sym] : null; }
  if (type === "fiat" && fiatRates[sym]) return 1 / fiatRates[sym]; // USD per 1 unit
  return null;
}

// ── Asset Card ────────────────────────────────────
function _buildAssetCard(asset, stats, lang) {
  const card = document.createElement("div");
  card.className = "pf-asset-card";

  const info = CRYPTOS[asset.symbol] || METALS[asset.symbol];
  const name = info?.name || currencyNames[asset.symbol] || asset.symbol;
  const icon = info?.icon || null;
  const cc   = countryMap[asset.symbol];

  // Header
  const hdr = document.createElement("div");
  hdr.className = "pf-asset-header";

  const iconWrap = document.createElement("div");
  iconWrap.className = "pf-asset-icon";
  if (cc) {
    const img = document.createElement("img");
    img.src = `https://flagcdn.com/24x18/${cc}.png`; img.alt = asset.symbol;
    img.style.cssText = "border-radius:3px;";
    iconWrap.appendChild(img);
  } else if (icon) {
    iconWrap.textContent = icon;
    iconWrap.style.fontSize = "1.3rem";
  }

  const nameWrap = document.createElement("div");
  const symEl  = el("div", asset.symbol, { className: "pf-asset-sym" });
  const nameEl = el("div", name,         { className: "pf-asset-name-small" });
  nameWrap.appendChild(symEl); nameWrap.appendChild(nameEl);

  const typeTag = el("span", asset.type === "crypto" ? "₿ Crypto" : asset.type === "metal" ? "🥇 Metal" : "🌍 Fiat",
    { className: `pf-type-tag pf-type-${asset.type}` });

  hdr.appendChild(iconWrap); hdr.appendChild(nameWrap); hdr.appendChild(typeTag);
  card.appendChild(hdr);

  // Rows
  const grid = document.createElement("div");
  grid.className = "pf-asset-grid";

  const makeCell = (label, value, cls = "") => {
    const cell = document.createElement("div");
    cell.className = "pf-asset-cell" + (cls ? " " + cls : "");
    cell.innerHTML = `<span class="pf-cell-label">${label}</span><span class="pf-cell-val">${value}</span>`;
    return cell;
  };

  grid.appendChild(makeCell(lang === "ar" ? "الكمية" : "Qty", fmt6(asset.amount)));
  grid.appendChild(makeCell(lang === "ar" ? "سعر الشراء" : "Buy Price", fmtUSDlong(asset.buyPrice)));
  grid.appendChild(makeCell(lang === "ar" ? "السعر الحالي" : "Price Now",
    stats.priceUSD !== null ? fmtUSDlong(stats.priceUSD) : "—"));
  grid.appendChild(makeCell(lang === "ar" ? "القيمة الحالية" : "Value",
    stats.currentValueUSD !== null ? fmtUSD(stats.currentValueUSD) : "—"));
  grid.appendChild(makeCell(lang === "ar" ? "تكلفة الشراء" : "Cost",
    fmtUSD(stats.costBasisUSD)));

  if (stats.pnlUSD !== null) {
    const sign  = stats.pnlUSD >= 0 ? "+" : "";
    const color = stats.pnlUSD >= 0 ? "var(--up,#22c55e)" : "var(--down,#ef4444)";
    const pnlCell = makeCell(
      "P&L",
      `<span style="color:${color};font-weight:700">${sign}${fmtUSD(stats.pnlUSD)} (${sign}${stats.pnlPct.toFixed(2)}%)</span>`
    );
    grid.appendChild(pnlCell);
  }

  card.appendChild(grid);

  // Delete button
  const delBtn = document.createElement("button");
  delBtn.className = "pf-btn pf-btn-del";
  delBtn.textContent = lang === "ar" ? "🗑 حذف" : lang === "fr" ? "Supprimer" : "Remove";
  delBtn.addEventListener("click", async () => {
    delBtn.disabled = true;
    const r = await removeAsset(asset.id);
    if (r.ok) { showToast(lang === "ar" ? "🗑️ تم الحذف" : "🗑️ Removed"); renderPortfolio(); }
    else { delBtn.disabled = false; }
  });
  card.appendChild(delBtn);
  return card;
}
