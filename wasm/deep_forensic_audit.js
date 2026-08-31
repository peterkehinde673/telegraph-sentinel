import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

const wasmBuffer = fs.readFileSync(path.resolve(rootDir, 'wasm/dist/telegraph_sentinel_scorer.wasm'));
const { instance } = await WebAssembly.instantiate(wasmBuffer, {});
const ex = instance.exports;

function write(str) {
  if (!str) return { ptr: 0, len: 0 };
  const buf = Buffer.from(str, 'utf8');
  const ptr = ex.alloc(buf.length);
  new Uint8Array(ex.memory.buffer).set(buf, ptr);
  return { ptr, len: buf.length };
}

function writeFloats(floats) {
  const ptr = ex.alloc(floats.length * 4);
  new Float32Array(ex.memory.buffer, ptr, floats.length).set(floats);
  return ptr;
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

function rankCached(q, gt, ans) {
  const wQ = write(q);
  const wGt = write(gt);
  const wAns = write(ans);

  const qPtr = ex.embed(wQ.ptr, wQ.len);
  const qVec = new Float32Array(new Float32Array(ex.memory.buffer, qPtr, 384));
  const gtPtr = ex.embed(wGt.ptr, wGt.len);
  const gtVec = new Float32Array(new Float32Array(ex.memory.buffer, gtPtr, 384));

  const qVecAlloc = writeFloats(qVec);
  const gtVecAlloc = writeFloats(gtVec);

  const score = ex.rank_answer_cached(qVecAlloc, gtVecAlloc, wGt.ptr, wGt.len, wAns.ptr, wAns.len);

  ex.dealloc(qVecAlloc, 384 * 4);
  ex.dealloc(gtVecAlloc, 384 * 4);
  ex.dealloc(wQ.ptr, wQ.len);
  ex.dealloc(wGt.ptr, wGt.len);
  ex.dealloc(wAns.ptr, wAns.len);
  return score;
}

const realisticFailureProbes = [
  {
    category: "A. Realistic Metadata & Exchange Preamble",
    q: "What is Bitcoin price right now?",
    gt: "$65,400",
    good: "According to Binance spot feed, BTC/USDT is currently trading at $65,400.25 with 24h high of $66,100.",
    bad: "According to Binance spot feed, BTC/USDT is currently trading at $61,200.00 with 24h high of $66,100."
  },
  {
    category: "B. Conversational Phrasing with Colon",
    q: "Can you give me the price of Ethereum?",
    gt: "$3,480",
    good: "Sure! The current spot price of Ethereum is: $3,480.00 USD.",
    bad: "Sure! The current spot price of Ethereum is: $1,250.00 USD."
  },
  {
    category: "C. Unlisted Dynamic Crypto Asset in Cached Mode",
    q: "What is the spot price of Astar ASTR token?",
    gt: "$0.062",
    good: "Astar (ASTR) is currently trading at $0.062 USD.",
    bad: "Solana (SOL) is currently trading at $0.062 USD."
  },
  {
    category: "D. Multi-Asset Market Overview (Correct Asset Answered)",
    q: "How much is Solana right now?",
    gt: "$145.50",
    good: "Solana is currently $145.50, whereas Bitcoin is $65,400 and Ethereum is $3,480.",
    bad: "Solana is currently $22.00, whereas Bitcoin is $65,400 and Ethereum is $3,480."
  },
  {
    category: "E. Yesterday's Close vs Current Spot Price",
    q: "What is Bitcoin price today?",
    gt: "$65,400",
    good: "Bitcoin is trading at $65,400 today, up from yesterday's close of $64,100.",
    bad: "Bitcoin was $65,400 yesterday, but is now trading at $72,000 today."
  },
  {
    category: "F. Tight Exchange Spread / Minor Rounding",
    q: "What is Chainlink price?",
    gt: "$11.80",
    good: "LINK is trading at $11.805 on Kraken.",
    bad: "LINK is trading at $11.450 on Kraken."
  },
  {
    category: "G. Cents & Shorthand Variations",
    q: "What is Arbitrum spot price in USD?",
    gt: "$0.55",
    good: "ARB is currently 55 cents ($0.55).",
    bad: "ARB is currently 15 cents ($0.15)."
  },
  {
    category: "H. Unit Quantity Equivalent",
    q: "What is Dogecoin spot price?",
    gt: "$0.10",
    good: "100 DOGE = $10.00 ($0.10 per coin).",
    bad: "100 DOGE = $100.00 ($1.00 per coin)."
  }
];

console.log('================================================================================');
console.log('       REALISTIC HIDDEN-BENCHMARK PROBE: UNCACHED VS CACHED EVALUATION          ');
console.log('================================================================================\n');

let failedProbes = 0;

for (const p of realisticFailureProbes) {
  const sGoodU = rank(p.q, p.gt, p.good);
  const sBadU = rank(p.q, p.gt, p.bad);
  const mgnU = sGoodU - sBadU;

  const sGoodC = rankCached(p.q, p.gt, p.good);
  const sBadC = rankCached(p.q, p.gt, p.bad);
  const mgnC = sGoodC - sBadC;

  const passedU = sGoodU > sBadU && mgnU >= 0.80;
  const passedC = sGoodC > sBadC && mgnC >= 0.80;

  if (!passedU || !passedC) {
    failedProbes++;
  }

  console.log(`Probe: [${p.category}]`);
  console.log(`  Query: "${p.q}" | GT: "${p.gt}"`);
  console.log(`  UNCACHED: Good = ${sGoodU.toFixed(4)}, Bad = ${sBadU.toFixed(4)}, Margin = ${mgnU >= 0 ? '+' : ''}${mgnU.toFixed(4)} [${passedU ? 'PASS ✓' : 'FAIL ✗'}]`);
  console.log(`  CACHED:   Good = ${sGoodC.toFixed(4)}, Bad = ${sBadC.toFixed(4)}, Margin = ${mgnC >= 0 ? '+' : ''}${mgnC.toFixed(4)} [${passedC ? 'PASS ✓' : 'FAIL ✗'}]\n`);
}

console.log('================================================================================');
console.log(`TOTAL REALISTIC PROBE FAILURES: ${failedProbes} / ${realisticFailureProbes.length}`);
console.log('================================================================================');
