import axios from 'axios';
import { Request, Response } from 'express';

const TVL_API_BASE = 'https://api.llama.fi';
const TVL_TIMEOUT_MS = 8000;
const TVL_CACHE_TTL_MS = 60000;

interface TvlPoint {
  date: number;
  totalLiquidityUSD: number;
}

export interface TvlResult {
  protocol: string;
  protocol_slug: string;
  tvl_usd: number;
  tvl_7d_delta_pct: number | null;
  timestamp: string;
  source: 'defillama';
  source_url: string;
}

interface CacheEntry {
  result: TvlResult;
  cachedAt: number;
}

const tvlCache: Record<string, CacheEntry> = {};

const PROTOCOL_ALIASES: Record<string, string> = {
  aave: 'aave',
  'aave-v2': 'aave-v2',
  'aave-v3': 'aave-v3',
  uniswap: 'uniswap',
  uni: 'uniswap',
  lido: 'lido',
  curve: 'curve-dex',
  'curve-dex': 'curve-dex',
  maker: 'makerdao',
  makerdao: 'makerdao',
  compound: 'compound',
  morpho: 'morpho',
  pendle: 'pendle',
  aerodrome: 'aerodrome',
  justlend: 'justlend',
  venus: 'venus',
  raydium: 'raydium',
  jupiter: 'jupiter',
  pancakeswap: 'pancakeswap',
  'pancake-swap': 'pancakeswap',
};

const STOP_WORDS = new Set([
  'what', 'whats', 'is', 'the', 'current', 'latest', 'live', 'today', 'now',
  'total', 'value', 'locked', 'tvl', 'of', 'for', 'protocol', 'protocols',
  'please', 'show', 'give', 'me', 'tell', 'how', 'much', 'in', 'on', 'at',
]);

function normalizeToken(value: string): string {
  return value.toLowerCase().trim().replace(/[^a-z0-9-]/g, '');
}

