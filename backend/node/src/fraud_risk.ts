import { Request, Response } from 'express';

export type FraudVerdict =
  | 'High fraud risk'
  | 'Elevated fraud risk'
  | 'Low fraud risk'
  | 'Insufficient information';

export interface FraudRiskResult {
  status: 'success' | 'unavailable';
  miner_id: 501;
  intent: string;
  verdict: FraudVerdict;
  risk_score: number;
  confidence: number;
  confidence_score: number;
  summary: string;
  answer: string;
  address: string | null;
  risk_factors: string[];
  source: 'sentinel-risk-engine';
  as_of: string;
  timestamp: string;
}

// Known high-risk addresses (Tornado Cash routers/pools, sanctioned entities, known drainer deployments)
export const KNOWN_HIGH_RISK_ADDRESSES: Record<string, string> = {
  // Tornado Cash core pools & router (OFAC Sanctioned)
  '0xd90e2f925da726b50c4ed8d0fb90ad053324f31b': 'Tornado Cash: Router',
  '0x12d66f87a04a9e220743712ce6d9bb1b5616b8fc': 'Tornado Cash: 0.1 ETH Pool',
  '0x47ce0c6ed5b0ce3d3a51fdb1c52dc66a7c3c2936': 'Tornado Cash: 1 ETH Pool',
  '0x910cbd523d972eb0a6f4cae4618ad62622b39dbf': 'Tornado Cash: 10 ETH Pool',
  '0xa160cdab224e496019e33ec31ca24891e7dcdbe5': 'Tornado Cash: 100 ETH Pool',
  '0x0836222f2b2b24a3f36f98668ed8f0b38d1a872f': 'Tornado Cash: 1000 DAI Pool',
  '0x4736dcf1b7a3d580672cce6e7c65cd5cc9cfba9d': 'Tornado Cash: 100 USDC Pool',
  // Known public malicious drainer proxies & honeypot deployers
  '0x0000000000000000000000000000000000000000': 'Null Address (Zero Transfer / Burn)',
  '0x000000000000000000000000000000000000dead': 'Dead Address (Burn)',
  '0x72905b0a3f740a83e0dc911fa48a07f0f622416b': 'Inferno Drainer: Phishing Contract',
  '0x0000db5c8b030ae7a27ac870cda294c16a695b35': 'PinkDrainer: Malicious Permit Handler',
  '0x40134f4fed95c32fa1d596637b77b7389a19c72e': 'Monkey Drainer: Fake Airdrop Disperser',
};

// Known verified safe/canonical infrastructure contracts
export const KNOWN_SAFE_ADDRESSES: Record<string, string> = {
  // Uniswap V3 Factory & SwapRouter
  '0x1f98431c8ad98523631ae4a59f267346ea31f984': 'Uniswap: UNI Token Contract',
  '0xe592427a0aece92de3edee1f18e0157c05861564': 'Uniswap V3: SwapRouter',
  '0x68b3465833fb72a70ecdf485e0e4c7bd8665fc45': 'Uniswap: SwapRouter02',
  // Aave V3 Pool
  '0x87870bca3f3fd6335c3f4ce8392d69350b4fa4e2': 'Aave V3: LendingPool (Ethereum)',
  // Lido stETH
  '0xae7ab96520de3a18e5e111b5eaab095312d7fe84': 'Lido: stETH Token Contract',
  // Maker / Sky DAI
  '0x6b175474e89094c44da98b954eedeac495271d0f': 'MakerDAO: DAI Stablecoin Contract',
  // USDC (Ethereum)
  '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48': 'Circle: USDC Token Contract',
};

const HIGH_RISK_KEYWORDS = [
  'drainer', 'permit2', 'steal', 'private key', 'seed phrase', 'unlimited approval',
  'airdrop claim', 'honeypot', 'fake token', 'rugpull', 'exploit', 'tornado', 'mixer',
  'compromised', 'stolen', 'phishing', 'sweeper', 'malicious', 'scam', 'impersonat',
];

const SAFE_KEYWORDS = [
  'uniswap', 'aave', 'lido', 'makerdao', 'curve', 'compound', 'official vault',
  'usdc contract', 'verified contract', 'normal transfer', 'staking reward',
];

export function extractTarget(raw: unknown): {
  address: string | null;
  text: string;
} {
  const text = String(raw ?? '').trim();
  const addressMatch = text.match(/0x[a-fA-F0-9]{40}/);
  const address = addressMatch ? addressMatch[0].toLowerCase() : null;
  return { address, text };
}

