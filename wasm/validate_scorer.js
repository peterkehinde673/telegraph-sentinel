const fs = require('fs');
const path = require('path');

const wasmPath = path.resolve(__dirname, 'dist/telegraph_sentinel_scorer.wasm');
const wasmBuffer = fs.readFileSync(wasmPath);

// Verify WebAssembly magic header (\0asm)
if (wasmBuffer[0] !== 0x00 || wasmBuffer[1] !== 0x61 || wasmBuffer[2] !== 0x73 || wasmBuffer[3] !== 0x6d) {
  console.error('✗ Invalid WASM binary header');
  process.exit(1);
}

WebAssembly.instantiate(wasmBuffer, {}).then(({ instance }) => {
  const ex = instance.exports;
  const { alloc, rank_answer, rank_answer_cached, breakdown_answer, embed, memory } = ex;

  console.log('\n================================================================');
  console.log('    TELEGRAPH CANONICAL SEMANTIC WASM SCORER AUDIT & HOLDOUT    ');
  console.log('================================================================');

  function write(str) {
    if (!str) return { ptr: 0, len: 0 };
    const buf = Buffer.from(str, 'utf8');
    const ptr = alloc(buf.length);
    const view = new Uint8Array(memory.buffer);
    view.set(buf, ptr);
    return { ptr, len: buf.length };
  }

  const assets = [
    { name: "Bitcoin", sym: "BTC", price: "$65,400", badPrice: "$12,000", wrongSym: "LTC" },
    { name: "Ethereum", sym: "ETH", price: "$3,480", badPrice: "$850", wrongSym: "ETC" },
    { name: "Solana", sym: "SOL", price: "$145.50", badPrice: "$22.00", wrongSym: "ADA" },
    { name: "Avalanche", sym: "AVAX", price: "$28.40", badPrice: "$4.10", wrongSym: "DOT" },
    { name: "Chainlink", sym: "LINK", price: "$11.80", badPrice: "$1.50", wrongSym: "BAND" },
    { name: "Uniswap", sym: "UNI", price: "$7.25", badPrice: "$0.80", wrongSym: "SUSHI" },
    { name: "Maker", sym: "MKR", price: "$2,100", badPrice: "$350", wrongSym: "COMP" },
    { name: "Arbitrum", sym: "ARB", price: "$0.55", badPrice: "$8.50", wrongSym: "OP" },
    { name: "Cardano", sym: "ADA", price: "$0.38", badPrice: "$4.20", wrongSym: "SOL" },
    { name: "Optimism", sym: "OP", price: "$1.42", badPrice: "$18.50", wrongSym: "ARB" },
    { name: "Polygon", sym: "MATIC", price: "$0.45", badPrice: "$12.00", wrongSym: "ETH" },
    { name: "Dogecoin", sym: "DOGE", price: "$0.10", badPrice: "$2.50", wrongSym: "SHIB" }
  ];

  const testCases = [];
  assets.forEach(a => {
    testCases.push({ q: `What is the price of ${a.name}?`, gt: a.price, good: `${a.name} (${a.sym}) is trading at ${a.price}.`, bad: `${a.name} (${a.sym}) is trading at ${a.badPrice}.` });
    testCases.push({ q: `What is ${a.sym} spot price?`, gt: a.price, good: `${a.sym} spot is currently ${a.price} USD.`, bad: `${a.wrongSym} spot is currently ${a.price} USD.` });
    testCases.push({ q: `What is ${a.name} price in USD?`, gt: a.price, good: `${a.name} is trading around ${a.price} USD.`, bad: `${a.name} is not trading around ${a.price} USD.` });
    testCases.push({ q: `What is the ticker symbol for ${a.name}?`, gt: a.sym, good: `The ticker symbol for ${a.name} is ${a.sym}.`, bad: `The ticker symbol for ${a.name} is ${a.wrongSym}.` });
  });

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

    if (i < 10) {
      console.log(`Case #${(i + 1).toString().padStart(2, '0')}: Good: ${sGood.toFixed(4)} | Bad: ${sBad.toFixed(4)} | Margin: +${margin.toFixed(4)} [${sGood > sBad ? 'PASS ✓' : 'FAIL ✗'}]`);
    }
  });

  const avgGood = totalGood / testCases.length;
  const avgBad = totalBad / testCases.length;
  const avgMargin = totalMargin / testCases.length;

  console.log('================================================================');
  console.log(`TOTAL FIXTURES:            ${testCases.length}`);
  console.log(`ORDERING ACCURACY:         ${correctOrderings} / ${testCases.length} (${((correctOrderings / testCases.length) * 100).toFixed(1)}%)`);
  console.log(`AVERAGE GOOD SCORE:        ${avgGood.toFixed(4)}`);
  console.log(`AVERAGE BAD SCORE:         ${avgBad.toFixed(4)}`);
  console.log(`AVERAGE SEPARATION MARGIN: +${avgMargin.toFixed(4)}`);
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
  console.log(`✓ rank_answer (${baseS.toFixed(4)}) vs rank_answer_cached (${cachedS.toFixed(4)}) strictly equivalent.\n`);
}).catch(err => {
  console.error('Validation error:', err);
  process.exit(1);
});
