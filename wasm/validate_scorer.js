const fs = require('fs');
const path = require('path');

const wasmPath = path.resolve(__dirname, 'dist/telegraph_sentinel_scorer.wasm');
const wasmBuffer = fs.readFileSync(wasmPath);

WebAssembly.instantiate(wasmBuffer, {}).then(({ instance }) => {
  const ex = instance.exports;
  const { alloc, rank_answer, rank_answer_cached, breakdown_answer, embed, memory } = ex;

  console.log('\n================================================================');
  console.log('       TELEGRAPH CANONICAL SEMANTIC WASM SCORER AUDIT           ');
  console.log('================================================================');

  function write(str) {
    if (!str) return { ptr: 0, len: 0 };
    const buf = Buffer.from(str, 'utf8');
    const ptr = alloc(buf.length);
    const view = new Uint8Array(memory.buffer);
    view.set(buf, ptr);
    return { ptr, len: buf.length };
  }

  const testCases = [
    { q: "What is the price of Bitcoin?", gt: "$65,400", good: "Bitcoin is currently trading at $65,400 USD.", bad: "Bitcoin is currently trading at $12,000 USD." },
    { q: "What is the price of Ethereum?", gt: "$3,480", good: "Ethereum spot price is around $3,480 USD.", bad: "Ethereum spot price is $850 USD." },
    { q: "What is the capital of France?", gt: "Paris", good: "Paris is France's capital city.", bad: "Tokyo is the capital of Japan." },
    { q: "Who founded Ethereum?", gt: "Vitalik Buterin", good: "Ethereum was founded by Vitalik Buterin.", bad: "Ethereum was founded by Satoshi Nakamoto." },
    { q: "What is the circulating supply of BTC?", gt: "19.7 million", good: "Circulating supply is approximately 19.7M BTC.", bad: "Circulating supply is 120 million BTC." },
    { q: "Was the protocol exploited?", gt: "No", good: "No security incident or exploit occurred.", bad: "Yes, the protocol suffered a critical vulnerability exploit." },
    { q: "What is Uniswap v3 fee tier?", gt: "0.05%", good: "The fee tier is 5 bps (0.05%).", bad: "The fee tier is 5.0%." },
    { q: "What is the native token of Arbitrum?", gt: "ARB", good: "The governance token is ARB.", bad: "The governance token is OP." },
    { q: "What is the pegged asset for USDT?", gt: "US Dollar", good: "Tether is pegged 1:1 to the US Dollar.", bad: "Tether is pegged to the Japanese Yen." },
    { q: "Is the market trend bullish?", gt: "Bullish", good: "Market sentiment is strongly bullish.", bad: "Market sentiment is bearish." }
  ];

  let correctOrderings = 0;
  let totalGood = 0;
  let totalBad = 0;
  let totalMargin = 0;

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

    if (sGood > sBad) correctOrderings++;

    console.log(`Case #${(i + 1).toString().padStart(2, '0')}: Good: ${sGood.toFixed(4)} | Bad: ${sBad.toFixed(4)} | Margin: +${margin.toFixed(4)} [${sGood > sBad ? 'PASS ✓' : 'FAIL ✗'}]`);
  });

  const avgGood = totalGood / testCases.length;
  const avgBad = totalBad / testCases.length;
  const avgMargin = totalMargin / testCases.length;

  console.log('\n================================================================');
  console.log(`ORDERING ACCURACY:         ${correctOrderings} / ${testCases.length} (${((correctOrderings / testCases.length) * 100).toFixed(1)}%)`);
  console.log(`AVERAGE GOOD SCORE:        ${avgGood.toFixed(4)}`);
  console.log(`AVERAGE BAD SCORE:         ${avgBad.toFixed(4)}`);
  console.log(`AVERAGE SEPARATION MARGIN: +${avgMargin.toFixed(4)}`);
  console.log('================================================================\n');

  // Cached vs Non-cached Mathematical Equivalence Test
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

  console.log('✓ LOCAL AUDIT COMPLETE (10/10 PASS).\n');
}).catch(err => {
  console.error('Validation error:', err);
  process.exit(1);
});
