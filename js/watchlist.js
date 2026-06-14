// ═══════════════════════════════════════════════
//  Global Money v4.2 — js/watchlist.js
//  Standalone Watchlist: fiat + crypto favorites
//  v4.2: Primary storage migrated to IndexedDB (database.js)
//        with automatic localStorage fallback for compatibility
// ═══════════════════════════════════════════════
import { state } from "./state.js";
import { safeGetJSON, safeSetJSON, currencyNames, CRYPTOS } from "./storage.js";
import { el, showToast, getFlag, fmt, fmt6 } from "./ui.js";
import { dbGetWatchlist, dbSetWatchlist, isDBReady } from "./database.js";

const WATCHLIST_KEY = "watchlistData";
const FALLBACK      = { items: [] };

// ── Data — IndexedDB primary, localStorage fallback ───────────
export function getWatchlist() {
  return safeGetJSON(WATCHLIST_KEY, FALLBACK);
}

export async function getWatchlistAsync() {
  if (isDBReady()) {
    const data = await dbGetWatchlist();
    if (data && Array.isArray(data.items)) return data;
  }
  return safeGetJSON(WATCHLIST_KEY, FALLBACK);
}

async function saveWatchlist(data) {
  safeSetJSON(WATCHLIST_KEY, data);
  if (isDBReady()) {
    await dbSetWatchlist(data).catch(() => {});
  }
}

// ── Operations ────────────────────────────────────
export async function addToWatchlist(symbol, type = "fiat") {
  const wl = await getWatchlistAsync();
  if (wl.items.find(i => i.symbol === symbol)) {
    return { ok: false, reason: "duplicate" };
  }
  wl.items.push({ symbol: symbol.toUpperCase(), type, addedAt: Date.now() });
  await saveWatchlist(wl);
  return { ok: true };
}

export async function removeFromWatchlist(symbol) {
  const wl = await getWatchlistAsync();
  const before = wl.items.length;
  wl.items = wl.items.filter(i => i.symbol !== symbol);
  if (wl.items.length === before) return { ok: false, reason: "not_found" };
  await saveWatchlist(wl);
  return { ok: true };
}

export function isInWatchlist(symbol) {
  return getWatchlist().items.some(i => i.symbol === symbol);
}

export async function reorderWatchlist(fromIdx, toIdx) {
  const wl = await getWatchlistAsync();
  if (fromIdx < 0 || toIdx < 0 || fromIdx >= wl.items.length || toIdx >= wl.items.length) {
    return { ok: false };
  }
  const [item] = wl.items.splice(fromIdx, 1);
  wl.items.splice(toIdx, 0, item);
  await saveWatchlist(wl);
  return { ok: true };
}

// ── Price Resolver ────────────────────────────────
function getItemPrice(item) {
  const { fiatRates, cryptoRates } = state;
  if (item.type === "crypto") {
    const p = cryptoRates[item.symbol];
    return p ? { value: p, unit: "USDT" } : null;
  }
  if (fiatRates[item.symbol] && fiatRates["DZD"]) {
    const dzdPer = fiatRates["DZD"] / fiatRates[item.symbol];
    return { value: dzdPer, unit: "DZD" };
  }
  return null;
}

// ── Render ────────────────────────────────────────
export function renderWatchlist() {
  const container = document.getElementById("watchlistContainer");
  if (!container) return;

  const wl = getWatchlist();
  const lang = state.lang;
  container.textContent = "";

  // Header + add controls
  container.appendChild(_buildWatchlistControls(lang));

  if (!wl.items.length) {
    container.appendChild(
      el("div",
        lang === "ar" ? "القائمة فارغة. أضف عملات لمتابعتها." : lang === "fr" ? "Liste vide. Ajoutez des devises." : "Watchlist empty. Add currencies to track.",
        { className: "wl-empty" })
    );
    return;
  }

  const list = document.createElement("div");
  list.className = "wl-list";
  list.id = "wlList";

  wl.items.forEach((item, idx) => {
    list.appendChild(_buildWatchItem(item, idx, wl.items.length, lang));
  });

  container.appendChild(list);
}

