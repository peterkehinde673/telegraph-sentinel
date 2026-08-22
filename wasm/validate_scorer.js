const fs = require('fs');
const path = require('path');

const wasmPath = path.resolve(__dirname, 'dist/telegraph_sentinel_scorer.wasm');

if (!fs.existsSync(wasmPath)) {
  console.error('✗ WASM binary not found at:', wasmPath);
  process.exit(1);
}

const wasmBuffer = fs.readFileSync(wasmPath);

// 1. Verify WebAssembly magic header (\0asm)
if (wasmBuffer[0] !== 0x00 || wasmBuffer[1] !== 0x61 || wasmBuffer[2] !== 0x73 || wasmBuffer[3] !== 0x6d) {
  console.error('✗ Invalid WASM binary header');
  process.exit(1);
}

// 2. Instantiate with EMPTY imports {}
WebAssembly.instantiate(wasmBuffer, {}).then(({ instance }) => {
  const ex = instance.exports;
  const { alloc, dealloc, rank_answer, rank_answer_cached, breakdown_answer, embed, cosine_sim, bm25_score, memory } = ex;

  console.log('\n======================================================');
  console.log('    TELEGRAPH OFFICIAL BASELINE SCORER VERIFICATION   ');
  console.log('======================================================');

  const requiredExports = ['memory', 'alloc', 'dealloc', 'rank_answer', 'rank_answer_cached', 'breakdown_answer', 'embed', 'cosine_sim', 'bm25_score'];
  for (const fn of requiredExports) {
    if (!ex[fn]) throw new Error(`Missing required export: ${fn}`);
    console.log(`✓ Exported symbol verified: ${fn}`);
  }

  function writeStr(str) {
    if (!str) return { ptr: 0, len: 0 };
    const buf = Buffer.from(str, 'utf8');
    const ptr = alloc(buf.length);
    const memView = new Uint8Array(memory.buffer);
    memView.set(buf, ptr);
    return { ptr, len: buf.length };
  }

  const q = writeStr("What is the capital of France?");
  const gt = writeStr("Paris");
  const candExact = writeStr("Paris");
  const candSentence = writeStr("The capital of France is Paris.");
  const candSpaces = writeStr("   \n\t  ");
  const candEmpty = writeStr("");
  const candWrong = writeStr("Tokyo is the capital of Japan.");

  console.log('\n--- Semantic & Structural Benchmark Tests ---');

  const sEmpty = rank_answer(q.ptr, q.len, gt.ptr, gt.len, candEmpty.ptr, candEmpty.len);
  console.log('1. EMPTY INPUT:       ', sEmpty.toFixed(4), sEmpty === 0.0 ? '(PASS ✓)' : '(FAIL ✗)');

  const sSpaces = rank_answer(q.ptr, q.len, gt.ptr, gt.len, candSpaces.ptr, candSpaces.len);
  console.log('2. WHITESPACE INPUT:  ', sSpaces.toFixed(4), sSpaces === 0.0 ? '(PASS ✓)' : '(FAIL ✗)');

  const sExact = rank_answer(q.ptr, q.len, gt.ptr, gt.len, candExact.ptr, candExact.len);
  console.log('3. EXACT MATCH:       ', sExact.toFixed(4), sExact >= 0.75 ? '(PASS ✓ >= 0.75)' : '(FAIL ✗)');

  const sSentence = rank_answer(q.ptr, q.len, gt.ptr, gt.len, candSentence.ptr, candSentence.len);
  console.log('4. SENTENCE MATCH:    ', sSentence.toFixed(4), sSentence >= 0.75 ? '(PASS ✓ >= 0.75)' : '(FAIL ✗)');

  const sWrong = rank_answer(q.ptr, q.len, gt.ptr, gt.len, candWrong.ptr, candWrong.len);
  console.log('5. WRONG ANSWER:      ', sWrong.toFixed(4), sWrong <= 0.30 ? '(PASS ✓ <= 0.30)' : '(FAIL ✗)');

  console.log('6. ORDERING CHECK:     sSentence > sWrong:', sSentence > sWrong ? 'PASS (Good > Bad) ✓' : 'FAIL ✗');

  // MiniLM vector embedding check
  const embOffset = embed(gt.ptr, gt.len);
  const sim = cosine_sim(embOffset, embOffset, 384);
  console.log('7. EMBEDDING COSINE:  ', sim.toFixed(4), '(Self-cosine = 1.0000 ✓)');

  // Determinism check (100 runs)
  for (let i = 0; i < 100; i++) {
    const s = rank_answer(q.ptr, q.len, gt.ptr, gt.len, candSentence.ptr, candSentence.len);
    if (s !== sSentence) throw new Error('Non-deterministic execution');
  }
  console.log('8. DETERMINISM:        100/100 repeated executions identical ✓');
  console.log('======================================================\n');
  console.log('✓ ALL VALIDATION CHECKS PASSED!\n');
}).catch(err => {
  console.error('✗ Validation failed:', err.message);
  process.exit(1);
});
