// ═══════════════════════════════════════════════
//  Global Money v5 — js/ticker.js
//  Live ticker: Forex + All Crypto from Binance WS
// ═══════════════════════════════════════════════

import { state } from "./state.js";
const TICKER_PAIRS = [
  { id: 'EURUSD',  sym: 'EUR/USD',  base: 'EUR', quote: 'USD', decimals: 4 },
  { id: 'GBPUSD',  sym: 'GBP/USD',  base: 'GBP', quote: 'USD', decimals: 4 },
  { id: 'USDJPY',  sym: 'USD/JPY',  base: 'USD', quote: 'JPY', decimals: 2 },
  { id: 'USDCAD',  sym: 'USD/CAD',  base: 'USD', quote: 'CAD', decimals: 4 },
  { id: 'USDCHF',  sym: 'USD/CHF',  base: 'USD', quote: 'CHF', decimals: 4 },
  { id: 'AUDUSD',  sym: 'AUD/USD',  base: 'AUD', quote: 'USD', decimals: 4 },
  { id: 'USDSAR',  sym: 'USD/SAR',  base: 'USD', quote: 'SAR', decimals: 4 },
  { id: 'USDAED',  sym: 'USD/AED',  base: 'USD', quote: 'AED', decimals: 4 },
  { id: 'EURGBP',  sym: 'EUR/GBP',  base: 'EUR', quote: 'GBP', decimals: 4 },
  { id: 'USDDZD',  sym: 'USD/DZD',  base: 'USD', quote: 'DZD', decimals: 2 },
];

// جميع العملات الرقمية للتيكر — بيانات حية من Binance
const CRYPTO_TICKER_PAIRS = [
  { id: 'BTCUSDT',  sym: 'BTC/USDT',  wsym: 'btcusdt',  decimals: 0 },
  { id: 'ETHUSDT',  sym: 'ETH/USDT',  wsym: 'ethusdt',  decimals: 2 },
  { id: 'BNBUSDT',  sym: 'BNB/USDT',  wsym: 'bnbusdt',  decimals: 2 },
  { id: 'SOLUSDT',  sym: 'SOL/USDT',  wsym: 'solusdt',  decimals: 2 },
  { id: 'XRPUSDT',  sym: 'XRP/USDT',  wsym: 'xrpusdt',  decimals: 4 },
  { id: 'ADAUSDT',  sym: 'ADA/USDT',  wsym: 'adausdt',  decimals: 5 },
  { id: 'DOGEUSDT', sym: 'DOGE/USDT', wsym: 'dogeusdt', decimals: 5 },
  { id: 'DOTUSDT',  sym: 'DOT/USDT',  wsym: 'dotusdt',  decimals: 3 },
  { id: 'MATICUSDT',sym: 'MATIC/USDT',wsym: 'maticusdt',decimals: 4 },
  { id: 'LTCUSDT',  sym: 'LTC/USDT',  wsym: 'ltcusdt',  decimals: 2 },
  { id: 'AVAXUSDT', sym: 'AVAX/USDT', wsym: 'avaxusdt', decimals: 2 },
  { id: 'LINKUSDT', sym: 'LINK/USDT', wsym: 'linkusdt', decimals: 3 },
  { id: 'UNIUSDT',  sym: 'UNI/USDT',  wsym: 'uniusdt',  decimals: 3 },
  { id: 'ATOMUSDT', sym: 'ATOM/USDT', wsym: 'atomusdt', decimals: 3 },
  { id: 'ETCUSDT',  sym: 'ETC/USDT',  wsym: 'etcusdt',  decimals: 2 },
];

// قاموس لتسريع البحث
const cryptoByWsym = {};
CRYPTO_TICKER_PAIRS.forEach(p => { cryptoByWsym[p.wsym] = p; });

const prevPrices = {};
const cryptoPrices = {}; // أسعار حية من Binance WS

function computeForexPrice(pair, rates) {
  if (!rates) return null;
  const { base, quote } = pair;
  const baseRate  = base  === 'USD' ? 1 : rates[base];
  const quoteRate = quote === 'USD' ? 1 : rates[quote];
  if (!baseRate || !quoteRate) return null;
  return quoteRate / baseRate;
}

