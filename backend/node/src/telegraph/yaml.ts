import yaml from 'js-yaml';
import { ethers } from 'ethers';
import { config } from '../config';

export interface TelegraphMinerSpec {
  version: string;
  kind: 'miner';
  metadata: {
    id: string;
    slug: string;
    name: string;
    description: string;
    version: string;
    author: string;
    repository: string;
  };
  network: {
    supportedChains: string[];
    baseUrl: string;
    x402: {
      enabled: boolean;
      facilitatorUrl: string;
      defaultNetwork: string;
      pricingModel: string;
      floorPriceUsd: number;
    };
  };
  intents: string[];
  endpoints: Array<{
    intent: string;
    path: string;
    method: 'GET' | 'POST';
    description: string;
    requestParameters: Record<string, any>;
    responseSchema: Record<string, any>;
  }>;
  onchain: {
    feeRecipient: string;
    chainIdentifier: string;
  };
}

export function generateDefaultSentinelYaml(hostUrl?: string, feeRecipient?: string): TelegraphMinerSpec {
  const base = hostUrl || `http://localhost:${config.port}`;
  return {
    version: '1.0.0',
    kind: 'miner',
    metadata: {
      id: 'telegraph-sentinel-risk-miner',
      slug: 'sentinel-risk-oracle',
      name: 'Telegraph Sentinel Risk Intelligence',
      description: 'Autonomous pre-flight DeFi risk intelligence and multi-signal deterministic decision engine.',
      version: '0.2.0',
      author: 'peterkehinde673',
      repository: 'https://github.com/peterkehinde673/telegraph-sentinel',
    },
    network: {
      supportedChains: ['eip155:84532', 'eip155:8453'],
      baseUrl: base,
      x402: {
        enabled: true,
        facilitatorUrl: config.x402.facilitatorUrl,
        defaultNetwork: config.telegraph.network,
        pricingModel: 'x402-per-request',
        floorPriceUsd: 0.001,
      },
    },
    intents: [
      'CRYPTO_RISK_ASSESSMENT',
      'DEFI_PREFLIGHT_AUDIT',
      'SECURITY_INCIDENT_SCAN',
    ],
    endpoints: [
      {
        intent: 'CRYPTO_RISK_ASSESSMENT',
        path: '/api/v1/miner/risk-assessment',
        method: 'POST',
        description: 'Evaluates composite risk score (0-100), confidence (0-100), and outputs APPROVE, REVIEW, or BLOCK.',
        requestParameters: {
          asset: { type: 'string', required: true, example: 'ETH' },
          mode: { type: 'string', required: false, enum: ['ANALYZE', 'PROTECT', 'AUTOPILOT'], default: 'ANALYZE' },
          action_type: { type: 'string', required: false, default: 'GENERAL_ANALYSIS' },
        },
        responseSchema: {
          analysis_id: 'string',
          asset: 'string',
          mode: 'string',
          risk_score: 'number',
          confidence_score: 'number',
          decision: 'string',
          reason_codes: 'array',
          signals: 'array',
          evidence: 'array',
          verification_metadata: 'object',
        },
      },
      {
        intent: 'DEFI_PREFLIGHT_AUDIT',
        path: '/api/analyze',
        method: 'POST',
        description: 'Standard Sentinel gateway evaluation endpoint for multi-miner signal aggregation.',
        requestParameters: {
          asset: { type: 'string', required: true },
        },
        responseSchema: {
          decision: 'string',
          risk_score: 'number',
        },
      },
    ],
    onchain: {
      feeRecipient: feeRecipient || (config.x402.walletPrivateKey ? new ethers.Wallet(config.x402.walletPrivateKey.startsWith('0x') ? config.x402.walletPrivateKey : `0x${config.x402.walletPrivateKey}`).address : '0x0000000000000000000000000000000000000000'),
      chainIdentifier: config.telegraph.network,
    },
  };
}

export function serializeToYaml(spec: TelegraphMinerSpec): string {
  return yaml.dump(spec, { indent: 2, lineWidth: -1 });
}

export function parseAndValidateYaml(rawYaml: string): { valid: boolean; spec?: TelegraphMinerSpec; errors: string[]; hashes?: { sha256: string; keccak256: string; bytes32Hash: string; ipfsCidPlaceholder: string } } {
  const errors: string[] = [];
  let parsed: any;

  try {
    parsed = yaml.load(rawYaml);
  } catch (err: any) {
    return { valid: false, errors: [`YAML Syntax Error: ${err.message}`] };
  }

  if (!parsed || typeof parsed !== 'object') {
    return { valid: false, errors: ['Parsed YAML must be an object'] };
  }

  if (parsed.kind !== 'miner') errors.push("Missing or invalid 'kind' field (must be 'miner')");
  if (!parsed.metadata?.name) errors.push("Missing 'metadata.name'");
  if (!parsed.metadata?.slug) errors.push("Missing 'metadata.slug'");
  if (!Array.isArray(parsed.intents) || parsed.intents.length === 0) errors.push("Field 'intents' must be a non-empty list of strings");
  if (!parsed.network?.baseUrl) errors.push("Missing 'network.baseUrl'");

  // Deterministic normalized serialization for consistent hashing
  const normalizedStr = typeof parsed === 'object' ? JSON.stringify(parsed, Object.keys(parsed).sort()) : rawYaml;
  
  const utf8Bytes = ethers.toUtf8Bytes(normalizedStr);
  const sha256Hash = ethers.sha256(utf8Bytes);
  const keccak256Hash = ethers.keccak256(utf8Bytes);

  // Deterministic mock CID format for local preview before IPFS pinning
  const ipfsCidPlaceholder = `bafkrei${sha256Hash.slice(2, 48)}`;

  return {
    valid: errors.length === 0,
    spec: parsed as TelegraphMinerSpec,
    errors,
    hashes: {
      sha256: sha256Hash,
      keccak256: keccak256Hash,
      bytes32Hash: keccak256Hash,
      ipfsCidPlaceholder,
    },
  };
}
