import { calculateCryptoConfidence, extractAsset, handleMinerRiskAssessment } from '../src/miner_endpoint';

function createResponse() {
  return {
    statusCode: 200,
    body: undefined as any,
    status(code: number) { this.statusCode = code; return this; },
    json(body: any) { this.body = body; return this; },
  };
}

async function runCryptoPriceTests() {
  console.log('\n--- Running CRYPTO_PRICE Intent Handler & Parser Tests ---');

  // 1. Natural language and alias parsing
  const parsingCases: Array<[string, string]> = [
    ['BTC', 'BTC'],
    ['price of SOL', 'SOL'],
    ['What is the current price of Bitcoin?', 'BTC'],
    ['What is Ethereum spot price right now?', 'ETH'],
    ['How much is the price of Solana in USD?', 'SOL'],
    ['BTC/USD', 'BTC'],
    ['What is ETH/USDT trading at?', 'ETH'],
    ['shiba inu', 'SHIB'],
    ['avalanche token', 'AVAX'],
    ['chainlink live price', 'LINK'],
    ['cardano spot', 'ADA'],
  ];

  for (const [input, expected] of parsingCases) {
    const actual = extractAsset(input);
    if (actual !== expected) {
      throw new Error(`Asset parser failed: "${input}" -> ${actual}, expected ${expected}`);
    }
  }
  console.log('   ✓ Asset parser and alias coverage verified.');

  // 2. Calibrated confidence tests
  if (calculateCryptoConfidence('binance') !== 0.98) throw new Error('Binance confidence calibration mismatch');
  if (calculateCryptoConfidence('coinbase') !== 0.98) throw new Error('Coinbase confidence calibration mismatch');
  if (calculateCryptoConfidence('kraken') !== 0.96) throw new Error('Kraken confidence calibration mismatch');
  if (calculateCryptoConfidence('coingecko') !== 0.94) throw new Error('CoinGecko confidence calibration mismatch');
  if (calculateCryptoConfidence(null) !== 0.0) throw new Error('Null source confidence calibration mismatch');
  console.log('   ✓ Calibrated confidence calculation verified.');

  // 3. Handler parameter extraction (body.input, query.pair, body.ticker, query.q)
  const testInputs = [
    { body: { input: { pair: 'BTC' } } },
    { body: { input: 'SOL' } },
    { query: { pair: 'ETH' } },
    { body: { ticker: 'AVAX' } },
    { query: { q: 'What is Cardano price?' } },
  ];

  for (const reqMock of testInputs) {
    const res = createResponse();
    await handleMinerRiskAssessment(reqMock as any, res as any);
    if (res.statusCode !== 200) {
      throw new Error(`Handler failed with status ${res.statusCode} for ${JSON.stringify(reqMock)}`);
    }
    const data = res.body;
    if (!data.status || !data.asset || !data.answer || !data.summary) {
      throw new Error(`Handler returned malformed response for ${JSON.stringify(reqMock)}: ${JSON.stringify(data)}`);
    }
    if (typeof data.confidence !== 'number' || typeof data.confidence_score !== 'number') {
      throw new Error(`Missing confidence fields in handler response: ${JSON.stringify(data)}`);
    }
    if (data.confidence !== data.confidence_score) {
      throw new Error('confidence and confidence_score must match');
    }
    if (data.answer !== data.summary) {
      throw new Error('answer and summary must match');
    }
  }
  console.log('   ✓ Express handler query/body/input aliases, summary, and confidence verified.');

  console.log('--- All CRYPTO_PRICE Tests Passed! ---\n');
}

runCryptoPriceTests().catch((err) => {
  console.error('✗ CRYPTO_PRICE Test Failed:', err.message);
  process.exit(1);
});
