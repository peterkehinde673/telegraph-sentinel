import axios from 'axios';
import { calculateTvlRisk, extractProtocol, fetchProtocolTvl } from '../src/tvl_oracle';

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
