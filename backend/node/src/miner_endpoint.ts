import axios from 'axios';
import { Request, Response } from 'express';

interface PriceCache {
  price: number;
  change24h: number;
  timestamp: number;
}

const priceCache: Record<string, PriceCache> = {};
const CACHE_TTL_MS = 60000; // 60s cache
const UPSTREAM_TIMEOUT_MS = 5000;

const ASSET_ALIASES: Record<string, string> = {
  btc: 'BTC', bitcoin: 'BTC', xbt: 'BTC',
  eth: 'ETH', ethereum: 'ETH', ether: 'ETH', weth: 'ETH',
  sol: 'SOL', solana: 'SOL',
  ada: 'ADA', cardano: 'ADA',
  avax: 'AVAX', avalanche: 'AVAX',
  link: 'LINK', chainlink: 'LINK',
  doge: 'DOGE', dogecoin: 'DOGE',
  xrp: 'XRP', ripple: 'XRP',
  bnb: 'BNB', binancecoin: 'BNB',
  dot: 'DOT', polkadot: 'DOT',
  matic: 'MATIC', polygon: 'MATIC', pol: 'MATIC',
  arb: 'ARB', arbitrum: 'ARB',
  op: 'OP', optimism: 'OP',
  uni: 'UNI', uniswap: 'UNI',
  aave: 'AAVE',
  mkr: 'MKR', maker: 'MKR', makerdao: 'MKR',
  atom: 'ATOM', cosmos: 'ATOM',
  near: 'NEAR', 'near-protocol': 'NEAR',
  sui: 'SUI',
  pepe: 'PEPE',
  shib: 'SHIB', shiba: 'SHIB', 'shiba-inu': 'SHIB',
  ltc: 'LTC', litecoin: 'LTC',
  xmr: 'XMR', monero: 'XMR',
  trx: 'TRX', tron: 'TRX',
  ton: 'TON', toncoin: 'TON',
  xlm: 'XLM', stellar: 'XLM',
  algo: 'ALGO', algorand: 'ALGO',
  vet: 'VET', vechain: 'VET',
  fil: 'FIL', filecoin: 'FIL',
  icp: 'ICP', internetcomputer: 'ICP', 'internet-computer': 'ICP',
  apt: 'APT', aptos: 'APT',
  inj: 'INJ', injective: 'INJ',
  tia: 'TIA', celestia: 'TIA',
  kas: 'KAS', kaspa: 'KAS',
  hbar: 'HBAR', hedera: 'HBAR',
  ftm: 'FTM', fantom: 'FTM', sonic: 'FTM',
  rune: 'RUNE', thorchain: 'RUNE',
  sei: 'SEI',
  strk: 'STRK', starknet: 'STRK',
  wld: 'WLD', worldcoin: 'WLD',
  ena: 'ENA', ethena: 'ENA',
  ondo: 'ONDO', pendle: 'PENDLE',
  bonk: 'BONK', floki: 'FLOKI',
  jup: 'JUP', jupiter: 'JUP',
  pyth: 'PYTH',
  comp: 'COMP', compound: 'COMP',
  sushi: 'SUSHI', sushiswap: 'SUSHI',
  usdt: 'USDT', tether: 'USDT',
  usdc: 'USDC', 'usd-coin': 'USDC',
};

const STOP_WORDS = new Set([
  'what', 'whats', 'is', 'the', 'a', 'an', 'current', 'live', 'latest', 'today', 'now',
  'price', 'prices', 'spot', 'trading', 'trade', 'value', 'of', 'for', 'in', 'at', 'on',
  'usd', 'dollar', 'dollars', 'usdt', 'coin', 'token', 'crypto', 'cryptocurrency',
  'please', 'give', 'me', 'tell', 'show', 'can', 'you', 'how', 'much', 'right', 'going',
  'market', 'marketplace', '24h', 'change', 'quote', 'quotation', 'worth', 'cost',
]);

function normalizeToken(token: string): string {
  return token.toLowerCase().replace(/[^a-z0-9-]/g, '');
}

export function extractAsset(input: unknown): string {
  const raw = String(input ?? '').trim();
  if (!raw) return 'ETH';

  const normalized = raw.toLowerCase().replace(/[?.,!:$]/g, ' ').replace(/\s+/g, ' ').trim();

  const multiword = [
    ['bitcoin cash', 'BCH'],
    ['ethereum classic', 'ETC'],
    ['internet computer', 'ICP'],
    ['shiba inu', 'SHIB'],
    ['near protocol', 'NEAR'],
    ['doge coin', 'DOGE'],
  ] as const;
  for (const [phrase, ticker] of multiword) {
    if (normalized.includes(phrase)) return ticker;
  }

  const direct = normalizeToken(normalized);
  if (ASSET_ALIASES[direct]) return ASSET_ALIASES[direct];

  const tokens = normalized.split(/\s+/).map(normalizeToken).filter(Boolean);
  for (const token of tokens) {
    if (ASSET_ALIASES[token]) return ASSET_ALIASES[token];
  }

  for (const token of normalized.split(/\s+/)) {
    const parts = token.split('/').map(normalizeToken);
    for (const part of parts) {
      if (ASSET_ALIASES[part] && !['USD', 'USDT', 'USDC'].includes(ASSET_ALIASES[part])) {
        return ASSET_ALIASES[part];
      }
    }
  }

  for (const token of tokens) {
    if (!STOP_WORDS.has(token) && /^[a-z0-9]{2,10}$/.test(token)) {
      return token.toUpperCase();
    }
  }

  return 'ETH';
}

