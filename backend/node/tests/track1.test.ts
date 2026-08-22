import axios from 'axios';
import { generateDefaultSentinelYaml, serializeToYaml, parseAndValidateYaml } from '../src/telegraph/yaml';
import { validateRegistrationParams, encodeRegistrationTransaction } from '../src/telegraph/onchain';

async function runTrack1Tests() {
  console.log('\n--- Running Track 1: Telegraph Miner Integration Tests ---');
  const BASE_URL = 'http://127.0.0.1:4000';

  // 1. YAML Generation & Validation
  console.log('1. Testing YAML Spec Generation & Validation...');
  const spec = generateDefaultSentinelYaml('http://localhost:4000');
  const rawYaml = serializeToYaml(spec);
  const valResult = parseAndValidateYaml(rawYaml);

  if (!valResult.valid || !valResult.hashes?.bytes32Hash) {
    throw new Error(`YAML validation failed: ${valResult.errors.join(', ')}`);
  }
  console.log('   ✓ Generated YAML is valid. bytes32 hash:', valResult.hashes.bytes32Hash);

  // 2. Base Sepolia Calldata Encoding
  console.log('2. Testing Base Sepolia Calldata Encoding...');
  const regParams = {
    yamlHash: valResult.hashes.bytes32Hash,
    ipfsUri: `ipfs://${valResult.hashes.ipfsCidPlaceholder}`,
    intents: ['CRYPTO_PRICE', 'TVL_LOOKUP', 'WEB_SEARCH'],
    feeRecipient: '0x6811a9e33ce68fbdf6e07dfacab317072c287596',
    floorPriceUsd: 0.01,
  };

  const validation = validateRegistrationParams(regParams);
  if (!validation.valid) throw new Error(validation.errors.join(', '));

  const encodedTx = encodeRegistrationTransaction(regParams);
  if (!encodedTx.data.startsWith('0x')) throw new Error('Failed to encode transaction calldata');
  console.log('   ✓ On-chain transaction encoded. Destination:', encodedTx.to);

  // 3. Spec Endpoint
  console.log('3. Testing GET /api/v1/miner/spec.yaml endpoint...');
  const yamlRes = await axios.get(`${BASE_URL}/api/v1/miner/spec.yaml`);
  if (yamlRes.status !== 200 || !yamlRes.data.includes('kind: miner')) {
    throw new Error('Miner YAML spec endpoint failed');
  }
  console.log('   ✓ Spec YAML served successfully.');

  // 4. Live Miner Endpoint
  console.log('4. Testing POST /api/v1/miner/risk-assessment (Agent Query)...');
  const minerRes = await axios.post(`${BASE_URL}/api/v1/miner/risk-assessment`, {
    asset: 'ETH',
    mode: 'ANALYZE',
  });

  if (minerRes.status !== 200 || !minerRes.data.decision) {
    throw new Error('Miner intelligence endpoint failed');
  }
  console.log(`   ✓ Miner evaluated ${minerRes.data.asset}. Decision: ${minerRes.data.decision}, Risk: ${minerRes.data.risk_score}`);

  console.log('--- All Track 1 Miner Integration Tests Passed! ---\n');
  process.exit(0);
}

runTrack1Tests().catch((err) => {
  console.error('✗ Track 1 Test Failed:', err.message);
  process.exit(1);
});
