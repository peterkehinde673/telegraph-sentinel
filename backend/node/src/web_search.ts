import axios from 'axios';
import { Request, Response } from 'express';

const TAVILY_API_URL = 'https://api.tavily.com/search';
const SEARCH_TIMEOUT_MS = 8000;
const SEARCH_CACHE_TTL_MS = 30000;

export interface WebSearchResult {
  query: string;
  answer: string;
  results: Array<{
    title: string;
    url: string;
    content: string;
    score: number;
  }>;
  timestamp: string;
  source: 'tavily';
}

interface CacheEntry {
  result: WebSearchResult;
  cachedAt: number;
}

const searchCache: Record<string, CacheEntry> = {};

function getApiKey(): string | null {
  const key = process.env.TAVILY_API_KEY?.trim();
  return key || null;
}

function normalizeQuery(input: unknown): string {
  return String(input ?? '').replace(/\s+/g, ' ').trim().slice(0, 1000);
}

export async function searchWeb(queryInput: unknown): Promise<WebSearchResult | null> {
  const query = normalizeQuery(queryInput);
  if (!query) return null;

  const apiKey = getApiKey();
  if (!apiKey) return null;

  const cacheKey = query.toLowerCase();
  const now = Date.now();
  const cached = searchCache[cacheKey];
  if (cached && now - cached.cachedAt < SEARCH_CACHE_TTL_MS) return cached.result;

  try {
    const response = await axios.post(
      TAVILY_API_URL,
      {
        query,
        search_depth: 'basic',
        include_answer: true,
        include_raw_content: false,
        max_results: 5,
      },
      {
        timeout: SEARCH_TIMEOUT_MS,
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
      },
    );

    const data = response.data || {};
    const results = Array.isArray(data.results)
      ? data.results.filter((item: any) => item?.title && item?.url).slice(0, 5).map((item: any) => ({
          title: String(item.title),
          url: String(item.url),
          content: String(item.content || '').slice(0, 1200),
          score: Number.isFinite(Number(item.score)) ? Number(item.score) : 0,
        }))
      : [];

    const result: WebSearchResult = {
      query,
      answer: String(data.answer || results[0]?.content || 'No web answer returned.'),
      results,
      timestamp: new Date().toISOString(),
      source: 'tavily',
    };

    searchCache[cacheKey] = { result, cachedAt: now };
    return result;
  } catch {
    return null;
  }
}

export function calculateWebRisk(result: WebSearchResult): number {
  const text = `${result.answer} ${result.results.map((item) => `${item.title} ${item.content}`).join(' ')}`.toLowerCase();
  const incidentTerms = ['exploit', 'hacked', 'hack', 'drained', 'drain', 'rug pull', 'rug-pull', 'vulnerability', 'attack', 'compromised', 'breach', 'scam', 'phishing'];
  const hits = incidentTerms.reduce((count, term) => count + (text.includes(term) ? 1 : 0), 0);
  if (hits >= 4) return 85;
  if (hits >= 2) return 60;
  if (hits === 1) return 35;
  return 10;
}

export async function handleMinerWebSearch(req: Request, res: Response) {
  const rawQuery = req.query?.query || req.body?.query || req.query?.q || req.body?.q || req.body?.asset;
  const query = normalizeQuery(rawQuery);

  if (!query) {
    res.status(400).json({ status: 'error', miner_id: 501, intent: 'WEB_SEARCH', error: 'A search query is required.' });
    return;
  }

  if (!getApiKey()) {
    res.status(503).json({ status: 'unavailable', miner_id: 501, intent: 'WEB_SEARCH', query, answer: 'Web search provider is not configured.', confidence_score: 0, source: 'tavily' });
    return;
  }

  const liveData = await searchWeb(query);
  if (!liveData) {
    res.status(200).json({ status: 'unavailable', miner_id: 501, intent: 'WEB_SEARCH', query, answer: 'Web search data temporarily unavailable from the provider.', confidence_score: 0.5, source: 'tavily' });
    return;
  }

  res.status(200).json({
    status: 'success',
    miner_id: 501,
    intent: 'WEB_SEARCH',
    query: liveData.query,
    answer: liveData.answer,
    results: liveData.results,
    risk_signal: calculateWebRisk(liveData),
    timestamp: liveData.timestamp,
    source: liveData.source,
    confidence_score: liveData.results.length > 0 ? 0.92 : 0.75,
  });
}
