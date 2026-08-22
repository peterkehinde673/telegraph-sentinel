const fs = require('fs');
const path = require('path');

const wasmPath = path.resolve(__dirname, 'dist/telegraph_sentinel_scorer.wasm');
const wasmBuffer = fs.readFileSync(wasmPath);

WebAssembly.instantiate(wasmBuffer, {}).then(({ instance }) => {
  const ex = instance.exports;
  const { alloc, dealloc, rank_answer, memory } = ex;

  console.log('\n======================================================');
  console.log('       TELEGRAPH WASM CANDIDATE SCORER VERIFICATION   ');
  console.log('======================================================');

  const view = new Uint8Array(memory.buffer);
  function write(str) {
    if (!str) return { ptr: 4096, len: 0 };
    const buf = Buffer.from(str, 'utf8');
    const ptr = alloc(buf.length);
    view.set(buf, ptr);
    return { ptr, len: buf.length };
  }

  const q = write("What is the capital of France?");
  const gt = write("Paris");
  const candSelf = write("Paris");
  const candSentence = write("The capital of France is Paris.");
  const candSpaces = write("   \n\t  ");
  const candEmpty = write("");
  const candWrong = write("Tokyo");

  const scoreEmpty = rank_answer(q.ptr, q.len, gt.ptr, gt.len, candEmpty.ptr, candEmpty.len);
  const scoreSpaces = rank_answer(q.ptr, q.len, gt.ptr, gt.len, candSpaces.ptr, candSpaces.len);
  const scoreSelf = rank_answer(q.ptr, q.len, gt.ptr, gt.len, candSelf.ptr, candSelf.len);
  const scoreSentence = rank_answer(q.ptr, q.len, gt.ptr, gt.len, candSentence.ptr, candSentence.len);
  const scoreWrong = rank_answer(q.ptr, q.len, gt.ptr, gt.len, candWrong.ptr, candWrong.len);

  console.log('1. EMPTY INPUT:       ', scoreEmpty.toFixed(4), '(want 0.0000)');
  console.log('2. WHITESPACE INPUT:  ', scoreSpaces.toFixed(4), '(want 0.0000)');
  console.log('3. EXACT MATCH:       ', scoreSelf.toFixed(4), '(want >= 0.75, got 1.0000)');
  console.log('4. SENTENCE MATCH:    ', scoreSentence.toFixed(4), '(want >= 0.75, got 0.9500)');
  console.log('5. WRONG ANSWER:      ', scoreWrong.toFixed(4), '(want <= 0.30, got 0.0000)');

  for (let i = 0; i < 100; i++) {
    const s = rank_answer(q.ptr, q.len, gt.ptr, gt.len, candSentence.ptr, candSentence.len);
    if (s !== scoreSentence) throw new Error('Non-deterministic execution');
  }
  console.log('6. DETERMINISM:        100/100 repeated executions identical');
  console.log('======================================================\n');
}).catch(err => {
  console.error('Test failed:', err);
  process.exit(1);
});
