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

function isWhitespace(c: u8): bool {
  return c == 32 || c == 9 || c == 10 || c == 13; // ' ', '\t', '\n', '\r'
}

function toLower(c: u8): u8 {
  if (c >= 65 && c <= 90) { // 'A' - 'Z'
    return c + 32;
  }
  return c;
}

export function rank_answer(
  questionPtr: i32,
  questionLen: i32,
  groundTruthPtr: i32,
  groundTruthLen: i32,
  candidatePtr: i32,
  candidateLen: i32
): f64 {
  if (candidateLen <= 0) return 0.0;

  // Trim whitespace from candidate
  let candStart: i32 = candidatePtr;
  let candEnd: i32 = candidatePtr + candidateLen;

  while (candStart < candEnd && isWhitespace(load<u8>(candStart))) {
    candStart++;
  }
  while (candEnd > candStart && isWhitespace(load<u8>(candEnd - 1))) {
    candEnd--;
  }

  const trimmedCandLen = candEnd - candStart;
  if (trimmedCandLen <= 0) {
    return 0.0; // Whitespace-only answers MUST return exactly 0.0
  }

  // Trim whitespace from ground truth
  let gtStart: i32 = groundTruthPtr;
  let gtEnd: i32 = groundTruthPtr + groundTruthLen;

  while (gtStart < gtEnd && isWhitespace(load<u8>(gtStart))) {
    gtStart++;
  }
  while (gtEnd > gtStart && isWhitespace(load<u8>(gtEnd - 1))) {
    gtEnd--;
  }

  const trimmedGtLen = gtEnd - gtStart;
  if (trimmedGtLen <= 0) {
    return 0.0;
  }

  // Check if candidate contains ground truth substring (e.g. "Paris" in "The capital is Paris")
  if (trimmedCandLen >= trimmedGtLen) {
    for (let i = 0; i <= trimmedCandLen - trimmedGtLen; i++) {
      let subMatch: bool = true;
      for (let j = 0; j < trimmedGtLen; j++) {
        if (toLower(load<u8>(candStart + i + j)) != toLower(load<u8>(gtStart + j))) {
          subMatch = false;
          break;
        }
      }
      if (subMatch) {
        return 1.0;
      }
    }
  }

  // Character overlap matching
  let matches: i32 = 0;
  const minLen = trimmedCandLen < trimmedGtLen ? trimmedCandLen : trimmedGtLen;

  for (let i = 0; i < minLen; i++) {
    if (toLower(load<u8>(candStart + i)) == toLower(load<u8>(gtStart + i))) {
      matches++;
    }
  }

  if (matches == 0) return 0.0;

  return f64(matches) / f64(trimmedGtLen);
}
