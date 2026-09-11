import axios from 'axios';
import { extractAsset } from '../src/miner_endpoint';

async function runMinerTests() {
  console.log('\n--- Running Live Miner Real-Data Integration Tests ---');
  const BASE_URL = 'http://127.0.0.1:4000';

  // Query parsing must preserve the original direct-asset behavior and also
  // handle the natural-language forms used by Telegraph intents.
  const parsingCases: Array<[string, string]> = [
    ['BTC', 'BTC'],
    ['price of SOL', 'SOL'],
    ['What is the current price of Bitcoin?', 'BTC'],
    ['What is Ethereum spot price right now?', 'ETH'],
    ['How much is the price of Solana in USD?', 'SOL'],
    ['BTC/USD', 'BTC'],
    ['What is ETH/USDT trading at?', 'ETH'],
  ];

  for (const [input, expected] of parsingCases) {
    if (extractAsset(input) !== expected) {
      throw new Error(`Asset parser failed: "${input}" -> ${extractAsset(input)}, expected ${expected}`);
    }
  }
  console.log('   ✓ Natural-language asset parsing passed.');

  // 1. Test BTC price query via POST
  console.log('1. Testing BTC query via POST...');
  const btcRes = await axios.post(`${BASE_URL}/api/v1/miner/risk-assessment`, { asset: 'BTC' });
  if (btcRes.status !== 200 || !btcRes.data.answer.includes('BTC')) {
    throw new Error('BTC query failed');
  }
  console.log('   ✓ BTC Response:', btcRes.data.answer, `(Price: $${btcRes.data.price_usd})`);

  // 2. Test ETH query via GET params
  console.log('2. Testing ETH query via GET params...');
  const ethRes = await axios.get(`${BASE_URL}/api/v1/miner/risk-assessment?asset=ETH`);
  if (ethRes.status !== 200 || !ethRes.data.answer.includes('ETH')) {
    throw new Error('ETH query failed');
  }
  console.log('   ✓ ETH Response:', ethRes.data.answer, `(Price: $${ethRes.data.price_usd})`);

  // 3. Test natural-language SOL query
  console.log('3. Testing natural-language SOL query...');
  const solRes = await axios.post(`${BASE_URL}/api/v1/miner/risk-assessment`, { query: 'What is the current price of Solana?' });
  if (solRes.status !== 200 || solRes.data.asset !== 'SOL' || !solRes.data.answer.includes('SOL')) {
    throw new Error('Natural-language SOL query failed');
  }
  console.log('   ✓ SOL Response:', solRes.data.answer, `(Price: $${solRes.data.price_usd})`);

  // 4. Test missing/empty parameters
  console.log('4. Testing empty parameter fallback safety...');
  const emptyRes = await axios.post(`${BASE_URL}/api/v1/miner/risk-assessment`, {});
  if (emptyRes.status !== 200 || !emptyRes.data.asset) {
    throw new Error('Empty query fallback failed');
  }
  console.log('   ✓ Fallback handled safely. Asset defaulted to:', emptyRes.data.asset);

  console.log('--- All Live Miner Integration Tests Passed! ---\n');
  process.exit(0);
}

runMinerTests().catch(err => {
  console.error('✗ Miner Test Failed:', err.message);
  process.exit(1);
});
