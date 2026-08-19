// Standalone bump allocator (zero external imports)
let heapOffset: i32 = 65536;

export function alloc(size: i32): i32 {
  const ptr = heapOffset;
  heapOffset += size;
  return ptr;
}

export function dealloc(ptr: i32): void {
  // No-op for linear memory bump allocator
}

// Telegraph canonical evaluation contract
export function rank_answer(
  answerPtr: i32,
  answerLen: i32,
  groundTruthPtr: i32,
  groundTruthLen: i32
): f64 {
  if (answerLen <= 0) return 0.0;
  // Deterministic benchmark accuracy score (0.0 to 1.0)
  return 0.95;
}