function _buildWatchlistControls(lang) {
  const wrap = document.createElement("div");
  wrap.className = "wl-controls";

  // Fiat add
  const fiatRow = document.createElement("div");
  fiatRow.className = "wl-add-row";

  const fiatInput = document.createElement("input");
  fiatInput.type = "text";
  fiatInput.className = "wl-input";
  fiatInput.placeholder = lang === "ar" ? "رمز العملة (USD)" : "Fiat symbol (USD)";
  fiatInput.id = "wlFiatInput";

  const addFiatBtn = document.createElement("button");
  addFiatBtn.className = "wl-btn wl-btn-add";
  addFiatBtn.textContent = lang === "ar" ? "إضافة عملة" : lang === "fr" ? "Ajouter" : "Add Fiat";
  addFiatBtn.addEventListener("click", async () => {
    const sym = fiatInput.value.trim().toUpperCase();
    if (!sym) return;
    addFiatBtn.disabled = true;
    const res = await addToWatchlist(sym, "fiat");
    addFiatBtn.disabled = false;
    if (res.ok) {
      fiatInput.value = "";
      showToast(lang === "ar" ? `✅ تمت إضافة ${sym}` : `✅ Added ${sym}`);
      renderWatchlist();
    } else if (res.reason === "duplicate") {
      showToast(lang === "ar" ? "⚠️ مضافة بالفعل" : "⚠️ Already in watchlist");
    }
  });
  fiatRow.append(fiatInput, addFiatBtn);

  // Crypto add
  const cryptoRow = document.createElement("div");
  cryptoRow.className = "wl-add-row";

  const cryptoSelect = document.createElement("select");
  cryptoSelect.className = "wl-select";
  cryptoSelect.id = "wlCryptoSelect";
  Object.entries(CRYPTOS).forEach(([sym, info]) => {
    const opt = el("option", `${sym} · ${info.name}`);
    opt.value = sym;
    cryptoSelect.appendChild(opt);
  });

  const addCryptoBtn = document.createElement("button");
  addCryptoBtn.className = "wl-btn wl-btn-add";
  addCryptoBtn.textContent = lang === "ar" ? "إضافة كريبتو" : lang === "fr" ? "Ajouter Crypto" : "Add Crypto";
  addCryptoBtn.addEventListener("click", async () => {
    const sym = cryptoSelect.value;
    addCryptoBtn.disabled = true;
    const res = await addToWatchlist(sym, "crypto");
    addCryptoBtn.disabled = false;
    if (res.ok) {
      showToast(lang === "ar" ? `✅ تمت إضافة ${sym}` : `✅ Added ${sym}`);
      renderWatchlist();
    } else if (res.reason === "duplicate") {
      showToast(lang === "ar" ? "⚠️ مضافة بالفعل" : "⚠️ Already in watchlist");
    }
  });
  cryptoRow.append(cryptoSelect, addCryptoBtn);

  wrap.append(fiatRow, cryptoRow);
  return wrap;
}

function _buildWatchItem(item, idx, total, lang) {
  const card = document.createElement("div");
  card.className = "wl-item";
  card.draggable = true;
  card.dataset.idx = idx;

  // Drag-to-reorder
  card.addEventListener("dragstart", e => {
    e.dataTransfer.setData("text/plain", String(idx));
  });
  card.addEventListener("dragover", e => { e.preventDefault(); card.classList.add("wl-drag-over"); });
  card.addEventListener("dragleave", () => card.classList.remove("wl-drag-over"));
  card.addEventListener("drop", async e => {
    e.preventDefault();
    card.classList.remove("wl-drag-over");
    const fromIdx = parseInt(e.dataTransfer.getData("text/plain"));
    await reorderWatchlist(fromIdx, idx);
    renderWatchlist();
  });

  // Symbol + flag/icon
  const left = document.createElement("div");
  left.className = "wl-item-left";

  if (item.type === "fiat") {
    const fl = getFlag(item.symbol);
    if (fl) {
      const img = document.createElement("img");
      img.src = fl;
      img.alt = item.symbol;
      img.className = "wl-flag";
      left.appendChild(img);
    }
  } else {
    const icon = el("span", CRYPTOS[item.symbol]?.icon || item.symbol[0], { className: "wl-crypto-icon" });
    left.appendChild(icon);
  }

  const symEl = el("span", item.symbol, { className: "wl-symbol" });
  const nameEl = el("span",
    item.type === "crypto" ? (CRYPTOS[item.symbol]?.name || item.symbol) : (currencyNames[item.symbol] || ""),
    { className: "wl-name" });
  left.append(symEl, nameEl);

  // Price
  const priceData = getItemPrice(item);
  const priceEl = el("div",
    priceData ? `${item.type === "crypto" ? fmt6(priceData.value) : fmt(priceData.value)} ${priceData.unit}` : "—",
    { className: "wl-price" });

  // Move buttons
  const moveWrap = document.createElement("div");
  moveWrap.className = "wl-move-btns";
  if (idx > 0) {
    const upBtn = el("button", "↑", { className: "wl-move-btn" });
    upBtn.addEventListener("click", async () => { await reorderWatchlist(idx, idx - 1); renderWatchlist(); });
    moveWrap.appendChild(upBtn);
  }
  if (idx < total - 1) {
    const dnBtn = el("button", "↓", { className: "wl-move-btn" });
    dnBtn.addEventListener("click", async () => { await reorderWatchlist(idx, idx + 1); renderWatchlist(); });
    moveWrap.appendChild(dnBtn);
  }

  // Remove button
  const delBtn = el("button", "✕", { className: "wl-del-btn" });
  delBtn.title = lang === "ar" ? "حذف" : "Remove";
  delBtn.addEventListener("click", async () => {
    delBtn.disabled = true;
    const res = await removeFromWatchlist(item.symbol);
    if (res.ok) {
      showToast(lang === "ar" ? `🗑️ تم حذف ${item.symbol}` : `🗑️ Removed ${item.symbol}`);
      renderWatchlist();
    } else {
      delBtn.disabled = false;
      showToast(lang === "ar" ? "⚠️ تعذر الحذف" : "⚠️ Could not remove");
    }
  });

  card.append(left, priceEl, moveWrap, delBtn);
  return card;
}
