import { NormalizedSignal } from '../types';
import { TelegraphClient } from './client';

export class CoinGeckoAdapter {
  constructor(private client: TelegraphClient) {}

  async fetchSignal(asset: string): Promise<NormalizedSignal> {
    const formattedAsset = asset.toLowerCase();
    const res = await this.client.queryMiner({
      minerId: 207,
      intent: 'CRYPTO_PRICE',
      endpoint: '/api/v3/simple/price',
      params: { ids: formattedAsset, vs_currencies: 'usd', include_24hr_change: 'true', include_24hr_vol: 'true' },
    });

    if (!res.success || !res.data) {
      return {
        miner_id: 207,
        miner_name: 'CoinGecko',
        intent: 'CRYPTO_PRICE',
        status: res.status === 'UNCONFIGURED' ? 'unavailable' : 'failed',
        timestamp: new Date().toISOString(),
        risk_signal: 0.0,
        confidence: 0.0,
        data: { error: res.error || 'No price data received' },
        verification: res.verification,
        payment: res.payment,
      };
    }

    // Extract actual returned price metrics
    const assetData = res.data[formattedAsset] || res.data;
    const priceUsd = typeof assetData === 'number' ? assetData : assetData?.usd;
    const change24h = assetData?.usd_24h_change;

    if (priceUsd === undefined) {
      return {
        miner_id: 207,
        miner_name: 'CoinGecko',
        intent: 'CRYPTO_PRICE',
        status: 'failed',
        timestamp: new Date().toISOString(),
        risk_signal: 0.0,
        confidence: 0.0,
        data: { error: `Asset '${asset}' not found in CoinGecko response` },
        verification: res.verification,
        payment: res.payment,
      };
    }

    // Deterministic Market Risk Calculation:
    // Large negative 24h drop increases market risk; stability or moderate gains decrease risk.
    let marketRisk = 20.0;
    if (typeof change24h === 'number') {
      if (change24h < -15.0) marketRisk = 85.0;
      else if (change24h < -7.0) marketRisk = 65.0;
      else if (change24h < -2.0) marketRisk = 40.0;
      else if (change24h <= 5.0) marketRisk = 18.0;
      else marketRisk = 25.0; // Rapid spike carries minor volatility risk
    }

    return {
      miner_id: 207,
      miner_name: 'CoinGecko',
      intent: 'CRYPTO_PRICE',
      status: 'success',
      timestamp: new Date().toISOString(),
      risk_signal: marketRisk,
      confidence: typeof change24h === 'number' ? 95.0 : 75.0,
      data: {
        price_usd: priceUsd,
        change_24h_pct: change24h ?? null,
      },
      verification: res.verification,
      payment: res.payment,
    };
  }
}

export class TVLOracleAdapter {
  constructor(private client: TelegraphClient) {}

  async fetchSignal(asset: string): Promise<NormalizedSignal> {
    const formattedAsset = asset.toLowerCase();
    const res = await this.client.queryMiner({
      minerId: 301,
      intent: 'TVL_LOOKUP',
      endpoint: `/tvlwire-oracle/tvl/${formattedAsset}`,
    });

    if (!res.success || !res.data) {
      return {
        miner_id: 301,
        miner_name: 'TVL Oracle',
        intent: 'TVL_LOOKUP',
        status: res.status === 'UNCONFIGURED' ? 'unavailable' : 'failed',
        timestamp: new Date().toISOString(),
        risk_signal: 0.0,
        confidence: 0.0,
        data: { error: res.error || 'No TVL metrics returned' },
        verification: res.verification,
        payment: res.payment,
      };
    }

    const tvlUsd = res.data.tvl ?? res.data.total_value_locked_usd;
    const tvlDelta7d = res.data.change_7d_pct ?? res.data.tvl_delta_7d;

    if (tvlUsd === undefined) {
      return {
        miner_id: 301,
        miner_name: 'TVL Oracle',
        intent: 'TVL_LOOKUP',
        status: 'failed',
        timestamp: new Date().toISOString(),
        risk_signal: 0.0,
        confidence: 0.0,
        data: { error: `TVL data unavailable for '${asset}'` },
        verification: res.verification,
        payment: res.payment,
      };
    }

    // Deterministic DeFi TVL Risk Calculation:
    // TVL drawdown > 20% indicates significant protocol drain; deep liquidity reflects lower risk.
    let tvlRisk = 25.0;
    if (typeof tvlDelta7d === 'number') {
      if (tvlDelta7d < -25.0) tvlRisk = 90.0;
      else if (tvlDelta7d < -10.0) tvlRisk = 60.0;
      else if (tvlDelta7d < 0.0) tvlRisk = 35.0;
      else tvlRisk = 15.0;
    } else if (tvlUsd < 1000000) {
      tvlRisk = 70.0; // Illiquid protocol
    }

    return {
      miner_id: 301,
      miner_name: 'TVL Oracle',
      intent: 'TVL_LOOKUP',
      status: 'success',
      timestamp: new Date().toISOString(),
      risk_signal: tvlRisk,
      confidence: typeof tvlDelta7d === 'number' ? 92.0 : 70.0,
      data: {
        tvl_usd: tvlUsd,
        tvl_7d_delta_pct: tvlDelta7d ?? null,
      },
      verification: res.verification,
      payment: res.payment,
    };
  }
}

export class TavilyAdapter {
  constructor(private client: TelegraphClient) {}

  async fetchSignal(asset: string): Promise<NormalizedSignal> {
    const res = await this.client.queryMiner({
      minerId: 202,
      intent: 'WEB_SEARCH',
      endpoint: '/api/tavily/search',
      params: { query: `${asset} crypto security vulnerability breach exploit hack` },
    });

    if (!res.success || !res.data) {
      return {
        miner_id: 202,
        miner_name: 'Tavily',
        intent: 'WEB_SEARCH',
        status: res.status === 'UNCONFIGURED' ? 'unavailable' : 'failed',
        timestamp: new Date().toISOString(),
        risk_signal: 0.0,
        confidence: 0.0,
        data: { error: res.error || 'No search results' },
        verification: res.verification,
        payment: res.payment,
      };
    }

    const results: any[] = Array.isArray(res.data.results) ? res.data.results : [];
    
    // Deterministic Security Keyword Density Scanner:
    const criticalKeywords = ['exploit', 'hack', 'drain', 'compromised', 'vulnerability', 'reentrancy', 'flash loan attack', 'rug pull'];
    let securityHits = 0;
    const flaggedSnippets: string[] = [];

    for (const r of results) {
      const text = `${r.title || ''} ${r.content || ''}`.toLowerCase();
      for (const kw of criticalKeywords) {
        if (text.includes(kw)) {
          securityHits += 1;
          if (flaggedSnippets.length < 3) {
            flaggedSnippets.push(`[${kw.toUpperCase()}] ${r.title || ''}`);
          }
        }
      }
    }

    let securityRisk = 10.0;
    if (securityHits >= 4) securityRisk = 92.0;
    else if (securityHits >= 2) securityRisk = 68.0;
    else if (securityHits === 1) securityRisk = 40.0;

    return {
      miner_id: 202,
      miner_name: 'Tavily',
      intent: 'WEB_SEARCH',
      status: 'success',
      timestamp: new Date().toISOString(),
      risk_signal: securityRisk,
      confidence: results.length > 0 ? 88.0 : 50.0,
      data: {
        articles_analyzed: results.length,
        security_keyword_hits: securityHits,
        flagged_summaries: flaggedSnippets,
      },
      verification: res.verification,
      payment: res.payment,
    };
  }
}
