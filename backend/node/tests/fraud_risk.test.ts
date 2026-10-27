import { evaluateFraudRisk, extractTarget, handleMinerFraudRisk, KNOWN_HIGH_RISK_ADDRESSES, KNOWN_SAFE_ADDRESSES } from '../src/fraud_risk';

function createResponse() {
  return {
    statusCode: 200,
    body: undefined as any,
    status(code: number) { this.statusCode = code; return this; },
    json(body: any) { this.body = body; return this; },
  };
}

async function runFraudRiskTests() {
  console.log('\n--- Running FRAUD_RISK Intent Tests ---');

  // 1. Target extraction
  console.log('1. Testing target extraction...');
  const tcAddress = '0xd90e2f925da726b50c4ed8d0fb90ad053324f31b';
  const ext1 = extractTarget(`Check transaction interaction with ${tcAddress} for risks`);
  if (ext1.address !== tcAddress.toLowerCase()) {
    throw new Error(`Address extraction failed: expected ${tcAddress}, got ${ext1.address}`);
  }
  const ext2 = extractTarget('Plain search query without address');
  if (ext2.address !== null) {
    throw new Error('Address extraction should return null when no 0x address is present');
  }
  console.log('   ✓ Address & text extraction verified.');

  // 2. High-risk address detection
  console.log('2. Testing known high-risk address detection...');
  const highRiskResult = evaluateFraudRisk('', tcAddress);
  if (highRiskResult.verdict !== 'High fraud risk' || highRiskResult.risk_score < 90 || highRiskResult.confidence < 0.95) {
    throw new Error(`Known threat address not flagged as High fraud risk: ${JSON.stringify(highRiskResult)}`);
  }
  console.log(`   ✓ High-risk entity detected: ${highRiskResult.verdict} (Score: ${highRiskResult.risk_score})`);

  // 3. Known safe canonical contract detection
  console.log('3. Testing verified safe protocol detection...');
  const uniRouter = '0xe592427a0aece92de3edee1f18e0157c05861564';
  const safeResult = evaluateFraudRisk('', uniRouter);
  if (safeResult.verdict !== 'Low fraud risk' || safeResult.risk_score > 20 || safeResult.confidence < 0.95) {
    throw new Error(`Canonical protocol address not recognized as Low fraud risk: ${JSON.stringify(safeResult)}`);
  }
  console.log(`   ✓ Safe protocol detected: ${safeResult.verdict} (Score: ${safeResult.risk_score})`);

  // 4. Keyword heuristic threat analysis
  console.log('4. Testing phishing/drainer keyword heuristics...');
  const drainerResult = evaluateFraudRisk('Suspicious permit2 signature request draining private keys');
  if (drainerResult.verdict !== 'High fraud risk' || drainerResult.risk_score < 70) {
    throw new Error(`Drainer attack pattern not classified as High fraud risk: ${JSON.stringify(drainerResult)}`);
  }
  console.log(`   ✓ Drainer keyword pattern detected: ${drainerResult.verdict} (Score: ${drainerResult.risk_score})`);

  // 5. Empty / insufficient input fallback
  console.log('5. Testing insufficient information handling...');
  const emptyResult = evaluateFraudRisk('');
  if (emptyResult.verdict !== 'Insufficient information' || emptyResult.confidence !== 0.0) {
    throw new Error(`Empty input must return Insufficient information: ${JSON.stringify(emptyResult)}`);
  }
  console.log('   ✓ Insufficient information handled cleanly with confidence 0.0.');

  // 6. Express handler parameter aliases and response contract
  console.log('6. Testing Express handler parameter parsing and schema...');
  const testCases = [
    { query: { address: tcAddress } },
    { body: { query: 'Is Uniswap V3 swap safe?' } },
    { body: { input: { address: uniRouter, question: 'Check contract' } } },
    { query: { q: 'drainer attack check' } },
  ];

  for (const reqMock of testCases) {
    const res = createResponse();
    await handleMinerFraudRisk(reqMock as any, res as any);
    if (res.statusCode !== 200) {
      throw new Error(`Handler returned status ${res.statusCode} for ${JSON.stringify(reqMock)}`);
    }
    const data = res.body;
    if (!data.status || !data.verdict || !data.summary || !data.answer || typeof data.risk_score !== 'number') {
      throw new Error(`Handler returned malformed response for ${JSON.stringify(reqMock)}: ${JSON.stringify(data)}`);
    }
    if (data.answer !== data.summary) {
      throw new Error('answer and summary must match');
    }
    if (data.confidence !== data.confidence_score) {
      throw new Error('confidence and confidence_score must match');
    }
  }
  console.log('   ✓ Express handler query/body/input aliases, summary, and confidence verified.');

  console.log('--- All FRAUD_RISK Tests Passed! ---\n');
}

runFraudRiskTests().catch((err) => {
  console.error('✗ FRAUD_RISK Test Failed:', err.message);
  process.exit(1);
});
