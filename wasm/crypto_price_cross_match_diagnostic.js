import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

const wasmPath = path.resolve(rootDir, 'wasm/dist/telegraph_sentinel_scorer.wasm');
if (!fs.existsSync(wasmPath)) {
  console.error(`Error: WASM not found at ${wasmPath}`);
  process.exit(1);
}

const wasmBuffer = fs.readFileSync(wasmPath);
const { instance } = await WebAssembly.instantiate(wasmBuffer, {});
const ex = instance.exports;

function write(str) {
  if (!str) return { ptr: 0, len: 0 };
  const buf = Buffer.from(str, 'utf8');
  const ptr = ex.alloc(buf.length);
  new Uint8Array(ex.memory.buffer).set(buf, ptr);
  return { ptr, len: buf.length };
}

function rank(q, gt, ans) {
  const wQ = write(q);
  const wGt = write(gt);
  const wAns = write(ans);
  const score = ex.rank_answer(wQ.ptr, wQ.len, wGt.ptr, wGt.len, wAns.ptr, wAns.len);
  ex.dealloc(wQ.ptr, wQ.len);
  ex.dealloc(wGt.ptr, wGt.len);
  ex.dealloc(wAns.ptr, wAns.len);
  return score;
}

const fixtures = [
  { id: "BTC_USD", q: "What is the price of Bitcoin?", gt: "$65,400", good: "Bitcoin (BTC) is currently trading at $65,400 USD." },
  { id: "ETH_USD", q: "What is Ethereum price?", gt: "$3,480", good: "Ethereum is trading at $3,480.00 USD (+1.40% 24h)." },
  { id: "SOL_USD", q: "What is Solana spot price?", gt: "$145.50", good: "1 SOL = $145.50 USD." },
  { id: "AVAX_USD", q: "What is Avalanche price?", gt: "$28.40", good: "As of August 30, 2026, AVAX is $28.40 USD." },
  { id: "LINK_USD", q: "What is Chainlink price?", gt: "$11.80", good: "LINK is $11.80 with $2.5B 24h volume, ranked #15." },
  { id: "ARB_USD", q: "What is Arbitrum spot price?", gt: "$0.55", good: "ARB is trading at 55 cents." },
  { id: "BTC_K", q: "What is Bitcoin price in USD?", gt: "$65,400", good: "BTC is currently trading at $65.4k." },
  { id: "TIA_USD", q: "What is the current price of Celestia?", gt: "$5.20", good: "Celestia (TIA) is currently $5.20 USD." },
  { id: "DOGE_USD", q: "What is Dogecoin spot price?", gt: "$0.10", good: "Dogecoin spot price is $0.10 USD." },
  { id: "MKR_USD", q: "What is MakerDAO token value?", gt: "$2,100", good: "MKR is at $2.1k USD." },
  { id: "ICP_USD", q: "What is Internet Computer price?", gt: "$7.80", good: "ICP is $7.80." },
  { id: "BCH_USD", q: "What is Bitcoin Cash price?", gt: "$340.00", good: "BCH is $340.00." },
  { id: "ETC_USD", q: "What is Ethereum Classic price?", gt: "$19.20", good: "ETC is $19.20." },
  { id: "XMR_USD", q: "What is Monero price?", gt: "$165.00", good: "Monero (XMR) is $165.00." },
  { id: "LTC_USD", q: "What is Litecoin price?", gt: "$68.00", good: "Litecoin (LTC) is $68.00." }
];

console.log('================================================================================');
console.log('         TELEGRAPH PROTOCOL CRYPTO_PRICE STRUCTURAL VALIDATION AUDIT             ');
console.log('================================================================================\n');

let minSelfMatch = 1.0;
let maxSelfMatch = 0.0;
let maxUnrelatedCrossMatch = 0.0;
let crossMatchCollisions = [];
let totalSelfMatches = 0;
let totalCrossMatches = 0;
let topCrossMatches = [];

// 1. Evaluate Exact Self-Matches (GT == Candidate)
console.log('--- 1. EXACT SELF-MATCHES (Candidate == GT) ---');
for (const f of fixtures) {
  const score = rank(f.q, f.gt, f.gt);
  totalSelfMatches++;
  if (score < minSelfMatch) minSelfMatch = score;
  if (score > maxSelfMatch) maxSelfMatch = score;
  console.log(`  [${f.id}] Self-Match (GT == GT): Score = ${score.toFixed(4)} ${score === 1.0 ? '✓' : '✗'}`);
}

