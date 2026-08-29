export interface AnalysisRecord {
  analysis_id: string;
  asset: string;
  mode?: string;
  action_type: string;
  risk_score: number;
  confidence_score: number;
  decision: string;
  reason_codes?: string[];
  created_at: string;
  signals?: any[];
  evidence?: any[];
  verification_metadata?: any;
  formula_breakdown?: any;
}

const analysisHistory: AnalysisRecord[] = [
  {
    analysis_id: 'init_eth_sample_001',
    asset: 'ETH',
    mode: 'ANALYZE',
    action_type: 'GENERAL_ANALYSIS',
    risk_score: 18.0,
    confidence_score: 95.0,
    decision: 'APPROVE',
    reason_codes: ['MODE_ANALYZE_ACTIVE', 'RISK_WITHIN_NORMAL_BOUNDS'],
    created_at: new Date(Date.now() - 3600000).toISOString(),
    signals: [
      {
        miner_id: 207,
        miner_name: 'CoinGecko',
        intent: 'CRYPTO_PRICE',
        status: 'success',
        timestamp: new Date().toISOString(),
        risk_signal: 18.0,
        confidence: 95.0,
        data: { price_usd: 3480.50, change_24h_pct: 1.4 },
        verification: { verified: false, status: 'UNVERIFIED', minerId: 207 },
        payment: { settled: false, status: 'NOT_REQUIRED' }
      },
      {
        miner_id: 301,
        miner_name: 'TVL Oracle',
        intent: 'TVL_LOOKUP',
        status: 'success',
        timestamp: new Date().toISOString(),
        risk_signal: 15.0,
        confidence: 90.0,
        data: { protocol: 'ETH', status: 'Healthy Liquidity' },
        verification: { verified: false, status: 'UNVERIFIED', minerId: 301 },
        payment: { settled: false, status: 'NOT_REQUIRED' }
      },
      {
        miner_id: 202,
        miner_name: 'Tavily',
        intent: 'WEB_SEARCH',
        status: 'success',
        timestamp: new Date().toISOString(),
        risk_signal: 10.0,
        confidence: 88.0,
        data: { security_exploits_found: 0, sentiment: 'Positive' },
        verification: { verified: false, status: 'UNVERIFIED', minerId: 202 },
        payment: { settled: false, status: 'NOT_REQUIRED' }
      }
    ],
    evidence: [
      { category: 'CRYPTO_PRICE', miner_id: 207, summary: 'Market price signal score 18.0/100', risk_contribution: 5.4, status: 'success' },
      { category: 'TVL_LOOKUP', miner_id: 301, summary: 'Liquidity oracle score 15.0/100', risk_contribution: 5.25, status: 'success' },
      { category: 'WEB_SEARCH', miner_id: 202, summary: 'Security incident scan score 10.0/100', risk_contribution: 3.5, status: 'success' }
    ],
    verification_metadata: { network: 'eip155:84532', verified: false }
  }
];

export async function saveAnalysis(record: AnalysisRecord): Promise<void> {
  analysisHistory.unshift(record);
  if (analysisHistory.length > 100) {
    analysisHistory.pop();
  }
}

export async function listAnalyses(limit: number = 25): Promise<AnalysisRecord[]> {
  return analysisHistory.slice(0, limit);
}
