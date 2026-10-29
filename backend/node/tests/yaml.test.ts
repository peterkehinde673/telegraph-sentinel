import fs from 'fs';
import path from 'path';
import { parseAndValidateYaml, generateDefaultSentinelYaml, serializeToYaml } from '../src/telegraph/yaml';

async function runYamlTests() {
  console.log('\n--- Running Telegraph Miner YAML Validation Tests ---');

  // Test 1: Validate docs/sentinel-miner.yaml
  console.log('1. Validating docs/sentinel-miner.yaml...');
  const docPath = path.resolve(__dirname, '../../../docs/sentinel-miner.yaml');
  const docYaml = fs.readFileSync(docPath, 'utf8');
  const docResult = parseAndValidateYaml(docYaml);

  if (!docResult.valid) {
    throw new Error(`docs/sentinel-miner.yaml failed validation: ${docResult.errors.join(', ')}`);
  }
  console.log('   ✓ docs/sentinel-miner.yaml is valid.');
  console.log('     sha256:', docResult.hashes?.sha256);
  console.log('     bytes32Hash:', docResult.hashes?.bytes32Hash);
  console.log('     ipfsCidPlaceholder:', docResult.hashes?.ipfsCidPlaceholder);

  const parsedDoc = docResult.spec as any;
  if (!parsedDoc.input_schema || typeof parsedDoc.input_schema !== 'object') {
    throw new Error('docs/sentinel-miner.yaml missing input_schema');
  }
  if (!parsedDoc.output_schema || typeof parsedDoc.output_schema !== 'object') {
    throw new Error('docs/sentinel-miner.yaml missing output_schema');
  }
  if (!parsedDoc.on_chain || typeof parsedDoc.on_chain !== 'object') {
    throw new Error('docs/sentinel-miner.yaml missing on_chain specification');
  }
  console.log('   ✓ Top-level input_schema, output_schema, and on_chain blocks verified.');

  // Test 2: Validate public/engine-subnets/sentinel-risk-oracle.yaml
  console.log('2. Validating public/engine-subnets/sentinel-risk-oracle.yaml...');
  const subnetPath = path.resolve(__dirname, '../../../public/engine-subnets/sentinel-risk-oracle.yaml');
  const subnetYaml = fs.readFileSync(subnetPath, 'utf8');
  const subnetResult = parseAndValidateYaml(subnetYaml);

  if (!subnetResult.valid) {
    throw new Error(`public/engine-subnets/sentinel-risk-oracle.yaml failed validation: ${subnetResult.errors.join(', ')}`);
  }
  console.log('   ✓ public/engine-subnets/sentinel-risk-oracle.yaml is valid.');

  // Test 3: Validate generated spec from generateDefaultSentinelYaml()
  console.log('3. Validating programmatic spec from generateDefaultSentinelYaml()...');
  const genSpec = generateDefaultSentinelYaml('https://telegraph-sentinel-d68u.onrender.com');
  const genYaml = serializeToYaml(genSpec);
  const genResult = parseAndValidateYaml(genYaml);

  if (!genResult.valid) {
    throw new Error(`generateDefaultSentinelYaml failed validation: ${genResult.errors.join(', ')}`);
  }
  console.log('   ✓ Programmatic spec is valid and serializable.');

  // Test 4: Endpoint and intent mapping verification
  console.log('4. Verifying every declared intent has a mapped endpoint with canonical intent naming...');
  const declaredIntents: string[] = parsedDoc.semantics?.supported_intents || parsedDoc.intents || [];
  const expectedCanonicalIntents = [
    'CRYPTO_PRICE',
    'TVL_LOOKUP',
    'WEB_SEARCH',
    'FRAUD_RISK',
    'CRYPTO_YIELD_RATE',
  ];

  for (const expected of expectedCanonicalIntents) {
    if (!declaredIntents.includes(expected)) {
      throw new Error(`Expected canonical intent ${expected} missing from declared intents`);
    }
  }

  const endpoints = parsedDoc.endpoints || [];
  if (endpoints.length !== expectedCanonicalIntents.length) {
    throw new Error(`Expected ${expectedCanonicalIntents.length} endpoints, got ${endpoints.length}`);
  }

  for (const ep of endpoints) {
    if (!ep.path || !ep.external_path) {
      throw new Error(`Endpoint ${ep.path} missing required path or external_path`);
    }
    if (!Array.isArray(ep.intents) || ep.intents.length === 0) {
      throw new Error(`Endpoint ${ep.path} missing required 'intents' list`);
    }
    for (const epIntent of ep.intents) {
      if (!declaredIntents.includes(epIntent)) {
        throw new Error(`Endpoint intent ${epIntent} not found in declared supported_intents`);
      }
    }
  }
  console.log(`   ✓ All ${declaredIntents.length} canonical intents verified with exact 1-to-1 endpoint mappings.`);

  console.log('--- All Telegraph Miner YAML Tests Passed! ---\n');
}

runYamlTests().catch((err) => {
  console.error('✗ YAML Test Failed:', err.message);
  process.exit(1);
});
