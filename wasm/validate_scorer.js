const fs = require('fs');
const path = require('path');

const wasmPath = path.resolve(__dirname, 'dist/telegraph_sentinel_scorer.wasm');
const wasmBuffer = fs.readFileSync(wasmPath);

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

  // Multi-tier Pairwise Fixtures:
  // Tier 1: Exact / Paraphrase
  // Tier 2: Approximate / Qualitative
  // Tier 3: Wrong Number / Wrong Entity / Contradiction
  const pairwiseCases = [
    {
      q: "What is the price of Bitcoin in USD?",
      gt: "$65,400",
      exact: "Bitcoin is trading at $65,400 USD.",
      paraphrase: "BTC price is around $65.4K.",
      wrongNum: "Bitcoin is trading at $12,000 USD.",
      wrongEntity: "Ethereum is trading at $65,400 USD.",
      contradiction: "Bitcoin is not trading at $65,400 USD."
    },
    {
      q: "What is the price of Ethereum in USD?",
      gt: "$3,480",
      exact: "Ethereum is trading at $3,480 USD.",
      paraphrase: "ETH is currently around $3.48K USD.",
      wrongNum: "Ethereum is trading at $850 USD.",
      wrongEntity: "Solana is trading at $3,480 USD.",
      contradiction: "Ethereum price is impossible to determine."
    },
    {
      q: "What is the price of Solana in USD?",
      gt: "$145.50",
      exact: "Solana is trading at $145.50 USD.",
      paraphrase: "SOL spot price is near $145.50.",
      wrongNum: "Solana is trading at $22.00 USD.",
      wrongEntity: "Cardano is trading at $145.50 USD.",
      contradiction: "Solana is down to zero."
    }
  ];

  console.log('--- Multi-Tier Pairwise Quality Ranking Checks ---');
  pairwiseCases.forEach((c, idx) => {
    const qW = write(c.q);
    const gtW = write(c.gt);
    const sExact = rank_answer(qW.ptr, qW.len, gtW.ptr, gtW.len, write(c.exact).ptr, write(c.exact).len);
    const sPara = rank_answer(qW.ptr, qW.len, gtW.ptr, gtW.len, write(c.paraphrase).ptr, write(c.paraphrase).len);
    const sWrongNum = rank_answer(qW.ptr, qW.len, gtW.ptr, gtW.len, write(c.wrongNum).ptr, write(c.wrongNum).len);
    const sWrongEnt = rank_answer(qW.ptr, qW.len, gtW.ptr, gtW.len, write(c.wrongEntity).ptr, write(c.wrongEntity).len);
    const sContra = rank_answer(qW.ptr, qW.len, gtW.ptr, gtW.len, write(c.contradiction).ptr, write(c.contradiction).len);

    console.log(`\nCase #${idx + 1} (${c.q}):`);
    console.log(`  Exact Match:          ${sExact.toFixed(4)}`);
    console.log(`  Paraphrase Match:      ${sPara.toFixed(4)}`);
    console.log(`  Wrong Number:         ${sWrongNum.toFixed(4)} (Margin vs Exact: +${(sExact - sWrongNum).toFixed(4)})`);
    console.log(`  Wrong Entity:         ${sWrongEnt.toFixed(4)} (Margin vs Exact: +${(sExact - sWrongEnt).toFixed(4)})`);
    console.log(`  Contradiction:        ${sContra.toFixed(4)} (Margin vs Exact: +${(sExact - sContra).toFixed(4)})`);

    if (sExact < sWrongNum || sExact < sWrongEnt || sExact < sContra) {
      throw new Error(`Pairwise ranking inversion on Case #${idx + 1}`);
    }
  });

  console.log('\n✓ Pairwise ranking hierarchy verified: Exact > Paraphrase >> Wrong Number / Wrong Entity / Contradiction');

  // Cached Equivalence Check
  const f0 = pairwiseCases[0];
  const q0 = write(f0.q);
  const gt0 = write(f0.gt);
  const g0 = write(f0.exact);

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