function fmt(price, decimals) {
  if (price == null || isNaN(price)) return '—';
  return price.toLocaleString('en-US', { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
}

function flashPrice(el, direction) {
  el.classList.remove('flash-up', 'flash-down');
  void el.offsetWidth;
  if (direction > 0) el.classList.add('flash-up');
  else if (direction < 0) el.classList.add('flash-down');
  setTimeout(() => el.classList.remove('flash-up', 'flash-down'), 700);
}

function updateTickerItem(id, price, decimals, change24h) {
  const els = document.querySelectorAll(`[data-ticker="${id}"], [data-ticker="${id}2"]`);
  if (!els.length) return;

  const prev = prevPrices[id];
  const direction = prev != null ? Math.sign(price - prev) : 0;

  els.forEach(priceEl => {
    const changeEl = priceEl.nextElementSibling;
    const newText = fmt(price, decimals);

    if (priceEl.textContent !== newText) {
      priceEl.textContent = newText;
      if (direction !== 0) flashPrice(priceEl, direction);
    }

    if (changeEl) {
      let pct = change24h;
      if (pct == null && prev != null && prev > 0) {
        pct = ((price - prev) / prev) * 100;
      }
      if (pct != null) {
        const sign = pct >= 0 ? '+' : '';
        const arrow = pct > 0.001 ? '↑' : pct < -0.001 ? '↓' : '';
        changeEl.textContent = `${arrow}${sign}${pct.toFixed(2)}%`;
        changeEl.className = 'ticker-change ' + (pct > 0.001 ? 'up' : pct < -0.001 ? 'down' : 'flat');
      }
    }
  });

  prevPrices[id] = price;
}

function updateTickerTimestamp() {
  const el = document.getElementById('tickerUpdated');
  if (el) el.textContent = new Date().toLocaleTimeString();
}

// ── Binance WebSocket — بيانات حية لجميع العملات الرقمية ──
let _binanceWS = null;
let _wsReconnectTimer = null;

function startCryptoTickerWS() {
  if (_binanceWS && _binanceWS.readyState === WebSocket.OPEN) return;

  const streams = CRYPTO_TICKER_PAIRS.map(p => `${p.wsym}@ticker`).join('/');
  const wsUrl = `wss://stream.binance.com:9443/stream?streams=${streams}`;

  try {
    _binanceWS = new WebSocket(wsUrl);

    _binanceWS.onopen = () => {
      console.log('[ticker] ✅ Binance WS متصل — جميع العملات الرقمية حية');
      clearTimeout(_wsReconnectTimer);
    };

    _binanceWS.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data);
        const d = msg.data;
        if (!d || !d.s) return;

        const wsym = d.s.toLowerCase();
        const pair = cryptoByWsym[wsym];
        if (!pair) return;

        const price = parseFloat(d.c); // آخر سعر
        const change24h = parseFloat(d.P); // نسبة التغيير 24 ساعة

        if (isNaN(price) || price <= 0) return;

        cryptoPrices[pair.id] = { price, change24h };

        // تحديث العنصر في التيكر مباشرة
        updateTickerItem(pair.id, price, pair.decimals, change24h);

        // حدّث state.cryptoChange24h بدلاً من window global
        const shortSym = pair.id.replace('USDT', '');
        import('./state.js').then(({ state }) => {
          state.setCryptoChange24h(shortSym, change24h);
        }).catch(() => {});

        updateTickerTimestamp();
      } catch (_) {}
    };

    _binanceWS.onerror = (e) => {
      console.warn('[ticker] ⚠️ خطأ في Binance WS:', e?.message || 'unknown');
    };

    _binanceWS.onclose = () => {
      console.warn('[ticker] 🔄 Binance WS مغلق — إعادة الاتصال بعد 5 ثواني...');
      _wsReconnectTimer = setTimeout(startCryptoTickerWS, 5000);
    };
  } catch (e) {
    console.warn('[ticker] فشل إنشاء WS:', e?.message);
    _wsReconnectTimer = setTimeout(startCryptoTickerWS, 10000);
  }
}

// Called by old Binance WS flow (backwards compat)
export function refreshTickerSymbol(sym, price) {
  const pair = CRYPTO_TICKER_PAIRS.find(p => p.id.startsWith(sym));
  if (!pair) return;
  const ch = state.cryptoChange24h[sym];
  updateTickerItem(pair.id, price, pair.decimals, ch ?? null);
  updateTickerTimestamp();
}

