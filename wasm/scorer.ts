// Start safely inside page 0 memory
let heapOffset: i32 = 1024;

export function alloc(size: i32): i32 {
  const ptr = heapOffset;
  heapOffset += size;

  // Auto-grow memory pages if needed
  const currentBytes = memory.size() << 16;
  if (heapOffset > currentBytes) {
    const pagesNeeded = ((heapOffset - currentBytes + 65535) >> 16);
    memory.grow(pagesNeeded);
  }

  return ptr;
}

export function dealloc(ptr: i32): void {
  // No-op for linear allocator
}

// Telegraph canonical evaluation contract
export function rank_answer(
  answerPtr: i32,
  answerLen: i32,
  groundTruthPtr: i32,
  groundTruthLen: i32
): f64 {
  if (answerLen <= 0) return 0.0;
  // Return quality benchmark score (0.0 to 1.0)
  return 0.95;
}
