import axios from 'axios';

async function runMinerTests() {
  console.log('\n--- Running Live Miner Real-Data Integration Tests ---');
  const BASE_URL = 'http://127.0.0.1:4000';

  // 1. Test BTC price query
  console.log('1. Testing BTC query via POST...');
  const btcRes = await axios.post(`${BASE_URL}/api/v1/miner/risk-assessment`, { asset: 'BTC' });
  if (btcRes.status !== 200 || !btcRes.data.answer.includes('BTC')) {
    throw new Error('BTC query failed');
  }
  console.log('   ✓ BTC Response:', btcRes.data.answer, `(Price: $${btcRes.data.price_usd})`);

  // 2. Test ETH price query via GET
  console.log('2. Testing ETH query via GET params...');
  const ethRes = await axios.get(`${BASE_URL}/api/v1/miner/risk-assessment?asset=ETH`);
  if (ethRes.status !== 200 || !ethRes.data.answer.includes('ETH')) {
    throw new Error('ETH query failed');
  }
  console.log('   ✓ ETH Response:', ethRes.data.answer, `(Price: $${ethRes.data.price_usd})`);

  // 3. Test SOL price query
  console.log('3. Testing SOL query...');
  const solRes = await axios.post(`${BASE_URL}/api/v1/miner/risk-assessment`, { query: 'price of SOL' });
  if (solRes.status !== 200 || !solRes.data.answer.includes('SOL')) {
    throw new Error('SOL query failed');
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
