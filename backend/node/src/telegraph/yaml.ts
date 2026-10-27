import yaml from 'js-yaml';
import { ethers } from 'ethers';
import { config } from '../config';

export interface TelegraphMinerSpec {
  version: string;
  kind: 'miner';
  metadata: { id: string; slug: string; name: string; description: string; version: string; author: string; repository: string; };
  network: { supportedChains: string[]; baseUrl: string; x402: { enabled: boolean; facilitatorUrl: string; defaultNetwork: string; pricingModel: string; floorPriceUsd: number; }; };
  intents: string[];
  endpoints: Array<{ intent?: string; path: string; method: 'GET' | 'POST'; description: string; requestParameters?: Record<string, any>; responseSchema?: Record<string, any>; }>;
  onchain?: { feeRecipient: string; chainIdentifier: string; };
  input_schema?: Record<string, any>;
  output_schema?: Record<string, any>;
  semantics?: {
    signal_mapping?: Record<string, string>;
    supported_intents?: string[];
  };
}

export function generateDefaultSentinelYaml(hostUrl?: string, feeRecipient?: string): TelegraphMinerSpec {
  const base = hostUrl || `http://localhost:${config.port}`;
  return {
    version: '1.0.0', kind: 'miner',
    metadata: {
      id: 'telegraph-sentinel-risk-miner', slug: 'sentinel-risk-oracle', name: 'Telegraph Sentinel Risk Intelligence',
      description: 'Autonomous pre-flight DeFi risk intelligence and multi-signal deterministic decision engine.', version: '0.3.0', author: 'peterkehinde673', repository: 'https://github.com/peterkehinde673/telegraph-sentinel',
    },
    network: {
      supportedChains: ['eip155:84532', 'eip155:8453'], baseUrl: base,
      x402: { enabled: true, facilitatorUrl: config.x402.facilitatorUrl, defaultNetwork: config.telegraph.network, pricingModel: 'x402-per-request', floorPriceUsd: 0.001 },
    },
    intents: ['CRYPTO_PRICE', 'TVL_LOOKUP', 'WEB_SEARCH', 'FRAUD_RISK', 'CRYPTO_YIELD_RATE'],
    endpoints: [
      {
        intent: 'CRYPTO_PRICE', path: '/api/v1/miner/risk-assessment', method: 'POST',
        description: 'Live cryptocurrency price and market intelligence oracle with real exchange fallbacks.',
        requestParameters: { asset: { type: 'string', required: true, example: 'ETH' }, query: { type: 'string', required: false, example: 'What is the price of BTC?' } },
        responseSchema: { status: 'string', miner_id: 'number', intent: 'string', asset: 'string', answer: 'string', price_usd: 'number|null', change_24h_pct: 'number|null', confidence_score: 'number' },
      },
      {
        intent: 'TVL_LOOKUP', path: '/api/v1/miner/tvl', method: 'POST',
        description: 'Real-time protocol TVL oracle backed by DefiLlama protocol data.',
        requestParameters: { protocol: { type: 'string', required: true, example: 'Aave' }, query: { type: 'string', required: false, example: 'What is the TVL of Aave?' } },
        responseSchema: { status: 'string', miner_id: 'number', intent: 'string', protocol: 'string', tvl_usd: 'number|null', tvl_7d_delta_pct: 'number|null', risk_signal: 'number|null', confidence_score: 'number' },
      },
      {
        intent: 'WEB_SEARCH', path: '/api/v1/miner/web-search', method: 'POST',
        description: 'Real-time web intelligence search backed by Gemini Google Search grounding with Tavily as a fallback.',
        requestParameters: { query: { type: 'string', required: true, example: 'Latest security incidents affecting Aave' } },
        responseSchema: { status: 'string', miner_id: 'number', intent: 'string', query: 'string', answer: 'string', results: 'array', risk_signal: 'number', confidence_score: 'number' },
      },
      {
        intent: 'FRAUD_RISK', path: '/api/v1/miner/fraud-risk', method: 'POST',
        description: 'Autonomous pre-flight fraud and drainer risk analysis engine evaluating addresses, transactions, and attack signatures.',
        requestParameters: { address: { type: 'string', required: false, example: '0xd90e2f925da726b50c4ed8d0fb90ad053324f31b' }, query: { type: 'string', required: false, example: 'Is this address safe?' } },
        responseSchema: { status: 'string', miner_id: 'number', intent: 'string', verdict: 'string', risk_score: 'number', confidence_score: 'number', summary: 'string' },
      },
      {
        intent: 'CRYPTO_YIELD_RATE', path: '/api/v1/miner/yield', method: 'POST',
        description: 'Real-time DeFi pool yield oracle reporting APY, basis points, and TVL across major protocols.',
        requestParameters: { pool: { type: 'string', required: false, example: 'stETH' }, query: { type: 'string', required: false, example: 'What is Lido stETH APY?' } },
        responseSchema: { status: 'string', miner_id: 'number', intent: 'string', pool: 'string', venue: 'string', apy: 'number', apy_bps: 'number', confidence_score: 'number', summary: 'string' },
      },
    ],
    onchain: {
      feeRecipient: feeRecipient || (config.x402.walletPrivateKey ? new ethers.Wallet(config.x402.walletPrivateKey.startsWith('0x') ? config.x402.walletPrivateKey : `0x${config.x402.walletPrivateKey}`).address : '0x0000000000000000000000000000000000000000'),
      chainIdentifier: config.telegraph.network,
    },
    input_schema: {
      type: 'object',
      properties: {
        asset: { type: 'string', description: 'Cryptocurrency ticker or symbol (e.g. BTC, ETH, SOL).' },
        symbol: { type: 'string', description: 'Trading symbol or market pair alias (e.g. BTCUSDT, ETH-USD).' },
        protocol: { type: 'string', description: 'DeFi protocol slug or name (e.g. aave, uniswap, lido).' },
        chain: { type: 'string', description: 'Blockchain network name for chain TVL (e.g. ethereum, base, arbitrum).' },
        query: { type: 'string', description: 'Search query or natural-language intelligence question.' },
        question: { type: 'string', description: 'Verbatim natural-language question from Telegraph evaluators.' },
      },
      required: [],
    },
    output_schema: {
      type: 'object',
      properties: {
        status: { type: 'string', description: 'Status of the response (success, unavailable, error).' },
        miner_id: { type: 'integer', description: 'Registered Telegraph miner identifier (501).' },
        intent: { type: 'string', description: 'Canonical intent evaluated (CRYPTO_PRICE, TVL_LOOKUP, WEB_SEARCH, FRAUD_RISK, CRYPTO_YIELD_RATE).' },
        answer: { type: 'string', description: 'Human-readable authoritative answer string.' },
        summary: { type: 'string', description: 'Concise evaluation summary.' },
        confidence: { type: 'number', description: 'Calibrated confidence score between 0.0 and 1.0.' },
        confidence_score: { type: 'number', description: 'Backward-compatible confidence score field.' },
        price_usd: { type: ['number', 'null'], description: 'Spot price in USD for CRYPTO_PRICE queries.' },
        tvl_usd: { type: ['number', 'null'], description: 'Total value locked in USD for TVL queries.' },
        results: { type: 'array', description: 'Web search intelligence results.' },
        verdict: { type: 'string', description: 'Fraud risk verdict assessment.' },
        risk_score: { type: ['number', 'null'], description: 'Risk assessment score (0-100).' },
        pool: { type: 'string', description: 'DeFi yield pool identifier.' },
        venue: { type: 'string', description: 'DeFi yield venue or protocol.' },
        apy: { type: ['number', 'null'], description: 'Annual percentage yield.' },
        apy_bps: { type: ['integer', 'null'], description: 'APY in basis points.' },
        source: { type: 'string', description: 'Authoritative data source provider.' },
        timestamp: { type: 'string', description: 'ISO 8601 timestamp of response generation.' },
      },
      required: ['status', 'answer', 'confidence_score'],
    },
    semantics: {
      signal_mapping: {
        confidence_field: 'confidence_score',
        label_field: 'answer',
        reason_field: 'answer',
      },
      supported_intents: ['CRYPTO_PRICE', 'TVL_LOOKUP', 'WEB_SEARCH', 'FRAUD_RISK', 'CRYPTO_YIELD_RATE'],
    },
  };
}

