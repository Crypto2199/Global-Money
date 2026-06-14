// ═══════════════════════════════════════════════
//  Global Money — js/storage.js
// ═══════════════════════════════════════════════

export const CACHE_DURATION = 30 * 60 * 1000; // 30 minutes — persist across page navigation

export const countryMap = {
  USD:"us",EUR:"eu",GBP:"gb",JPY:"jp",CHF:"ch",CAD:"ca",AUD:"au",NZD:"nz",
  SEK:"se",NOK:"no",DKK:"dk",PLN:"pl",CZK:"cz",HUF:"hu",RON:"ro",BGN:"bg",
  HRK:"hr",RSD:"rs",UAH:"ua",RUB:"ru",TRY:"tr",EGP:"eg",SAR:"sa",AED:"ae",
  QAR:"qa",KWD:"kw",BHD:"bh",OMR:"om",JOD:"jo",ILS:"il",MAD:"ma",TND:"tn",
  DZD:"dz",LYD:"ly",MRO:"mr",SDG:"sd",ETB:"et",KES:"ke",UGX:"ug",TZS:"tz",
  GHS:"gh",NGN:"ng",ZAR:"za",MZN:"mz",BWP:"bw",ZMW:"zm",ZWL:"zw",MGA:"mg",
  INR:"in",PKR:"pk",BDT:"bd",LKR:"lk",NPR:"np",MMK:"mm",THB:"th",VND:"vn",
  IDR:"id",MYR:"my",SGD:"sg",PHP:"ph",KRW:"kr",TWD:"tw",HKD:"hk",CNY:"cn",
  MNT:"mn",KZT:"kz",UZS:"uz",AZN:"az",GEL:"ge",AMD:"am",IRR:"ir",IQD:"iq",
  SYP:"sy",LBP:"lb",YER:"ye",AFN:"af",PKR:"pk",BRL:"br",MXN:"mx",ARS:"ar",
  CLP:"cl",COP:"co",PEN:"pe",UYU:"uy",PYG:"py",BOB:"bo",VES:"ve",GTQ:"gt",
  HNL:"hn",NIO:"ni",CRC:"cr",PAB:"pa",DOP:"do",CUP:"cu",JMD:"jm",TTD:"tt",
  BBD:"bb",BSD:"bs",HTG:"ht",BZD:"bz",GYD:"gy",SRD:"sr",FJD:"fj",PGK:"pg",
  WST:"ws",SBD:"sb",VUV:"vu",KPW:"kp",
};

export const currencyNames = {
  USD:"US Dollar",EUR:"Euro",GBP:"British Pound",JPY:"Japanese Yen",
  CHF:"Swiss Franc",CAD:"Canadian Dollar",AUD:"Australian Dollar",
  NZD:"New Zealand Dollar",SEK:"Swedish Krona",NOK:"Norwegian Krone",
  DKK:"Danish Krone",PLN:"Polish Zloty",CZK:"Czech Koruna",HUF:"Hungarian Forint",
  RON:"Romanian Leu",TRY:"Turkish Lira",EGP:"Egyptian Pound",SAR:"Saudi Riyal",
  AED:"UAE Dirham",QAR:"Qatari Riyal",KWD:"Kuwaiti Dinar",BHD:"Bahraini Dinar",
  OMR:"Omani Rial",JOD:"Jordanian Dinar",ILS:"Israeli Shekel",MAD:"Moroccan Dirham",
  TND:"Tunisian Dinar",DZD:"Algerian Dinar",NGN:"Nigerian Naira",ZAR:"South African Rand",
  INR:"Indian Rupee",PKR:"Pakistani Rupee",BDT:"Bangladeshi Taka",CNY:"Chinese Yuan",
  HKD:"Hong Kong Dollar",SGD:"Singapore Dollar",MYR:"Malaysian Ringgit",
  THB:"Thai Baht",IDR:"Indonesian Rupiah",PHP:"Philippine Peso",KRW:"South Korean Won",
  TWD:"Taiwan Dollar",BRL:"Brazilian Real",MXN:"Mexican Peso",ARS:"Argentine Peso",
  CLP:"Chilean Peso",COP:"Colombian Peso",PEN:"Peruvian Sol",
};

