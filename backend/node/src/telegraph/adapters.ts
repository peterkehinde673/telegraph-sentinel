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
      params: { ids: formattedAsset, vs_currencies: 'usd' },
    });

    if (!res.success) {
      return {
        miner_id: 207,
        miner_name: 'CoinGecko',
        intent: 'CRYPTO_PRICE',
        status: res.status === 'UNCONFIGURED' ? 'unavailable' : 'failed',
        timestamp: new Date().toISOString(),
        risk_signal: 0.0,
        confidence: 0.0,
        data: { error: res.error },
        verification: {},
        payment: res.payment || {},
      };
    }

    return {
      miner_id: 207,
      miner_name: 'CoinGecko',
      intent: 'CRYPTO_PRICE',
      status: 'success',
      timestamp: new Date().toISOString(),
      risk_signal: 25.0,
      confidence: 90.0,
      data: res.data || {},
      verification: res.verification || {},
      payment: res.payment || {},
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

    if (!res.success) {
      return {
        miner_id: 301,
        miner_name: 'TVL Oracle',
        intent: 'TVL_LOOKUP',
        status: res.status === 'UNCONFIGURED' ? 'unavailable' : 'failed',
        timestamp: new Date().toISOString(),
        risk_signal: 0.0,
        confidence: 0.0,
        data: { error: res.error },
        verification: {},
        payment: res.payment || {},
      };
    }

    return {
      miner_id: 301,
      miner_name: 'TVL Oracle',
      intent: 'TVL_LOOKUP',
      status: 'success',
      timestamp: new Date().toISOString(),
      risk_signal: 20.0,
      confidence: 88.0,
      data: res.data || {},
      verification: res.verification || {},
      payment: res.payment || {},
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
      params: { query: `${asset} security breach vulnerability` },
    });

    if (!res.success) {
      return {
        miner_id: 202,
        miner_name: 'Tavily',
        intent: 'WEB_SEARCH',
        status: res.status === 'UNCONFIGURED' ? 'unavailable' : 'failed',
        timestamp: new Date().toISOString(),
        risk_signal: 0.0,
        confidence: 0.0,
        data: { error: res.error },
        verification: {},
        payment: res.payment || {},
      };
    }

    return {
      miner_id: 202,
      miner_name: 'Tavily',
      intent: 'WEB_SEARCH',
      status: 'success',
      timestamp: new Date().toISOString(),
      risk_signal: 15.0,
      confidence: 85.0,
      data: res.data || {},
      verification: res.verification || {},
      payment: res.payment || {},
    };
  }
}