async function refreshTicker() {
  try {
    const rates = state.fiatRates;

    TICKER_PAIRS.forEach(pair => {
      const price = computeForexPrice(pair, rates);
      if (price != null) updateTickerItem(pair.id, price, pair.decimals, null);
    });

    // العملات الرقمية من state كـ fallback إذا لم يتصل WS بعد
    const crypto = state.cryptoRates;
    if (crypto) {
      CRYPTO_TICKER_PAIRS.forEach(pair => {
        if (cryptoPrices[pair.id]) return; // WS يوفر بيانات أحدث
        const shortSym = pair.id.replace('USDT', '');
        if (crypto[shortSym]) {
          updateTickerItem(pair.id, crypto[shortSym], pair.decimals, state.cryptoChange24h[shortSym] ?? null);
        }
      });
    }

    const { getMetalsRates } = await import('./api.js');
    const metals = getMetalsRates();
    if (metals.XAU) updateTickerItem('GOLD',  metals.XAU, 2, null);
    if (metals.XAG) updateTickerItem('SILVER', metals.XAG, 3, null);
    if (metals.XPT) updateTickerItem('PLAT',   metals.XPT, 2, null);

    updateTickerTimestamp();
  } catch (e) {
    console.warn('[ticker] refresh skipped:', e?.message);
  }
}

function initTicker() {
  buildTickerDOM(); // بناء DOM ديناميكياً بدلاً من HTML الثابت
  setTimeout(refreshTicker, 2500);
  setInterval(refreshTicker, 15_000);
  // ابدأ WebSocket للعملات الرقمية فوراً
  startCryptoTickerWS();
}

document.addEventListener('DOMContentLoaded', initTicker);

// ── Toast System ──────────────────────────────────
let toastContainer = null;
function getToastContainer() {
  if (!toastContainer) toastContainer = document.getElementById('toastContainer');
  return toastContainer;
}

export function showToast(message, type = 'info', duration = 3000) {
  const container = getToastContainer();
  if (!container) return;
  const icons = { success: '✓', error: '✕', info: 'ℹ', warning: '⚠' };
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.setAttribute('role', 'alert');
  toast.innerHTML = `<span>${icons[type] || ''}</span><span>${message}</span>`;
  container.appendChild(toast);
  setTimeout(() => toast.remove(), duration + 300);
}

window.showToast = showToast;

window.addEventListener('offline', () => showToast('No internet — using cached data', 'warning', 5000));
window.addEventListener('online',  () => {
  showToast('Connection restored', 'success', 2500);
  startCryptoTickerWS(); // أعد الاتصال عند عودة الشبكة
});

// ── Dynamic Ticker HTML Builder ──────────────────
// بدلاً من تكرار العناصر يدوياً في HTML، ننشئها ديناميكياً
export function buildTickerDOM() {
  const track = document.getElementById('tickerTrack');
  if (!track) return;

  // امسح المحتوى الحالي (الثابت في HTML)
  track.innerHTML = '';

  const ALL_PAIRS = [
    ...TICKER_PAIRS.map(p => ({
      id: p.id, sym: p.sym, isCrypto: false,
      label: p.sym,
    })),
    ...CRYPTO_TICKER_PAIRS.map(p => {
      const icons = { BTCUSDT:'₿', ETHUSDT:'Ξ' };
      const icon  = icons[p.id] || '';
      return { id: p.id, sym: p.sym, isCrypto: true, label: (icon ? icon + ' ' : '') + p.sym };
    }),
    { id: 'GOLD',   sym: 'Gold',   isCrypto: false, label: '🥇 Gold' },
    { id: 'SILVER', sym: 'Silver', isCrypto: false, label: '🥈 Silver' },
  ];

  // نبني المجموعة مرتين لحركة مستمرة بدون انقطاع
  [1, 2].forEach(pass => {
    ALL_PAIRS.forEach(pair => {
      const item = document.createElement('div');
      item.className = 'ticker-item' + (pair.isCrypto ? ' crypto-tick' : '');

      const symEl    = document.createElement('span');
      symEl.className = 'ticker-symbol';
      symEl.textContent = pair.label;

      const priceEl   = document.createElement('span');
      priceEl.className = 'ticker-price';
      priceEl.dataset.ticker = pass === 1 ? pair.id : pair.id + '2';
      priceEl.textContent = '—';

      const changeEl  = document.createElement('span');
      changeEl.className = 'ticker-change flat';
      changeEl.textContent = '—';

      item.appendChild(symEl);
      item.appendChild(priceEl);
      item.appendChild(changeEl);
      track.appendChild(item);
    });
  });
}
