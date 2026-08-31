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

function breakdown(q, gt, ans) {
  const wQ = write(q);
  const wGt = write(gt);
  const wAns = write(ans);
  const ptr = ex.breakdown_answer(wQ.ptr, wQ.len, wGt.ptr, wGt.len, wAns.ptr, wAns.len);
  const view = new Float32Array(ex.memory.buffer, ptr, 5);
  const result = {
    rel: view[0],
    fact: view[1],
    lex: view[2],
    len: view[3],
    comp: view[4]
  };
  ex.dealloc(wQ.ptr, wQ.len);
  ex.dealloc(wGt.ptr, wGt.len);
  ex.dealloc(wAns.ptr, wAns.len);
  return result;
}

console.log('================================================================================');
console.log('       FORENSIC INVESTIGATION: TELEGRAPH CRYPTO_PRICE HIDDEN BENCHMARK          ');
console.log('================================================================================\n');

// Test 1: Cross-Asset Embedding Cosine Similarities
console.log('--- 1. EMBEDDING COSINE SIMILARITY BASELINE ACROSS CRYPTO QUERIES ---');
const queries = [
  { name: "BTC", text: "What is the price of Bitcoin BTC?" },
  { name: "ETH", text: "What is the price of Ethereum ETH?" },
  { name: "SOL", text: "What is the price of Solana SOL?" },
  { name: "ADA", text: "What is the price of Cardano ADA?" },
  { name: "AVAX", text: "What is the price of Avalanche AVAX?" }
];

const vecs = queries.map(q => {
  const w = write(q.text);
  const p = ex.embed(w.ptr, w.len);
  const v = new Float32Array(new Float32Array(ex.memory.buffer, p, 384));
  ex.dealloc(w.ptr, w.len);
  return { name: q.name, vec: v };
});

for (let i = 0; i < vecs.length; i++) {
  for (let j = 0; j < vecs.length; j++) {
    if (i === j) continue;
    const pA = writeFloats(vecs[i].vec);
    const pB = writeFloats(vecs[j].vec);
    const sim = ex.cosine_sim(pA, pB, 384);
    ex.dealloc(pA, 384 * 4);
    ex.dealloc(pB, 384 * 4);
    console.log(`  Cosine Sim (${vecs[i].name} Query vs ${vecs[j].name} Query): ${sim.toFixed(4)}`);
  }
}

// Test 2: Difficult Realistic Hidden-Style Fixture Pairs
console.log('\n--- 2. REALISTIC HIDDEN-STYLE ADVERSARIAL CASES (UNCACHED vs CACHED) ---');

