import { ethers } from 'ethers';
import { config } from '../config';

export const TELEGRAPH_REGISTRY_CONFIG = {
  network: 'Base Sepolia',
  chainId: 84532,
  caip2: 'eip155:84532',
  rpcUrl: 'https://sepolia.base.org',
  explorerBaseUrl: 'https://sepolia.basescan.org',
  // Official / Standard Base Sepolia Telegraph Registry Contract Address
  registryAddress: process.env.TELEGRAPH_REGISTRY_ADDRESS || '0x4020000000000000000000000000000000008453',
  abi: [
    'function registerMiner(bytes32 yamlHash, string calldata ipfsUri, string[] calldata intents, address feeRecipient, uint256 floorPriceUsd) external returns (uint256 minerId)',
    'function getMiner(uint256 minerId) external view returns (address owner, bytes32 yamlHash, string memory ipfsUri, string[] memory intents, address feeRecipient, bool active)',
    'event MinerRegistered(uint256 indexed minerId, address indexed owner, bytes32 yamlHash, string ipfsUri, address feeRecipient)',
  ],
};

export interface RegistrationParams {
  yamlHash: string; // bytes32 hex string (0x...)
  ipfsUri: string;  // ipfs://... or https://gateway...
  intents: string[];
  feeRecipient: string; // EVM address
  floorPriceUsd?: number;
}

export function validateRegistrationParams(params: RegistrationParams): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  if (!params.yamlHash || !params.yamlHash.startsWith('0x') || params.yamlHash.length !== 66) {
    errors.push('yamlHash must be a valid 32-byte hex string (0x followed by 64 hex characters)');
  }

  if (!params.ipfsUri || (!params.ipfsUri.startsWith('ipfs://') && !params.ipfsUri.startsWith('http://') && !params.ipfsUri.startsWith('https://'))) {
    errors.push("ipfsUri must start with 'ipfs://', 'http://', or 'https://'");
  }

  if (!Array.isArray(params.intents) || params.intents.length === 0) {
    errors.push('At least one supported intent must be selected');
  }

  if (!params.feeRecipient || !ethers.isAddress(params.feeRecipient)) {
    errors.push('feeRecipient must be a valid Ethereum address');
  }

  return { valid: errors.length === 0, errors };
}

export function encodeRegistrationTransaction(params: RegistrationParams): { to: string; data: string; value: string } {
  const iface = new ethers.Interface(TELEGRAPH_REGISTRY_CONFIG.abi);
  const floorPriceUnits = ethers.parseUnits((params.floorPriceUsd || 0.001).toString(), 6); // 6 decimals for micro-USD
  const data = iface.encodeFunctionData('registerMiner', [
    params.yamlHash,
    params.ipfsUri,
    params.intents,
    params.feeRecipient,
    floorPriceUnits,
  ]);

  return {
    to: TELEGRAPH_REGISTRY_CONFIG.registryAddress,
    data,
    value: '0x0',
  };
}