interface LivePriceResult {
  price: number;
  change24h: number;
  source: 'binance' | 'coinbase' | 'kraken' | 'coingecko';
}

const COINBASE_SYMBOLS: Record<string, string> = {
  BTC: 'BTC-USD', ETH: 'ETH-USD', SOL: 'SOL-USD', ADA: 'ADA-USD', AVAX: 'AVAX-USD',
  LINK: 'LINK-USD', DOGE: 'DOGE-USD', XRP: 'XRP-USD', BNB: 'BNB-USD', DOT: 'DOT-USD',
  MATIC: 'MATIC-USD', ARB: 'ARB-USD', OP: 'OP-USD', UNI: 'UNI-USD', AAVE: 'AAVE-USD',
  MKR: 'MKR-USD', ATOM: 'ATOM-USD', NEAR: 'NEAR-USD', SUI: 'SUI-USD', PEPE: 'PEPE-USD',
  SHIB: 'SHIB-USD', LTC: 'LTC-USD', XLM: 'XLM-USD', ALGO: 'ALGO-USD', FIL: 'FIL-USD',
  ICP: 'ICP-USD', APT: 'APT-USD', INJ: 'INJ-USD', KAS: 'KAS-USD', HBAR: 'HBAR-USD',
  SEI: 'SEI-USD', WLD: 'WLD-USD', ENA: 'ENA-USD', ONDO: 'ONDO-USD', BONK: 'BONK-USD',
  FLOKI: 'FLOKI-USD', JUP: 'JUP-USD', PYTH: 'PYTH-USD', COMP: 'COMP-USD', SUSHI: 'SUSHI-USD',
  USDT: 'USDT-USD', USDC: 'USDC-USD',
};

const COINGECKO_IDS: Record<string, string> = {
  BTC: 'bitcoin', ETH: 'ethereum', SOL: 'solana', AAVE: 'aave', UNI: 'uniswap',
  ARB: 'arbitrum', OP: 'optimism', LINK: 'chainlink', MATIC: 'matic-network',
  MKR: 'maker', DOGE: 'dogecoin', XRP: 'ripple', AVAX: 'avalanche-2',
  BNB: 'binancecoin', USDT: 'tether', USDC: 'usd-coin',
};

async function fetchFromCoinbase(sym: string): Promise<LivePriceResult | null> {
  const product = COINBASE_SYMBOLS[sym];
  if (!product) return null;
  try {
    const [spotRes, statsRes] = await Promise.all([
      axios.get(`https://api.coinbase.com/v2/prices/${product}/spot`, { timeout: UPSTREAM_TIMEOUT_MS }),
      axios.get(`https://api.exchange.coinbase.com/products/${product}/stats`, { timeout: UPSTREAM_TIMEOUT_MS }),
    ]);
    const price = Number(spotRes.data?.data?.amount);
    const stats = statsRes.data;
    const last = Number(stats?.last);
    const open = Number(stats?.open);
    const referencePrice = Number.isFinite(last) && last > 0 ? last : price;
    const change24h = Number.isFinite(referencePrice) && Number.isFinite(open) && open > 0
      ? ((referencePrice - open) / open) * 100
      : 0;
    if (!Number.isFinite(price) || price <= 0) return null;
    return { price, change24h, source: 'coinbase' };
  } catch {
    return null;
  }
}

async function fetchFromKraken(sym: string): Promise<LivePriceResult | null> {
  const pairMap: Record<string, string> = {
    BTC: 'XBTUSD', ETH: 'ETHUSD', SOL: 'SOLUSD', ADA: 'ADAUSD', AVAX: 'AVAXUSD',
    LINK: 'LINKUSD', DOGE: 'DOGEUSD', XRP: 'XRPUSD', DOT: 'DOTUSD', LTC: 'LTCUSD',
    XLM: 'XLMUSD', ATOM: 'ATOMUSD', UNI: 'UNIUSD', AAVE: 'AAVEUSD', USDT: 'USDTUSD',
    USDC: 'USDCUSD',
  };
  const pair = pairMap[sym];
  if (!pair) return null;
  try {
    const res = await axios.get(`https://api.kraken.com/0/public/Ticker?pair=${pair}`, { timeout: UPSTREAM_TIMEOUT_MS });
    const result = res.data?.result;
    if (!result) return null;
    const key = Object.keys(result)[0];
    const price = Number(result[key]?.c?.[0]);
    const open = Number(result[key]?.o);
    const change24h = Number.isFinite(price) && Number.isFinite(open) && open > 0 ? ((price - open) / open) * 100 : 0;
    if (!Number.isFinite(price) || price <= 0) return null;
    return { price, change24h, source: 'kraken' };
  } catch {
    return null;
  }
}