// 2. Evaluate Factual Paraphrase Scores (Candidate == Good Paraphrase)
console.log('\n--- 2. FACTUAL PARAPHRASE MATCHES (Candidate == Good Answer) ---');
let minGoodScore = 1.0;
let maxGoodScore = 0.0;
for (const f of fixtures) {
  const score = rank(f.q, f.gt, f.good);
  if (score < minGoodScore) minGoodScore = score;
  if (score > maxGoodScore) maxGoodScore = score;
  console.log(`  [${f.id}] Good Paraphrase: Score = ${score.toFixed(4)} (< 1.0: ${score < 1.0 ? '✓' : '✗'})`);
}

// 3. Full Cross-Match Evaluation Matrix
console.log('\n--- 3. UNRELATED CROSS-MATCH MATRIX (Fixture i vs Fixture j) ---');
for (let i = 0; i < fixtures.length; i++) {
  for (let j = 0; j < fixtures.length; j++) {
    if (i === j) continue;
    const fI = fixtures[i];
    const fJ = fixtures[j];

    const isSameTarget = fI.gt === fJ.gt && fI.id.split('_')[0] === fJ.id.split('_')[0];
    if (isSameTarget) continue;

    totalCrossMatches++;

    const sGtCross = rank(fI.q, fI.gt, fJ.gt);
    const sGoodCross = rank(fI.q, fI.gt, fJ.good);

    const sMax = Math.max(sGtCross, sGoodCross);
    if (sMax > maxUnrelatedCrossMatch) {
      maxUnrelatedCrossMatch = sMax;
    }

    topCrossMatches.push({
      qId: fI.id,
      candId: fJ.id,
      q: fI.q,
      gt: fI.gt,
      cand: sGtCross >= sGoodCross ? fJ.gt : fJ.good,
      score: sMax
    });

    if (sMax >= 1.0) {
      crossMatchCollisions.push({ qId: fI.id, candId: fJ.id, score: sMax });
    }
  }
}

topCrossMatches.sort((a, b) => b.score - a.score);

console.log('\nTOP 10 HIGHEST UNRELATED CROSS-MATCHES:');
for (let k = 0; k < Math.min(10, topCrossMatches.length); k++) {
  const m = topCrossMatches[k];
  console.log(`  #${k+1}: [Q: ${m.qId} vs Cand: ${m.candId}] Score: ${m.score.toFixed(4)} | Cand: "${m.cand}"`);
}

const separation = minSelfMatch - maxUnrelatedCrossMatch;

console.log('\n================================================================================');
console.log('                     STRUCTURAL AUDIT SUMMARY METRICS                           ');
console.log('================================================================================');
console.log(`MINIMUM EXACT SELF-MATCH:        ${minSelfMatch.toFixed(4)}`);
console.log(`MAXIMUM EXACT SELF-MATCH:        ${maxSelfMatch.toFixed(4)}`);
console.log(`MINIMUM GOOD PARAPHRASE SCORE:   ${minGoodScore.toFixed(4)}`);
console.log(`MAXIMUM GOOD PARAPHRASE SCORE:   ${maxGoodScore.toFixed(4)}`);
console.log(`MAXIMUM UNRELATED CROSS-MATCH:   ${maxUnrelatedCrossMatch.toFixed(4)}`);
console.log(`STRUCTURAL SEPARATION MARGIN:    +${separation.toFixed(4)}`);
console.log(`1.0000 CROSS-MATCH COLLISIONS:   ${crossMatchCollisions.length}`);
console.log('--------------------------------------------------------------------------------');

if (minSelfMatch === 1.0 && maxUnrelatedCrossMatch < 1.0 && separation > 0.80 && crossMatchCollisions.length === 0) {
  console.log('✓ STRUCTURAL VALIDATION PASSED: Self-match (1.0000) strictly beats every unrelated cross-match.');
} else {
  console.error('✗ STRUCTURAL VALIDATION FAILED: Invariant violated.');
  process.exit(1);
}