export const CRYPTOS = {
  BTC:  { name:"Bitcoin",        id:"bitcoin",        icon:"₿", logo:"https://assets.coingecko.com/coins/images/1/small/bitcoin.png" },
  ETH:  { name:"Ethereum",       id:"ethereum",       icon:"Ξ", logo:"https://assets.coingecko.com/coins/images/279/small/ethereum.png" },
  BNB:  { name:"BNB",            id:"binancecoin",    icon:"◆", logo:"https://assets.coingecko.com/coins/images/825/small/bnb-icon2_2x.png" },
  SOL:  { name:"Solana",         id:"solana",         icon:"◎", logo:"https://assets.coingecko.com/coins/images/4128/small/solana.png" },
  XRP:  { name:"XRP",            id:"ripple",         icon:"✕", logo:"https://assets.coingecko.com/coins/images/44/small/xrp-symbol-white-128.png" },
  ADA:  { name:"Cardano",        id:"cardano",        icon:"₳", logo:"https://assets.coingecko.com/coins/images/975/small/cardano.png" },
  DOGE: { name:"Dogecoin",       id:"dogecoin",       icon:"Ð", logo:"https://assets.coingecko.com/coins/images/5/small/dogecoin.png" },
  USDT: { name:"Tether",         id:"tether",         icon:"₮", logo:"https://assets.coingecko.com/coins/images/325/small/Tether.png" },
  MATIC:{ name:"Polygon (MATIC)",id:"matic-network",  icon:"⬡", logo:"https://assets.coingecko.com/coins/images/4713/small/polygon.png" },
  DOT:  { name:"Polkadot",       id:"polkadot",       icon:"●", logo:"https://assets.coingecko.com/coins/images/12171/small/polkadot.png" },
  AVAX: { name:"Avalanche",      id:"avalanche-2",    icon:"🔺",logo:"https://assets.coingecko.com/coins/images/12559/small/Avalanche_Circle_RedWhite_Trans.png" },
  LINK: { name:"Chainlink",      id:"chainlink",      icon:"🔗",logo:"https://assets.coingecko.com/coins/images/877/small/chainlink-new-logo.png" },
  UNI:  { name:"Uniswap",        id:"uniswap",        icon:"🦄",logo:"https://assets.coingecko.com/coins/images/12504/small/uniswap-uni.png" },
  LTC:  { name:"Litecoin",       id:"litecoin",       icon:"Ł", logo:"https://assets.coingecko.com/coins/images/2/small/litecoin.png" },
  ATOM: { name:"Cosmos",         id:"cosmos",         icon:"⚛", logo:"https://assets.coingecko.com/coins/images/1481/small/cosmos_hub.png" },
  TRX:  { name:"TRON",           id:"tron",           icon:"⟁", logo:"https://assets.coingecko.com/coins/images/1094/small/tron-logo.png" },
  SHIB: { name:"Shiba Inu",      id:"shiba-inu",      icon:"🐕",logo:"https://assets.coingecko.com/coins/images/11939/small/shiba.png" },
  NEAR: { name:"NEAR Protocol",  id:"near",           icon:"Ⓝ", logo:"https://assets.coingecko.com/coins/images/10365/small/near.jpg" },
};

export const BLACK_MARKET_RATES = {
  USD: { official: null, parallel: 245.0, source: "manual" },
  EUR: { official: null, parallel: 269.5, source: "manual" },
  GBP: { official: null, parallel: 310.0, source: "manual" },
  SAR: { official: null, parallel: 65.2,  source: "manual" },
  AED: { official: null, parallel: 66.7,  source: "manual" },
  CAD: { official: null, parallel: 179.5, source: "manual" },
};
export const BM_LAST_UPDATE = "13/06/2026";

export const DEFAULT_FAVS = ["EUR","GBP","SAR","AED","DZD","MAD","CAD","JPY"];

export function safeGetJSON(key, fallback = null) {
  try {
    const raw = localStorage.getItem(key);
    if (raw === null) return fallback;
    return JSON.parse(raw);
  } catch { return fallback; }
}

export function safeSetJSON(key, value) {
  try { localStorage.setItem(key, JSON.stringify(value)); return true; }
  catch { return false; }
}

export function getFavs() {
  return safeGetJSON("favCurrencies", DEFAULT_FAVS);
}

export function getAlerts() {
  return safeGetJSON("priceAlerts", []);
}

export function saveAlerts(alerts) {
  safeSetJSON("priceAlerts", alerts);
}

export function getHistory() {
  return safeGetJSON("convHistory", []);
}
export function saveHistory(history) {
  safeSetJSON("convHistory", history);
}

export function initStorageHealth() {
  const keys = ["cachedRates","cachedMetals","priceAlerts","favCurrencies","convHistory","lang","theme"];
  keys.forEach(k => {
    try {
      const v = localStorage.getItem(k);
      if (v !== null) JSON.parse(v);
    } catch {
      localStorage.removeItem(k);
    }
  });
}