export function extractProtocol(input: unknown): string {
  const raw = String(input ?? '').trim();
  if (!raw) return 'aave';

  const normalized = raw.toLowerCase()
    .replace(/[?.,!:$]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  const multiword: Array<[string, string]> = [
    ['aave v3', 'aave-v3'],
    ['aave v2', 'aave-v2'],
    ['curve finance', 'curve-dex'],
    ['maker dao', 'makerdao'],
    ['pancake swap', 'pancakeswap'],
  ];

  for (const [phrase, slug] of multiword) {
    if (normalized.includes(phrase)) return slug;
  }

  const direct = normalizeToken(normalized);
  if (PROTOCOL_ALIASES[direct]) return PROTOCOL_ALIASES[direct];

  const tokens = normalized.split(/\s+/).map(normalizeToken).filter(Boolean);
  for (const token of tokens) {
    if (PROTOCOL_ALIASES[token]) return PROTOCOL_ALIASES[token];
  }

  for (const token of tokens) {
    if (!STOP_WORDS.has(token) && /^[a-z0-9][a-z0-9-]{1,40}$/.test(token)) {
      return token;
    }
  }

  return 'aave';
}

function latestTvlPoint(points: TvlPoint[]): TvlPoint | null {
  const valid = points.filter(
    (point) => Number.isFinite(point.date) && Number.isFinite(point.totalLiquidityUSD) && point.totalLiquidityUSD >= 0,
  );
  if (valid.length === 0) return null;
  return valid.reduce((latest, point) => (point.date > latest.date ? point : latest));
}

function findSevenDayReference(points: TvlPoint[], latest: TvlPoint): TvlPoint | null {
  const target = latest.date - 7 * 24 * 60 * 60;
  let best: TvlPoint | null = null;
  let bestDistance = Number.POSITIVE_INFINITY;

  for (const point of points) {
    if (!Number.isFinite(point.date) || !Number.isFinite(point.totalLiquidityUSD) || point.totalLiquidityUSD <= 0) continue;
    const distance = Math.abs(point.date - target);
    if (distance < bestDistance) {
      best = point;
      bestDistance = distance;
    }
  }

  // Avoid describing a very distant historical point as a 7-day comparison.
  return best && bestDistance <= 2 * 24 * 60 * 60 ? best : null;
}

function calculateRisk(tvlUsd: number, delta7d: number | null): number {
  if (typeof delta7d === 'number') {
    if (delta7d < -25) return 90;
    if (delta7d < -10) return 60;
    if (delta7d < 0) return 35;
    return 15;
  }

  if (tvlUsd < 1_000_000) return 70;
  if (tvlUsd < 10_000_000) return 45;
  return 25;
}

export function calculateTvlRisk(tvlUsd: number, delta7d: number | null): number {
  return calculateRisk(tvlUsd, delta7d);
}

export async function fetchProtocolTvl(protocolInput: unknown): Promise<TvlResult | null> {
  const slug = extractProtocol(protocolInput);
  const now = Date.now();
  const cached = tvlCache[slug];

  if (cached && now - cached.cachedAt < TVL_CACHE_TTL_MS) {
    return cached.result;
  }

  try {
    const url = `${TVL_API_BASE}/protocol/${encodeURIComponent(slug)}`;
    const response = await axios.get(url, { timeout: TVL_TIMEOUT_MS });
    const data = response.data;
    const points: TvlPoint[] = Array.isArray(data?.tvl)
      ? data.tvl.map((point: any) => ({
          date: Number(point?.date),
          totalLiquidityUSD: Number(point?.totalLiquidityUSD),
        }))
      : [];

    const latest = latestTvlPoint(points);
    if (!latest) return null;

    const reference = findSevenDayReference(points, latest);
    const delta7d = reference && reference.totalLiquidityUSD > 0
      ? ((latest.totalLiquidityUSD - reference.totalLiquidityUSD) / reference.totalLiquidityUSD) * 100
      : null;

    const result: TvlResult = {
      protocol: String(data?.name || slug),
      protocol_slug: slug,
      tvl_usd: latest.totalLiquidityUSD,
      tvl_7d_delta_pct: Number.isFinite(delta7d) ? delta7d : null,
      timestamp: new Date(latest.date * 1000).toISOString(),
      source: 'defillama',
      source_url: url,
    };

    tvlCache[slug] = { result, cachedAt: now };
    return result;
  } catch {
    return null;
  }
}

export async function handleMinerTvlLookup(req: Request, res: Response) {
  const rawInput = req.query?.protocol
    || req.body?.protocol
    || req.query?.asset
    || req.body?.asset
    || req.body?.query
    || 'Aave';

  const protocolSlug = extractProtocol(rawInput);
  const liveData = await fetchProtocolTvl(protocolSlug);

  if (!liveData) {
    res.status(200).json({
      status: 'success',
      miner_id: 501,
      intent: 'TVL_LOOKUP',
      protocol: protocolSlug,
      answer: `TVL data temporarily unavailable for ${protocolSlug}.`,
      tvl_usd: null,
      tvl_7d_delta_pct: null,
      confidence_score: 50.0,
      timestamp: new Date().toISOString(),
      source: 'defillama',
    });
    return;
  }

  const riskSignal = calculateTvlRisk(liveData.tvl_usd, liveData.tvl_7d_delta_pct);
  const deltaText = typeof liveData.tvl_7d_delta_pct === 'number'
    ? `, ${liveData.tvl_7d_delta_pct >= 0 ? '+' : ''}${liveData.tvl_7d_delta_pct.toFixed(2)}% over 7d`
    : '';

  res.status(200).json({
    status: 'success',
    miner_id: 501,
    intent: 'TVL_LOOKUP',
    protocol: liveData.protocol,
    protocol_slug: liveData.protocol_slug,
    answer: `${liveData.protocol} TVL is currently $${liveData.tvl_usd.toLocaleString('en-US', { maximumFractionDigits: 0 })} USD${deltaText}.`,
    tvl_usd: liveData.tvl_usd,
    tvl_7d_delta_pct: liveData.tvl_7d_delta_pct,
    risk_signal: riskSignal,
    confidence_score: 95.0,
    timestamp: liveData.timestamp,
    source: liveData.source,
    source_url: liveData.source_url,
  });
}