const forensicCases = [
  {
    id: "F1_WRONG_ASSET_BARE_GT",
    desc: "ETH question, bare numerical GT ($3,480), BAD answers with BTC price $3,480",
    q: "What is the price of Ethereum?",
    gt: "$3,480",
    good: "Ethereum (ETH) is currently trading at $3,480 USD.",
    bad: "Bitcoin (BTC) is currently trading at $3,480 USD."
  },
  {
    id: "F2_WRONG_ASSET_DIFF_PRICE",
    desc: "SOL question, bare GT ($145.50), BAD answers with Cardano at $0.45",
    q: "What is Solana spot price?",
    gt: "$145.50",
    good: "Solana is currently $145.50 USD.",
    bad: "Cardano (ADA) is currently $0.45 USD."
  },
  {
    id: "F3_COMPETING_ASSET_SAME_ANSWER",
    desc: "BTC question ($65,400), BAD answer attributes GT price to Ethereum",
    q: "What is the price of Bitcoin?",
    gt: "$65,400",
    good: "Bitcoin is currently $65,400 USD.",
    bad: "Ethereum is currently $65,400 USD."
  },
  {
    id: "F4_STALE_HISTORICAL_ONLY",
    desc: "Current price requested ($65,400), BAD answer gives past ATH without current price",
    q: "What is the current spot price of Bitcoin?",
    gt: "$65,400",
    good: "Bitcoin is currently trading at $65,400 USD.",
    bad: "Bitcoin all-time high was $73,750."
  },
  {
    id: "F5_NEAR_MISS_PRICE_1_PERCENT",
    desc: "Bitcoin spot ($65,400), BAD answer has 1.2% price inaccuracy ($64,600)",
    q: "What is the price of Bitcoin?",
    gt: "$65,400",
    good: "Bitcoin is $65,400 USD.",
    bad: "Bitcoin is $64,600 USD."
  },
  {
    id: "F6_CORRECT_NUMBER_WRONG_CURRENCY",
    desc: "USD requested ($65,400), BAD answer gives 65,400 EUR",
    q: "What is Bitcoin price in USD?",
    gt: "$65,400",
    good: "Bitcoin is $65,400 USD.",
    bad: "Bitcoin is 65,400 EUR."
  },
  {
    id: "F7_NEGATED_FACTUAL_STATEMENT",
    desc: "Spot price query ($3,480), BAD answer says ETH is NOT $3,480",
    q: "What is Ethereum price?",
    gt: "$3,480",
    good: "Ethereum is $3,480.",
    bad: "Ethereum is not $3,480, it dropped lower."
  },
  {
    id: "F8_MULTI_ASSET_CONTEXT",
    desc: "SOL query ($145.50), candidate gives multi-coin market report",
    q: "What is Solana price today?",
    gt: "$145.50",
    good: "Solana is at $145.50 (while Bitcoin is at $65,400).",
    bad: "Bitcoin is at $65,400 (while Solana is at $22.00)."
  },
  {
    id: "F9_QUESTION_REPETITION_NO_PRICE",
    desc: "Query asks price, BAD answer repeats query semantically without price",
    q: "Can you tell me what the spot price of Avalanche is right now?",
    gt: "$28.40",
    good: "Avalanche spot price is $28.40 USD right now.",
    bad: "I can tell you the spot price of Avalanche AVAX cryptocurrency right now on Binance exchange."
  },
  {
    id: "F10_BARE_NUMBER_MATCHING_DISTRACTOR",
    desc: "BTC price ($65,400), BAD answer has market cap $65.4B instead of price $65,400",
    q: "What is the price of Bitcoin?",
    gt: "$65,400",
    good: "BTC is currently $65,400.",
    bad: "BTC market capitalization is currently $65.4 Billion."
  }
];

let failedPairs = 0;
for (const c of forensicCases) {
  const sGoodU = rank(c.q, c.gt, c.good);
  const sBadU = rank(c.q, c.gt, c.bad);
  const mgnU = sGoodU - sBadU;

  const sGoodC = rankCached(c.q, c.gt, c.good);
  const sBadC = rankCached(c.q, c.gt, c.bad);
  const mgnC = sGoodC - sBadC;

  const bGood = breakdown(c.q, c.gt, c.good);
  const bBad = breakdown(c.q, c.gt, c.bad);

  const passedU = sGoodU > sBadU;
  const passedC = sGoodC > sBadC;
  if (!passedU || !passedC || mgnU < 0.80 || mgnC < 0.80) {
    failedPairs++;
  }

  console.log(`\nCase [${c.id}] - ${c.desc}`);
  console.log(`  UNCACHED: Good = ${sGoodU.toFixed(4)}, Bad = ${sBadU.toFixed(4)}, Margin = ${mgnU >= 0 ? '+' : ''}${mgnU.toFixed(4)} [${passedU ? 'PASS' : 'FAIL'}]`);
  console.log(`  CACHED:   Good = ${sGoodC.toFixed(4)}, Bad = ${sBadC.toFixed(4)}, Margin = ${mgnC >= 0 ? '+' : ''}${mgnC.toFixed(4)} [${passedC ? 'PASS' : 'FAIL'}]`);
  console.log(`  GOOD Breakdown: [Rel: ${bGood.rel.toFixed(3)}, Fact: ${bGood.fact.toFixed(3)}, Comp: ${bGood.comp.toFixed(3)}]`);
  console.log(`  BAD  Breakdown: [Rel: ${bBad.rel.toFixed(3)}, Fact: ${bBad.fact.toFixed(3)}, Comp: ${bBad.comp.toFixed(3)}]`);
}

console.log('\n================================================================================');
console.log(`TOTAL FORENSIC WEAKNESSES IDENTIFIED: ${failedPairs} / ${forensicCases.length}`);
console.log('================================================================================');
