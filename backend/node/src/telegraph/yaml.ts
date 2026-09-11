import yaml from 'js-yaml';
import { ethers } from 'ethers';
import { config } from '../config';

export interface TelegraphMinerSpec {
  version: string;
  kind: 'miner';
  metadata: { id: string; slug: string; name: string; description: string; version: string; author: string; repository: string; };
  network: { supportedChains: string[]; baseUrl: string; x402: { enabled: boolean; facilitatorUrl: string; defaultNetwork: string; pricingModel: string; floorPriceUsd: number; }; };
  intents: string[];
  endpoints: Array<{ intent: string; path: string; method: 'GET' | 'POST'; description: string; requestParameters: Record<string, any>; responseSchema: Record<string, any>; }>;
  onchain: { feeRecipient: string; chainIdentifier: string; };
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
    intents: ['CRYPTO_PRICE', 'TVL_LOOKUP', 'WEB_SEARCH'],
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
        responseSchema: { status: 'string', miner_id: 'number', intent: 'string', protocol: 'string', tvl_usd: 'number|null', tvl_7d_delta_pct: 'number|null', risk_signal: 'number', confidence_score: 'number' },
      },
      {
        intent: 'WEB_SEARCH', path: '/api/v1/miner/web-search', method: 'POST',
        description: 'Real-time web intelligence search backed by Tavily Search API.',
        requestParameters: { query: { type: 'string', required: true, example: 'Latest security incidents affecting Aave' } },
        responseSchema: { status: 'string', miner_id: 'number', intent: 'string', query: 'string', answer: 'string', results: 'array', risk_signal: 'number', confidence_score: 'number' },
      },
    ],
    onchain: {
      feeRecipient: feeRecipient || (config.x402.walletPrivateKey ? new ethers.Wallet(config.x402.walletPrivateKey.startsWith('0x') ? config.x402.walletPrivateKey : `0x${config.x402.walletPrivateKey}`).address : '0x0000000000000000000000000000000000000000'),
      chainIdentifier: config.telegraph.network,
    },
  };
}

export function serializeToYaml(spec: TelegraphMinerSpec): string { return yaml.dump(spec, { indent: 2, lineWidth: -1 }); }

export function parseAndValidateYaml(rawYaml: string): { valid: boolean; spec?: TelegraphMinerSpec; errors: string[]; hashes?: { sha256: string; keccak256: string; bytes32Hash: string; ipfsCidPlaceholder: string } } {
  const errors: string[] = []; let parsed: any;
  try { parsed = yaml.load(rawYaml); } catch (err: any) { return { valid: false, errors: [`YAML Syntax Error: ${err.message}`] }; }
  if (!parsed || typeof parsed !== 'object') return { valid: false, errors: ['Parsed YAML must be an object'] };
  if (parsed.kind !== 'miner') errors.push("Missing or invalid 'kind' field (must be 'miner')");
  if (!parsed.metadata?.name) errors.push("Missing 'metadata.name'");
  if (!parsed.metadata?.slug) errors.push("Missing 'metadata.slug'");
  if (!Array.isArray(parsed.intents) || parsed.intents.length === 0) errors.push("Field 'intents' must be a non-empty list of strings");
  if (!parsed.network?.baseUrl) errors.push("Missing 'network.baseUrl'");
  const normalizedStr = typeof parsed === 'object' ? JSON.stringify(parsed, Object.keys(parsed).sort()) : rawYaml;
  const utf8Bytes = ethers.toUtf8Bytes(normalizedStr); const sha256Hash = ethers.sha256(utf8Bytes); const keccak256Hash = ethers.keccak256(utf8Bytes);
  const ipfsCidPlaceholder = `bafkrei${sha256Hash.slice(2, 48)}`;
  return { valid: errors.length === 0, spec: parsed as TelegraphMinerSpec, errors, hashes: { sha256: sha256Hash, keccak256: keccak256Hash, bytes32Hash: keccak256Hash, ipfsCidPlaceholder } };
}