export async function fetchLiveCryptoPrice(symbol: string): Promise<LivePriceResult | null> {
  const sym = symbol.toUpperCase().trim();
  const now = Date.now();

  if (priceCache[sym] && now - priceCache[sym].timestamp < CACHE_TTL_MS) {
    return { price: priceCache[sym].price, change24h: priceCache[sym].change24h, source: 'binance' };
  }

  try {
    const binanceSymbol = sym === 'USD' || sym === 'USDT' ? 'USDCUSDT' : `${sym}USDT`;
    const res = await axios.get(`https://api.binance.com/api/v3/ticker/24hr?symbol=${binanceSymbol}`, { timeout: UPSTREAM_TIMEOUT_MS });
    if (res.data && res.data.lastPrice) {
      const price = Number(res.data.lastPrice);
      const change24h = Number(res.data.priceChangePercent);
      if (Number.isFinite(price) && price > 0) {
        priceCache[sym] = { price, change24h, timestamp: now };
        return { price, change24h, source: 'binance' };
      }
    }
  } catch {
    // Continue to independent fallbacks.
  }

  const coinbase = await fetchFromCoinbase(sym);
  if (coinbase) {
    priceCache[sym] = { price: coinbase.price, change24h: coinbase.change24h, timestamp: now };
    return coinbase;
  }

  const kraken = await fetchFromKraken(sym);
  if (kraken) {
    priceCache[sym] = { price: kraken.price, change24h: kraken.change24h, timestamp: now };
    return kraken;
  }

  try {
    const geckoId = COINGECKO_IDS[sym] || sym.toLowerCase();
    const gRes = await axios.get(`https://api.coingecko.com/api/v3/simple/price?ids=${geckoId}&vs_currencies=usd&include_24hr_change=true`, { timeout: UPSTREAM_TIMEOUT_MS });
    if (gRes.data && gRes.data[geckoId]) {
      const price = Number(gRes.data[geckoId].usd);
      const change24h = Number(gRes.data[geckoId].usd_24h_change || 0);
      if (Number.isFinite(price) && price > 0) {
        priceCache[sym] = { price, change24h, timestamp: now };
        return { price, change24h, source: 'coingecko' };
      }
    }
  } catch {
    // All upstreams failed.
  }

  return null;
}

function logCryptoEvaluationRequest(
  req: Request,
  asset: string,
  liveData: LivePriceResult | null,
): void {
  const question = req.body?.question || req.body?.query || req.query?.question || req.query?.query || null;
  const rawInput = req.query?.asset || req.body?.asset || req.query?.symbol || req.body?.symbol || req.body?.query || 'ETH';

  console.log('[CRYPTO_PRICE_DIAGNOSTIC]', JSON.stringify({
    timestamp: new Date().toISOString(),
    path: req.path,
    method: req.method,
    query_keys: Object.keys(req.query || {}),
    body_keys: Object.keys(req.body || {}),
    question: typeof question === 'string' ? question.slice(0, 500) : question,
    raw_input: String(rawInput).slice(0, 200),
    asset,
    provider: liveData?.source ?? null,
    price_usd: liveData?.price ?? null,
  }));
}

export async function handleMinerRiskAssessment(req: Request, res: Response) {
  const input = req.body?.input;
  const inputAsset = typeof input === 'string'
    ? input
    : input && typeof input === 'object'
      ? (input.asset || input.symbol || input.query || input.question)
      : undefined;
  const rawInput = req.query?.asset || req.body?.asset || req.query?.symbol || req.body?.symbol
    || req.body?.query || req.body?.question || inputAsset || req.query?.question || req.query?.query || 'ETH';
  const asset = extractAsset(rawInput);
  const liveData = await fetchLiveCryptoPrice(asset);
  logCryptoEvaluationRequest(req, asset, liveData);

  if (!liveData) {
    res.status(200).json({
      status: 'success',
      miner_id: 501,
      intent: 'CRYPTO_PRICE',
      asset,
      answer: `${asset} price data temporarily unavailable from upstream sources.`,
      price_usd: null,
      confidence_score: 0.5,
      timestamp: new Date().toISOString(),
    });
    return;
  }

  res.status(200).json({
    status: 'success',
    miner_id: 501,
    intent: 'CRYPTO_PRICE',
    asset,
    answer: `${asset} is currently trading at $${liveData.price.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 8 })} USD.`,
    price_usd: liveData.price,
    change_24h_pct: liveData.change24h,
    confidence_score: 0.98,
    timestamp: new Date().toISOString(),
  });
}
