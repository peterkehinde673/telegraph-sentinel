const fs = require('fs');
const path = require('path');

const wasmPath = path.resolve(__dirname, 'dist/telegraph_sentinel_scorer.wasm');

if (!fs.existsSync(wasmPath)) {
  console.error('✗ Binary not found at:', wasmPath);
  process.exit(1);
}

const wasmBuffer = fs.readFileSync(wasmPath);

// Verify WebAssembly magic header (\0asm)
if (wasmBuffer[0] !== 0x00 || wasmBuffer[1] !== 0x61 || wasmBuffer[2] !== 0x73 || wasmBuffer[3] !== 0x6d) {
  console.error('✗ Invalid WASM binary header');
  process.exit(1);
}

// Instantiate with EMPTY imports object {} to guarantee zero host dependencies
WebAssembly.instantiate(wasmBuffer, {}).then(({ instance }) => {
  const exports = instance.exports;
  const { alloc, dealloc, rank_answer, memory } = exports;

  console.log('\n======================================================');
  console.log('       TELEGRAPH WASM CANDIDATE SCORER AUDIT          ');
  console.log('======================================================');

  // Check required exports
  if (!memory) throw new Error('Missing exported memory');
  if (typeof alloc !== 'function') throw new Error('Missing alloc function');
  if (typeof dealloc !== 'function') throw new Error('Missing dealloc function');
  if (typeof rank_answer !== 'function') throw new Error('Missing rank_answer function');

  console.log('✓ All 4 required exports present: memory, alloc, dealloc, rank_answer');

  const view = new Uint8Array(memory.buffer);

  function writeString(str) {
    if (str === null || str === undefined) return { ptr: 0, len: 0 };
    const buf = Buffer.from(str, 'utf8');
    if (buf.length === 0) return { ptr: 1024, len: 0 };
    const ptr = alloc(buf.length);
    view.set(buf, ptr);
    return { ptr, len: buf.length };
  }

  // Test Fixtures
  const prompt = writeString("What is the capital of France?");
  const gt = writeString("Paris");
  const candSelf = writeString("Paris");
  const candSentence = writeString("The capital of France is Paris.");
  const candSpaces = writeString("   \n\t  ");
  const candEmpty = writeString("");
  const candWrong = writeString("Tokyo");

  // Suite 1: Empty & Whitespace Safety
  const emptyScore = rank_answer(prompt.ptr, prompt.len, candEmpty.ptr, candEmpty.len, gt.ptr, gt.len);
  if (emptyScore !== 0.0) throw new Error(`Empty test failed: expected 0.0, got ${emptyScore}`);
  console.log('✓ Test 1 [Empty string]:         ', emptyScore, '(expected 0.0000)');

  const whitespaceScore = rank_answer(prompt.ptr, prompt.len, candSpaces.ptr, candSpaces.len, gt.ptr, gt.len);
  if (whitespaceScore !== 0.0) throw new Error(`Whitespace test failed: expected 0.0, got ${whitespaceScore}`);
  console.log('✓ Test 2 [Whitespace only]:      ', whitespaceScore, '(expected 0.0000)');

  // Suite 2: Self-Match (Must be >= 0.75 floor, ideally 1.0)
  const selfScore = rank_answer(prompt.ptr, prompt.len, candSelf.ptr, candSelf.len, gt.ptr, gt.len);
  if (selfScore < 0.75) throw new Error(`Self-match test failed: expected >= 0.75, got ${selfScore}`);
  console.log('✓ Test 3 [Self-Match (Paris)]:   ', selfScore, '(expected 1.0000, >= 0.75 floor)');

  // Suite 3: Near-match / Sentence containment
  const sentScore = rank_answer(prompt.ptr, prompt.len, candSentence.ptr, candSentence.len, gt.ptr, gt.len);
  if (sentScore < 0.75) throw new Error(`Sentence match failed: expected >= 0.75, got ${sentScore}`);
  console.log('✓ Test 4 [Phrase Containment]:   ', sentScore.toFixed(4), '(expected >= 0.7500)');

  // Suite 4: Mismatch / Wrong Answer
  const wrongScore = rank_answer(prompt.ptr, prompt.len, candWrong.ptr, candWrong.len, gt.ptr, gt.len);
  if (wrongScore > 0.3) throw new Error(`Wrong answer test failed: expected <= 0.3, got ${wrongScore}`);
  console.log('✓ Test 5 [Wrong Answer (Tokyo)]: ', wrongScore, '(expected 0.0000)');

  // Suite 5: Determinism Check (100 repetitions)
  for (let i = 0; i < 100; i++) {
    const s = rank_answer(prompt.ptr, prompt.len, candSentence.ptr, candSentence.len, gt.ptr, gt.len);
    if (s !== sentScore) throw new Error('Non-deterministic scorer behavior detected!');
  }
  console.log('✓ Test 6 [Determinism]:           100/100 repeated runs identical');

  console.log('======================================================\n');
  console.log('RESULT: ALL WASM COMPATIBILITY CHECKS PASSED (6/6)\n');
}).catch(err => {
  console.error('✗ Validation failed:', err.message);
  process.exit(1);
});
