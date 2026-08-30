import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const wasmPath = path.resolve(__dirname, 'dist/telegraph_sentinel_scorer.wasm');
if (!fs.existsSync(wasmPath)) {
  console.error(`✗ WASM artifact not found at: ${wasmPath}`);
  process.exit(1);
}
const wasmBuffer = fs.readFileSync(wasmPath);

// Verify WebAssembly magic header (\0asm)
if (wasmBuffer[0] !== 0x00 || wasmBuffer[1] !== 0x61 || wasmBuffer[2] !== 0x73 || wasmBuffer[3] !== 0x6d) {
  console.error('✗ Invalid WASM binary header');
  process.exit(1);
}

WebAssembly.instantiate(wasmBuffer, {}).then(({ instance }) => {
  const ex = instance.exports;
  const { alloc, dealloc, rank_answer, rank_answer_cached, breakdown_answer, embed, cosine_sim, bm25_score, memory } = ex;

  console.log('\n================================================================');
  console.log('  TELEGRAPH PROTOCOL ENHANCED SENTINEL WASM SCORER AUDIT SUITE  ');
  console.log('================================================================');

  function write(str) {
    if (!str) return { ptr: 0, len: 0 };
    const buf = Buffer.from(str, 'utf8');
    const ptr = alloc(buf.length);
    const view = new Uint8Array(memory.buffer);
    view.set(buf, ptr);
    return { ptr, len: buf.length };
  }

  // 1. Core and Dynamic Assets
  const testCases = [
    // Standard Exact & Paraphrases vs Wrong Prices
    { q: "What is the price of Bitcoin?", gt: "$65,400", good: "Bitcoin (BTC) is currently trading at $65,400 USD.", bad: "Bitcoin (BTC) is currently trading at $12,000 USD." },
    { q: "What is Ethereum price?", gt: "$3,480", good: "Ethereum is around $3,480.00 right now.", bad: "Ethereum is around $850.00 right now." },
    { q: "What is Solana spot price?", gt: "$145.50", good: "SOL spot price is $145.50 USD.", bad: "SOL spot price is $22.00 USD." },
    
    // Formatting & Unit Multipliers (k, m, cents)
    { q: "What is Bitcoin price in USD?", gt: "$65,400", good: "BTC is currently trading at $65.4k.", bad: "BTC is currently trading at $25.4k." },
    { q: "What is Arbitrum spot price?", gt: "$0.55", good: "ARB is trading at 55 cents.", bad: "ARB is trading at 5 cents." },
    { q: "What is MakerDAO token value?", gt: "$2,100", good: "MKR is at $2.1k USD.", bad: "MKR is at $0.35k USD." },
    
    // Unseen Dynamic Assets (Generalization beyond hardcoded list)
    { q: "What is the current price of Celestia?", gt: "$5.20", good: "Celestia (TIA) is currently $5.20 USD.", bad: "Celestia (TIA) is currently $0.45 USD." },
    { q: "What is Injective spot price?", gt: "$24.50", good: "Injective is trading at $24.50.", bad: "Injective is trading at $1.50." },
    { q: "What is the price of Kaspa?", gt: "$0.16", good: "Kaspa (KAS) is worth $0.16.", bad: "Kaspa (KAS) is worth $2.50." },
    { q: "How much is Sui token today?", gt: "$1.85", good: "SUI is currently $1.85 USD.", bad: "SUI is currently $9.80 USD." },
    
    // Wrong Asset Substitution
    { q: "What is the price of Solana?", gt: "$145.50", good: "Solana is $145.50.", bad: "Cardano is $145.50." },
    { q: "What is Bitcoin spot price?", gt: "$65,400", good: "Bitcoin spot is $65,400 USD.", bad: "Ethereum spot is $65,400 USD." },
    { q: "What is Injective price?", gt: "$24.50", good: "Injective is $24.50.", bad: "Bitcoin is $24.50." },
    
    // Negation and Contradictions
    { q: "What is the price of Bitcoin?", gt: "$65,400", good: "Bitcoin is currently trading at $65,400.", bad: "Bitcoin is not trading at $65,400." },
    { q: "What is Ethereum spot price?", gt: "$3,480", good: "ETH is at $3,480 USD.", bad: "ETH dropped below $3,480 and is not $3,480." },
    
    // Stale & Historical Prices
    { q: "What is the price of Bitcoin?", gt: "$65,400", good: "Bitcoin spot price is $65,400.", bad: "Bitcoin all-time high was $65,400 in 2021." },
    { q: "What is Ethereum price?", gt: "$3,480", good: "Ethereum is trading at $3,480 right now.", bad: "Ethereum peaked at $3,480 last year." },
    
    // Currency Mismatches
    { q: "What is Solana price in USD?", gt: "$145.50", good: "Solana is $145.50 USD.", bad: "Solana is 145.50 EUR." },
    { q: "What is Chainlink price?", gt: "$11.80 USD", good: "LINK is $11.80 USD.", bad: "LINK is 11.80 GBP." },
    
    // Multiple Conflicting Prices / Hedging
    { q: "What is Avalanche price?", gt: "$28.40", good: "AVAX is $28.40 USD.", bad: "AVAX might be $28.40 or perhaps $4.10 or maybe $90." },
    { q: "What is Dogecoin spot price?", gt: "$0.10", good: "DOGE is trading at $0.10.", bad: "DOGE is unconfirmed and rumored around $0.10 maybe." },
    
    // Moderate / Near-miss Prices
    { q: "What is Bitcoin price?", gt: "$65,400", good: "Bitcoin is $65,400.", bad: "Bitcoin is $52,000." },
    { q: "What is Ethereum price?", gt: "$3,480", good: "Ethereum is $3,480.", bad: "Ethereum is $2,700." },
    
    // Concise vs Verbose Ground Truth
    { q: "What is the price of Uniswap?", gt: "$7.25", good: "$7.25 USD", bad: "$0.80 USD" },
    { q: "What is Polygon price?", gt: "$0.45", good: "Polygon (MATIC) is currently $0.45.", bad: "Polygon (MATIC) is currently $12.00." }
  ];

  let correctOrderings = 0;
  let totalGood = 0;
  let totalBad = 0;
  let totalMargin = 0;
  let minMargin = 1.0;
  const goodScores = [];
  const badScores = [];
  const allScores = [];

  testCases.forEach((t, i) => {
    const qW = write(t.q);
    const gtW = write(t.gt);
    const gW = write(t.good);
    const bW = write(t.bad);

    const sGood = rank_answer(qW.ptr, qW.len, gtW.ptr, gtW.len, gW.ptr, gW.len);
    const sBad = rank_answer(qW.ptr, qW.len, gtW.ptr, gtW.len, bW.ptr, bW.len);
    const margin = sGood - sBad;

    totalGood += sGood;
    totalBad += sBad;
    totalMargin += margin;
    goodScores.push(sGood);
    badScores.push(sBad);
    allScores.push(sGood, sBad);

    if (margin < minMargin) minMargin = margin;
    if (sGood > sBad) correctOrderings++;

    console.log(`Test #${(i + 1).toString().padStart(2, '0')}: Good: ${sGood.toFixed(4)} | Bad: ${sBad.toFixed(4)} | Margin: +${margin.toFixed(4)} [${sGood > sBad ? 'PASS ✓' : 'FAIL ✗'}]`);
  });

  const avgGood = totalGood / testCases.length;
  const avgBad = totalBad / testCases.length;
  const avgMargin = totalMargin / testCases.length;

  // Standard deviation of all evaluated scores
  const meanAll = allScores.reduce((a, b) => a + b, 0) / allScores.length;
  const variance = allScores.reduce((a, b) => a + Math.pow(b - meanAll, 2), 0) / allScores.length;
  const stdDev = Math.sqrt(variance);

  // Self match tests
  const selfMatchSamples = ["$65,400", "Bitcoin is trading at $65,400 USD", "$3,480.00", "SOL is $145.50"];
  let worstSelfMatch = 1.0;
  selfMatchSamples.forEach(sample => {
    const sW = write(sample);
    const qW = write("What is the price?");
    const score = rank_answer(qW.ptr, qW.len, sW.ptr, sW.len, sW.ptr, sW.len);
    if (score < worstSelfMatch) worstSelfMatch = score;
  });

  console.log('\n================================================================');
  console.log(`TOTAL ADVERSARIAL CASES:   ${testCases.length}`);
  console.log(`ORDERING ACCURACY:         ${correctOrderings} / ${testCases.length} (${((correctOrderings / testCases.length) * 100).toFixed(1)}%)`);
  console.log(`AVERAGE GOOD SCORE:        ${avgGood.toFixed(4)}`);
  console.log(`AVERAGE BAD SCORE:         ${avgBad.toFixed(4)}`);
  console.log(`AVERAGE SEPARATION MARGIN: +${avgMargin.toFixed(4)}`);
  console.log(`MINIMUM SEPARATION MARGIN: +${minMargin.toFixed(4)}`);
  console.log(`WORST SELF-MATCH SCORE:    ${worstSelfMatch.toFixed(4)}`);
  console.log(`SCORE STANDARD DEVIATION:  ${stdDev.toFixed(4)}`);
  console.log('================================================================\n');

  // Cached Equivalence Check
  const f0 = testCases[0];
  const q0 = write(f0.q);
  const gt0 = write(f0.gt);
  const g0 = write(f0.good);

  const rawQVec = embed(q0.ptr, q0.len);
  const qVecCopy = alloc(384 * 4);
  new Uint8Array(memory.buffer, qVecCopy, 384 * 4).set(new Uint8Array(memory.buffer, rawQVec, 384 * 4));

  const rawGtVec = embed(gt0.ptr, gt0.len);
  const gtVecCopy = alloc(384 * 4);
  new Uint8Array(memory.buffer, gtVecCopy, 384 * 4).set(new Uint8Array(memory.buffer, rawGtVec, 384 * 4));

  const baseS = rank_answer(q0.ptr, q0.len, gt0.ptr, gt0.len, g0.ptr, g0.len);
  const cachedS = rank_answer_cached(qVecCopy, gtVecCopy, gt0.ptr, gt0.len, g0.ptr, g0.len);
  const diff = Math.abs(baseS - cachedS);

  if (diff > 1e-5) throw new Error(`Cached mismatch: rank_answer (${baseS}) != cached (${cachedS})`);
  console.log(`✓ rank_answer (${baseS.toFixed(4)}) vs rank_answer_cached (${cachedS.toFixed(4)}) strictly equivalent.`);

  // Breakdown verification
  const bdPtr = breakdown_answer(q0.ptr, q0.len, gt0.ptr, gt0.len, g0.ptr, g0.len);
  const bdFloats = new Float32Array(memory.buffer, bdPtr, 5);
  console.log(`✓ breakdown_answer: [rel: ${bdFloats[0].toFixed(3)}, fact: ${bdFloats[1].toFixed(3)}, lex: ${bdFloats[2].toFixed(3)}, len: ${bdFloats[3].toFixed(3)}, comp: ${bdFloats[4].toFixed(3)}]`);

  // Cosine sim and BM25 verification
  const bmScore = bm25_score(gt0.ptr, gt0.len, g0.ptr, g0.len);
  const cosSim = cosine_sim(qVecCopy, gtVecCopy, 384);
  console.log(`✓ bm25_score: ${bmScore.toFixed(4)}, cosine_sim: ${cosSim.toFixed(4)}\n`);

}).catch(err => {
  console.error('Validation error:', err);
  process.exit(1);
});
