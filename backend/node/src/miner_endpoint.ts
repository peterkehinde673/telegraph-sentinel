import { Request, Response } from 'express';
import axios from 'axios';

interface PriceCache {
  price: number;
  change24h: number;
  timestamp: number;
}

const priceCache: Record<string, PriceCache> = {};
const CACHE_TTL_MS = 60000; // 60s cache

export async function fetchLiveCryptoPrice(symbol: string): Promise<{ price: number; change24h: number } | null> {
  const sym = symbol.toUpperCase().trim();
  const now = Date.now();

  if (priceCache[sym] && now - priceCache[sym].timestamp < CACHE_TTL_MS) {
    return { price: priceCache[sym].price, change24h: priceCache[sym].change24h };
  }

  try {
    // 1. Query Binance public ticker endpoint
    const binanceSymbol = sym === 'USD' || sym === 'USDT' ? 'USDCUSDT' : `${sym}USDT`;
    const res = await axios.get(`https://api.binance.com/api/v3/ticker/24hr?symbol=${binanceSymbol}`, { timeout: 3000 });
    if (res.data && res.data.lastPrice) {
      const price = parseFloat(res.data.lastPrice);
      const change24h = parseFloat(res.data.priceChangePercent);
      priceCache[sym] = { price, change24h, timestamp: now };
      return { price, change24h };
    }
  } catch {
    // 2. Fallback to CoinGecko public simple price API
    try {
      const idMap: Record<string, string> = {
        BTC: 'bitcoin',
        ETH: 'ethereum',
        SOL: 'solana',
        AAVE: 'aave',
        UNI: 'uniswap',
        ARB: 'arbitrum',
        OP: 'optimism',
        LINK: 'chainlink',
        MATIC: 'matic-network',
        MKR: 'maker',
        DOGE: 'dogecoin',
        XRP: 'ripple',
        AVAX: 'avalanche-2',
        BNB: 'binancecoin',
        USDT: 'tether',
        USDC: 'usd-coin',
      };

      const geckoId = idMap[sym] || sym.toLowerCase();
      const gRes = await axios.get(`https://api.coingecko.com/api/v3/simple/price?ids=${geckoId}&vs_currencies=usd&include_24hr_change=true`, { timeout: 3000 });
      if (gRes.data && gRes.data[geckoId]) {
        const price = gRes.data[geckoId].usd;
        const change24h = gRes.data[geckoId].usd_24h_change || 0.0;
        priceCache[sym] = { price, change24h, timestamp: now };
        return { price, change24h };
      }
    } catch {
      // Return null on upstream failure
    }
  }

  return null;
}

export async function handleMinerRiskAssessment(req: Request, res: Response) {
  // Support both GET query parameters and POST JSON payloads
  let asset = (req.query?.asset || req.body?.asset || req.query?.symbol || req.body?.symbol || req.body?.query || 'ETH').toString().trim();
  
  // Extract token symbol from natural language query if needed
  if (asset.toLowerCase().includes('price of')) {
    const parts = asset.split(/price of/i);
    if (parts[1]) asset = parts[1].replace(/[^a-zA-Z0-9]/g, '').trim();
  }

  asset = asset.toUpperCase().replace(/[^A-Z0-9]/g, '');
  if (!asset) asset = 'ETH';

  const liveData = await fetchLiveCryptoPrice(asset);

  if (!liveData) {
    res.status(200).json({
      status: 'success',
      miner_id: 501,
      intent: 'CRYPTO_PRICE',
      asset,
      answer: `${asset} price data temporarily unavailable from upstream sources.`,
      price_usd: null,
      confidence_score: 50.0,
      timestamp: new Date().toISOString(),
    });
    return;
  }

  res.status(200).json({
    status: 'success',
    miner_id: 501,
    intent: 'CRYPTO_PRICE',
    asset,
    answer: `${asset} is trading at $${liveData.price.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 4 })} USD (${liveData.change24h >= 0 ? '+' : ''}${liveData.change24h.toFixed(2)}% 24h).`,
    price_usd: liveData.price,
    change_24h_pct: liveData.change24h,
    confidence_score: 98.0,
    timestamp: new Date().toISOString(),
  });
}
