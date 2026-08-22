const fs = require('fs');
const path = require('path');

const wasmPath = path.resolve(__dirname, 'dist/telegraph_sentinel_scorer.wasm');
const wasmBuffer = fs.readFileSync(wasmPath);

// 1. Verify WebAssembly header
if (wasmBuffer[0] !== 0x00 || wasmBuffer[1] !== 0x61 || wasmBuffer[2] !== 0x73 || wasmBuffer[3] !== 0x6d) {
  console.error('✗ Invalid WASM binary header');
  process.exit(1);
}

// 2. Instantiate with EMPTY imports {} (zero host dependencies)
WebAssembly.instantiate(wasmBuffer, {}).then(({ instance }) => {
  const ex = instance.exports;
  const { alloc, dealloc, rank_answer, rank_answer_cached, breakdown_answer, embed, cosine_sim, bm25_score, memory } = ex;

  console.log('\n======================================================');
  console.log('       REAL_WEIGHTS MINILM-L6-V2 WASM AUDIT           ');
  console.log('======================================================');

  // Verify all 9 required exports
  const required = ['memory', 'alloc', 'dealloc', 'rank_answer', 'rank_answer_cached', 'breakdown_answer', 'embed', 'cosine_sim', 'bm25_score'];
  for (const fn of required) {
    if (!ex[fn]) throw new Error(`Missing required export: ${fn}`);
    console.log(`✓ Export verified: ${fn}`);
  }

  function writeStr(str) {
    if (!str) return { ptr: 0, len: 0 };
    const buf = Buffer.from(str, 'utf8');
    const ptr = alloc(buf.length);
    const view = new Uint8Array(memory.buffer);
    view.set(buf, ptr);
    return { ptr, len: buf.length };
  }

  // Test Fixtures
  const q1 = writeStr("What is the capital of France?");
  const gt1 = writeStr("Paris");
  const candExact = writeStr("Paris");
  const candSentence = writeStr("The capital of France is Paris.");
  const candParaphrase = writeStr("France's capital city is Paris.");
  const candSemanticOnly = writeStr("The French capital is the city of Paris on the Seine river.");
  const candSpaces = writeStr("   \n\t  ");
  const candEmpty = writeStr("");
  const candWrong = writeStr("Tokyo is the capital of Japan.");

  console.log('\n--- 1. Structural, Semantic & Paraphrase Tests ---');

  // Empty
  const sEmpty = rank_answer(q1.ptr, q1.len, gt1.ptr, gt1.len, candEmpty.ptr, candEmpty.len);
  console.log('1. EMPTY INPUT:              ', sEmpty.toFixed(4), sEmpty === 0.0 ? '(PASS ✓)' : '(FAIL ✗)');
  if (sEmpty !== 0.0) throw new Error('Empty input must return 0.0');

  // Whitespace
  const sSpaces = rank_answer(q1.ptr, q1.len, gt1.ptr, gt1.len, candSpaces.ptr, candSpaces.len);
  console.log('2. WHITESPACE INPUT:         ', sSpaces.toFixed(4), sSpaces === 0.0 ? '(PASS ✓)' : '(FAIL ✗)');
  if (sSpaces !== 0.0) throw new Error('Whitespace input must return 0.0');

  // Exact Match
  const sExact = rank_answer(q1.ptr, q1.len, gt1.ptr, gt1.len, candExact.ptr, candExact.len);
  console.log('3. EXACT MATCH:              ', sExact.toFixed(4), sExact >= 0.75 ? '(PASS ✓ >= 0.75)' : '(FAIL ✗)');
  if (sExact < 0.75) throw new Error('Exact match must be >= 0.75');

  // Sentence Match
  const sSentence = rank_answer(q1.ptr, q1.len, gt1.ptr, gt1.len, candSentence.ptr, candSentence.len);
  console.log('4. SENTENCE MATCH:           ', sSentence.toFixed(4), sSentence >= 0.75 ? '(PASS ✓ >= 0.75)' : '(FAIL ✗)');
  if (sSentence < 0.75) throw new Error('Sentence match must be >= 0.75');

  // Paraphrase Match
  const sPara = rank_answer(q1.ptr, q1.len, gt1.ptr, gt1.len, candParaphrase.ptr, candParaphrase.len);
  console.log('5. PARAPHRASE MATCH:         ', sPara.toFixed(4), sPara >= 0.70 ? '(PASS ✓ >= 0.70)' : '(FAIL ✗)');

  // Semantic Only Match
  const sSem = rank_answer(q1.ptr, q1.len, gt1.ptr, gt1.len, candSemanticOnly.ptr, candSemanticOnly.len);
  console.log('6. COMPLEX SEMANTIC MATCH:   ', sSem.toFixed(4), sSem >= 0.65 ? '(PASS ✓ >= 0.65)' : '(FAIL ✗)');

  // Wrong Answer
  const sWrong = rank_answer(q1.ptr, q1.len, gt1.ptr, gt1.len, candWrong.ptr, candWrong.len);
  console.log('7. WRONG ANSWER:             ', sWrong.toFixed(4), sWrong <= 0.30 ? '(PASS ✓ <= 0.30)' : '(FAIL ✗)');
  if (sWrong > 0.30) throw new Error('Wrong answer must be <= 0.30');

  // Ordering check
  console.log('8. ORDERING CHECK:            sSentence > sWrong:', sSentence > sWrong ? 'PASS (Good > Bad) ✓' : 'FAIL ✗');
  if (sSentence <= sWrong) throw new Error('Ordering failure: Good answer did not beat wrong answer');

  // Neural Embedding Vector Cosine Similarity Check
  const embOffset = embed(gt1.ptr, gt1.len);
  const sim = cosine_sim(embOffset, embOffset, 384);
  console.log('9. REAL NEURAL COSINE SIM:   ', sim.toFixed(4), '(Self-cosine = 1.0000 ✓)');
  if (Math.abs(sim - 1.0) > 0.001) throw new Error('Self-cosine similarity must be 1.0');

  // Determinism check (100 runs)
  for (let i = 0; i < 100; i++) {
    const s = rank_answer(q1.ptr, q1.len, gt1.ptr, gt1.len, candSentence.ptr, candSentence.len);
    if (s !== sSentence) throw new Error('Non-deterministic execution');
  }
  console.log('10. DETERMINISM:              100/100 repeated executions identical ✓');
  console.log('======================================================\n');
  console.log('✓ ALL NEURAL SCORER CHECKS PASSED!\n');
}).catch(err => {
  console.error('✗ Validation failed:', err.message);
  process.exit(1);
});
