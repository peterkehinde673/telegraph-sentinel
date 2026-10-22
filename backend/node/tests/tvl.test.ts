import axios from 'axios';
import { calculateTvlRisk, extractProtocol, fetchProtocolTvl, handleMinerTvlLookup } from '../src/tvl_oracle';
import { generateDefaultSentinelYaml } from '../src/telegraph/yaml';

async function runHandlerTests() {
  const tvlResponseSchema = generateDefaultSentinelYaml().endpoints
    .find((endpoint) => endpoint.intent === 'TVL_LOOKUP')?.responseSchema;
  if (tvlResponseSchema?.risk_signal !== 'number|null') {
    throw new Error('TVL response schema must allow a missing risk estimate');
  }

  const originalGet = axios.get;
  const now = Math.floor(Date.now() / 1000);
  const history = {
    name: 'Test Protocol',
    tvl: [
      { date: now - 7 * 24 * 60 * 60, totalLiquidityUSD: 900_000 },
      { date: now, totalLiquidityUSD: 1_000_000 },
    ],
  };

  try {
    (axios as any).get = async (url: string) => ({
      data: url.includes('/tvl/') ? 1_000_000 : history,
    });
    for (const body of [{ protocol: 'Aave' }, { query: 'What is the TVL of Uniswap?' }]) {
      const response = createResponse();
      await handleMinerTvlLookup({ query: {}, body } as any, response as any);
      if (response.statusCode !== 200 || response.body.status !== 'success' || response.body.tvl_usd !== 1_000_000) {
        throw new Error(`TVL payload lookup failed for ${JSON.stringify(body)}`);
      }
      const expectedSlug = 'protocol' in body ? 'aave' : 'uniswap';
      if (response.body.protocol_slug !== expectedSlug) throw new Error('TVL payload resolved the wrong protocol');
    }

    (axios as any).get = async (url: string) => ({
      data: url.includes('/tvl/') ? null : history,
    });
    const unavailable = createResponse();
    await handleMinerTvlLookup({ query: {}, body: { protocol: 'NoDataProtocol' } } as any, unavailable as any);
    if (unavailable.statusCode !== 503 || unavailable.body.status !== 'unavailable'
      || unavailable.body.tvl_usd !== null || unavailable.body.confidence_score !== 0
      || unavailable.body.source !== 'none') {
      throw new Error('Missing TVL data must be reported as unavailable, without a success confidence');
    }
  } finally {
    (axios as any).get = originalGet;
  }
}

function createResponse() {
  return {
    statusCode: 200,
    body: undefined as any,
    status(code: number) { this.statusCode = code; return this; },
    json(body: any) { this.body = body; return this; },
  };
}

async function runTvlTests() {
  console.log('\n--- Running TVL Oracle Tests ---');

  const parsingCases: Array<[string, string]> = [
    ['AAVE', 'aave'],
    ['Aave', 'aave'],
    ['What is the TVL of Aave?', 'aave'],
    ['Aave V3 total value locked', 'aave-v3'],
    ['Uniswap TVL', 'uniswap'],
    ['Curve Finance TVL', 'curve-dex'],
    ['Maker DAO TVL', 'makerdao'],
  ];

  for (const [input, expected] of parsingCases) {
    const actual = extractProtocol(input);
    if (actual !== expected) {
      throw new Error(`Protocol parser failed: "${input}" -> ${actual}, expected ${expected}`);
    }
  }
  console.log('   ✓ Natural-language protocol parsing passed.');

  if (calculateTvlRisk(100_000_000, -30) !== 90) throw new Error('Severe TVL drawdown risk failed');
  if (calculateTvlRisk(100_000_000, -15) !== 60) throw new Error('Elevated TVL drawdown risk failed');
  if (calculateTvlRisk(100_000_000, -5) !== 35) throw new Error('Moderate TVL drawdown risk failed');
  if (calculateTvlRisk(100_000_000, 5) !== 15) throw new Error('Stable/growing TVL risk failed');
  console.log('   ✓ Deterministic TVL risk thresholds passed.');

  await runHandlerTests();
  console.log('   ✓ Direct, query payload, and unavailable TVL handler cases passed.');

  console.log('3. Querying live DefiLlama data for Aave...');
  const result = await fetchProtocolTvl('Aave');
  if (!result || result.tvl_usd <= 0 || result.source !== 'defillama') {
    throw new Error('Live Aave TVL lookup failed');
  }
  console.log(`   ✓ Aave TVL: $${result.tvl_usd.toLocaleString()} (7d: ${result.tvl_7d_delta_pct ?? 'n/a'}%)`);

  console.log('4. Verifying the upstream endpoint returns real protocol data...');
  const upstream = await axios.get('https://api.llama.fi/protocol/aave', { timeout: 8000 });
  if (!upstream.data?.name || !Array.isArray(upstream.data?.tvl)) {
    throw new Error('DefiLlama protocol response shape changed');
  }
  console.log('   ✓ DefiLlama protocol endpoint returned expected data.');

  console.log('--- All TVL Oracle Tests Passed! ---\n');
}

runTvlTests().catch((err) => {
  console.error('✗ TVL Test Failed:', err.message);
  process.exit(1);
});