export function serializeToYaml(spec: TelegraphMinerSpec): string { return yaml.dump(spec, { indent: 2, lineWidth: -1 }); }

export function parseAndValidateYaml(rawYaml: string): { valid: boolean; spec?: TelegraphMinerSpec; errors: string[]; hashes?: { sha256: string; keccak256: string; bytes32Hash: string; ipfsCidPlaceholder: string } } {
  const errors: string[] = []; let parsed: any;
  try { parsed = yaml.load(rawYaml); } catch (err: any) { return { valid: false, errors: [`YAML Syntax Error: ${err.message}`] }; }
  if (!parsed || typeof parsed !== 'object') return { valid: false, errors: ['Parsed YAML must be an object'] };
  if (parsed.kind !== 'miner') errors.push("Missing or invalid 'kind' field (must be 'miner')");

  const name = parsed.metadata?.name || parsed.name;
  if (!name) errors.push("Missing 'metadata.name' or 'name'");

  const slug = parsed.metadata?.slug || parsed.slug;
  if (!slug) errors.push("Missing 'metadata.slug' or 'slug'");

  const intents = parsed.intents || parsed.semantics?.supported_intents;
  if (!Array.isArray(intents) || intents.length === 0) {
    errors.push("Field 'intents' or 'semantics.supported_intents' must be a non-empty list of strings");
  }

  const baseUrl = parsed.network?.baseUrl || parsed.base_url;
  if (!baseUrl) errors.push("Missing 'network.baseUrl' or 'base_url'");

  const normalizedStr = typeof parsed === 'object' ? JSON.stringify(parsed, Object.keys(parsed).sort()) : rawYaml;
  const utf8Bytes = ethers.toUtf8Bytes(normalizedStr); const sha256Hash = ethers.sha256(utf8Bytes); const keccak256Hash = ethers.keccak256(utf8Bytes);
  const ipfsCidPlaceholder = `bafkrei${sha256Hash.slice(2, 48)}`;
  return { valid: errors.length === 0, spec: parsed as TelegraphMinerSpec, errors, hashes: { sha256: sha256Hash, keccak256: keccak256Hash, bytes32Hash: keccak256Hash, ipfsCidPlaceholder } };
}