export function evaluateFraudRisk(
  rawInput: unknown,
  providedAddress?: string | null,
): {
  verdict: FraudVerdict;
  risk_score: number;
  confidence: number;
  summary: string;
  address: string | null;
  risk_factors: string[];
} {
  const { address: extractedAddress, text } = extractTarget(rawInput);
  const address = (providedAddress && providedAddress.startsWith('0x') && providedAddress.length === 42)
    ? providedAddress.toLowerCase()
    : extractedAddress;

  const risk_factors: string[] = [];
  const lowerText = text.toLowerCase();

  // If both input text and address are empty
  if (!text && !address) {
    return {
      verdict: 'Insufficient information',
      risk_score: 0,
      confidence: 0.0,
      summary: 'Insufficient input provided to evaluate fraud risk. Please provide an address, query, or transaction.',
      address: null,
      risk_factors: ['NO_INPUT_PROVIDED'],
    };
  }

  let baseRisk = 15;
  let confidence = 0.92;

  // 1. Direct address lookup in high-risk threat database
  if (address && KNOWN_HIGH_RISK_ADDRESSES[address]) {
    const label = KNOWN_HIGH_RISK_ADDRESSES[address];
    risk_factors.push(`KNOWN_HIGH_RISK_ENTITY: ${label}`);
    return {
      verdict: 'High fraud risk',
      risk_score: 95.0,
      confidence: 0.98,
      summary: `Address ${address} is identified as a high-risk entity (${label}). Immediate caution advised.`,
      address,
      risk_factors,
    };
  }

  // 2. Direct address lookup in known safe list
  if (address && KNOWN_SAFE_ADDRESSES[address]) {
    const label = KNOWN_SAFE_ADDRESSES[address];
    risk_factors.push(`VERIFIED_CANONICAL_PROTOCOL: ${label}`);
    return {
      verdict: 'Low fraud risk',
      risk_score: 5.0,
      confidence: 0.98,
      summary: `Address ${address} matches verified canonical infrastructure (${label}). Low fraud risk detected.`,
      address,
      risk_factors,
    };
  }

  // 3. Keyword risk analysis on question / description / query
  let highKeywordMatches = 0;
  for (const kw of HIGH_RISK_KEYWORDS) {
    if (lowerText.includes(kw)) {
      highKeywordMatches++;
      risk_factors.push(`SUSPICIOUS_KEYWORD_${kw.toUpperCase().replace(/\s+/g, '_')}`);
    }
  }

  let safeKeywordMatches = 0;
  for (const kw of SAFE_KEYWORDS) {
    if (lowerText.includes(kw)) {
      safeKeywordMatches++;
      risk_factors.push(`CANONICAL_KEYWORD_${kw.toUpperCase().replace(/\s+/g, '_')}`);
    }
  }

  if (highKeywordMatches > 0) {
    baseRisk += Math.min(80, highKeywordMatches * 30);
    confidence = Math.min(0.98, confidence + highKeywordMatches * 0.02);
  }

  if (safeKeywordMatches > 0) {
    baseRisk = Math.max(5, baseRisk - safeKeywordMatches * 20);
  }

  // 4. Address format validation
  if (address) {
    if (address === '0x0000000000000000000000000000000000000000') {
      risk_factors.push('NULL_ADDRESS');
      baseRisk = 80;
    } else {
      risk_factors.push('VALID_EVM_ADDRESS_FORMAT');
    }
  }

  const finalRisk = Math.min(100, Math.max(0, baseRisk));

  let verdict: FraudVerdict = 'Low fraud risk';
  if (finalRisk >= 70) {
    verdict = 'High fraud risk';
  } else if (finalRisk >= 35) {
    verdict = 'Elevated fraud risk';
  } else {
    verdict = 'Low fraud risk';
  }

  let explanation = '';
  if (risk_factors.includes('OFAC_SANCTIONED_ENTITY') || risk_factors.includes('TORNADO_CASH_MIXER')) {
    explanation = ' Identified sanctioned entity or privacy mixer contract with elevated money-laundering risk.';
  } else if (risk_factors.some(f => f.startsWith('KNOWN_THREAT_'))) {
    explanation = ' Address or entity matches known threat intelligence signature in security database.';
  } else if (risk_factors.some(f => f.startsWith('ATTACK_INDICATOR_'))) {
    explanation = ' Attack indicators detected matching wallet drainer, phishing or unauthorized approval patterns.';
  } else if (risk_factors.includes('VERIFIED_SAFE_CANONICAL_PROTOCOL')) {
    explanation = ' Address is a verified safe canonical DeFi protocol contract.';
  } else if (risk_factors.includes('NULL_ADDRESS')) {
    explanation = ' Zero or burn address target.';
  } else {
    explanation = risk_factors.length > 0 ? ` Factors evaluated: ${risk_factors.join(', ')}.` : ' Clean profile without detected malicious indicators.';
  }

  const summary = `${verdict}. Risk score: ${finalRisk}/100, confidence: ${confidence.toFixed(2)}.${explanation}`;

  return {
    verdict,
    risk_score: finalRisk,
    confidence,
    summary,
    address,
    risk_factors,
  };
}

export async function handleMinerFraudRisk(req: Request, res: Response): Promise<void> {
  const input = req.body?.input;
  const inputTarget = typeof input === 'string'
    ? input
    : input && typeof input === 'object'
      ? (input.query || input.question || input.address || input.description || input.tx || input.q)
      : undefined;

  const rawAddress = req.query?.address || req.body?.address || (input && typeof input === 'object' ? input.address : undefined);
  const rawInput = req.query?.query || req.body?.query
    || req.query?.question || req.body?.question
    || req.query?.description || req.body?.description
    || req.query?.tx || req.body?.tx
    || req.query?.transaction || req.body?.transaction
    || req.query?.q || req.body?.q
    || inputTarget
    || rawAddress
    || '';

  const nowIso = new Date().toISOString();
  const requestedIntent = (req.body?.intent || req.query?.intent || '').toString().trim().toUpperCase();
  const responseIntent = (requestedIntent === 'FRAUD_RISK_GENERAL' || requestedIntent === 'FRAUD_DETECTION_GENERAL')
    ? requestedIntent
    : 'FRAUD_RISK';
  const assessment = evaluateFraudRisk(rawInput, typeof rawAddress === 'string' ? rawAddress : null);

  const responsePayload: FraudRiskResult = {
    status: assessment.verdict === 'Insufficient information' ? 'unavailable' : 'success',
    miner_id: 501,
    intent: responseIntent,
    verdict: assessment.verdict,
    risk_score: assessment.risk_score,
    confidence: assessment.confidence,
    confidence_score: assessment.confidence,
    summary: assessment.summary,
    answer: assessment.summary,
    address: assessment.address,
    risk_factors: assessment.risk_factors,
    source: 'sentinel-risk-engine',
    as_of: nowIso,
    timestamp: nowIso,
  };

  res.status(200).json(responsePayload);
}
