import {
  fetchDefiLlamaPools,
  findMatchingPool,
  handleMinerYieldRate,
  normalizeYieldQuery,
  SEEDED_BENCHMARK_POOLS,
} from '../src/yield_oracle';

function createResponse() {
  return {
    statusCode: 200,
    body: undefined as any,
    status(code: number) { this.statusCode = code; return this; },
    json(body: any) { this.body = body; return this; },
  };
}

async function runYieldTests() {
  console.log('\n--- Running CRYPTO_YIELD_RATE Intent Tests ---');

  // 1. Query normalization
  console.log('1. Testing query normalization...');
  const norm1 = normalizeYieldQuery('What is the APY for Lido stETH?');
  if (norm1.asset !== 'steth' || norm1.venue !== 'lido') {
    throw new Error(`Normalization failed for Lido stETH: ${JSON.stringify(norm1)}`);
  }
  const norm2 = normalizeYieldQuery('Aave V3 USDC deposit rate');
  if (norm2.asset !== 'usdc' || norm2.venue !== 'aave-v3') {
    throw new Error(`Normalization failed for Aave USDC: ${JSON.stringify(norm2)}`);
  }
  const norm3 = normalizeYieldQuery('Rocket pool rETH staking reward');
  if (norm3.asset !== 'reth' || norm3.venue !== 'rocket-pool') {
    throw new Error(`Normalization failed for Rocket Pool rETH: ${JSON.stringify(norm3)}`);
  }
  console.log('   ✓ Query normalization passed.');

  // 2. Pool matching against seeded benchmark
  console.log('2. Testing pool matching against seeded benchmark table...');
  const match1 = findMatchingPool(SEEDED_BENCHMARK_POOLS, 'steth', 'steth', 'lido');
  if (!match1 || match1.pool.symbol !== 'STETH' || match1.pool.project !== 'lido') {
    throw new Error(`Failed to match Lido stETH in seeded benchmark: ${JSON.stringify(match1)}`);
  }
  if (match1.pool.apy <= 0 || match1.pool.tvlUsd <= 0) {
    throw new Error('Lido stETH seeded pool missing valid APY or TVL');
  }
  console.log(`   ✓ Matched ${match1.pool.project} ${match1.pool.symbol} (APY: ${match1.pool.apy}%, TVL: $${match1.pool.tvlUsd.toLocaleString()})`);

  // 3. Pool retrieval
  console.log('3. Testing pool dataset retrieval (live or cached fallback)...');
  const pools = await fetchDefiLlamaPools();
  if (!Array.isArray(pools) || pools.length === 0) {
    throw new Error('Failed to fetch or fallback pools dataset');
  }
  console.log(`   ✓ Pools dataset retrieved (${pools.length} pools available).`);

  // 4. Express handler parameter aliases and response contract
  console.log('4. Testing Express handler parameter parsing and schema...');
  const testInputs = [
    { query: { pool: 'stETH' } },
    { body: { query: 'What is Lido stETH APY?' } },
    { body: { input: { venue: 'aave-v3', asset: 'USDC' } } },
    { query: { q: 'Aave USDC rate' } },
  ];

  for (const reqMock of testInputs) {
    const res = createResponse();
    await handleMinerYieldRate(reqMock as any, res as any);
    if (res.statusCode !== 200) {
      throw new Error(`Handler returned status ${res.statusCode} for ${JSON.stringify(reqMock)}`);
    }
    const data = res.body;
    if (data.status !== 'success') {
      throw new Error(`Handler failed for ${JSON.stringify(reqMock)}: ${JSON.stringify(data)}`);
    }
    if (typeof data.apy !== 'number' || typeof data.apy_bps !== 'number' || typeof data.apr !== 'number') {
      throw new Error(`Handler missing yield numeric fields: ${JSON.stringify(data)}`);
    }
    if (data.apy_bps !== Math.round(data.apy * 100)) {
      throw new Error(`apy_bps (${data.apy_bps}) must match Math.round(apy * 100) (${Math.round(data.apy * 100)})`);
    }
    if (!data.summary || !data.answer || data.summary !== data.answer) {
      throw new Error('summary and answer must match and be non-empty');
    }
    if (typeof data.confidence !== 'number' || data.confidence !== data.confidence_score) {
      throw new Error('confidence and confidence_score must match');
    }
  }
  console.log('   ✓ Express handler query/body/input aliases, summary, and confidence verified.');

  console.log('--- All CRYPTO_YIELD_RATE Tests Passed! ---\n');
}

runYieldTests().catch((err) => {
  console.error('✗ CRYPTO_YIELD_RATE Test Failed:', err.message);
  process.exit(1);
});
