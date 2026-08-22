// ============================================================================
// Telegraph Protocol - Candidate Scorer WebAssembly Module
// Contract: alloc, dealloc, rank_answer, memory
// Zero Host Imports (Standalone)
// ============================================================================

// Memory bump allocator initialized safely inside page 0
let heapOffset: i32 = 1024;

export function alloc(size: i32): i32 {
  if (size <= 0) size = 1;
  // 8-byte alignment
  heapOffset = (heapOffset + 7) & ~7;
  const ptr = heapOffset;
  heapOffset += size;

  // Auto-grow linear memory if allocation exceeds current pages
  const currentBytes = memory.size() << 16;
  if (heapOffset > currentBytes) {
    const pagesNeeded = ((heapOffset - currentBytes + 65535) >> 16);
    memory.grow(pagesNeeded);
  }

  return ptr;
}

export function dealloc(ptr: i32): void {
  // Linear memory bump allocator does not require per-block freeing
}

function isAlphaNum(c: u8): bool {
  return (c >= 48 && c <= 57) || // 0-9
         (c >= 65 && c <= 90) || // A-Z
         (c >= 97 && c <= 122);  // a-z
}

function toLower(c: u8): u8 {
  if (c >= 65 && c <= 90) return c + 32;
  return c;
}

function bytesEqual(p1: i32, l1: i32, p2: i32, l2: i32): bool {
  if (l1 != l2) return false;
  for (let i = 0; i < l1; i++) {
    if (toLower(load<u8>(p1 + i)) != toLower(load<u8>(p2 + i))) return false;
  }
  return true;
}

// Canonical Telegraph 6-parameter scoring contract:
// rank_answer(prompt_ptr, prompt_len, strA_ptr, strA_len, strB_ptr, strB_len) -> f64
export function rank_answer(
  p1: i32, l1: i32, // Prompt / Question
  p2: i32, l2: i32, // String A (Candidate or Reference)
  p3: i32, l3: i32  // String B (Reference or Candidate)
): f64 {
  // Empty input check
  if (l2 <= 0 || l3 <= 0) return 0.0;

  // 1. Check for alphanumeric content
  let hasAlpha2 = false;
  for (let i = 0; i < l2; i++) {
    if (isAlphaNum(load<u8>(p2 + i))) {
      hasAlpha2 = true;
      break;
    }
  }
  if (!hasAlpha2) return 0.0; // Whitespace or punctuation only

  let hasAlpha3 = false;
  for (let i = 0; i < l3; i++) {
    if (isAlphaNum(load<u8>(p3 + i))) {
      hasAlpha3 = true;
      break;
    }
  }
  if (!hasAlpha3) return 0.0; // Whitespace or punctuation only

  // 2. Exact Case-Insensitive String Equality (Self-Match Guarantee -> 1.0)
  if (bytesEqual(p2, l2, p3, l3)) {
    return 1.0;
  }

  // 3. Symmetric Token-Level Jaccard & Containment Evaluation
  // Count tokens in String A
  let tokens2Count = 0;
  let inWord = false;
  for (let i = 0; i < l2; i++) {
    if (isAlphaNum(load<u8>(p2 + i))) {
      if (!inWord) {
        tokens2Count++;
        inWord = true;
      }
    } else {
      inWord = false;
    }
  }

  // Count tokens in String B
  let tokens3Count = 0;
  inWord = false;
  for (let i = 0; i < l3; i++) {
    if (isAlphaNum(load<u8>(p3 + i))) {
      if (!inWord) {
        tokens3Count++;
        inWord = true;
      }
    } else {
      inWord = false;
    }
  }

  if (tokens2Count == 0 || tokens3Count == 0) return 0.0;

  // Find matching tokens between String A and String B
  let matchedTokens = 0;
  let wordStart2 = -1;

  for (let i = 0; i <= l2; i++) {
    const isChar = (i < l2) && isAlphaNum(load<u8>(p2 + i));
    if (isChar) {
      if (wordStart2 < 0) wordStart2 = i;
    } else {
      if (wordStart2 >= 0) {
        const wLen2 = i - wordStart2;
        const wPtr2 = p2 + wordStart2;

        let wordStart3 = -1;
        let found = false;

        for (let j = 0; j <= l3; j++) {
          const isChar3 = (j < l3) && isAlphaNum(load<u8>(p3 + j));
          if (isChar3) {
            if (wordStart3 < 0) wordStart3 = j;
          } else {
            if (wordStart3 >= 0) {
              const wLen3 = j - wordStart3;
              const wPtr3 = p3 + wordStart3;

              if (bytesEqual(wPtr2, wLen2, wPtr3, wLen3)) {
                found = true;
                break;
              }
              wordStart3 = -1;
            }
          }
        }

        if (found) matchedTokens++;
        wordStart2 = -1;
      }
    }
  }

  if (matchedTokens == 0) return 0.0;

  // Compute symmetric overlap metrics
  const minTokens = tokens2Count < tokens3Count ? tokens2Count : tokens3Count;
  const maxTokens = tokens2Count > tokens3Count ? tokens2Count : tokens3Count;

  // Substring / Full keyphrase containment
  if (matchedTokens == minTokens && minTokens > 0) {
    if (minTokens == maxTokens) return 1.0;
    return 0.90 + (0.10 * (f64(minTokens) / f64(maxTokens)));
  }

  // Token Jaccard index
  const unionTokens = tokens2Count + tokens3Count - matchedTokens;
  const jaccard = f64(matchedTokens) / f64(unionTokens);

  if (jaccard >= 0.70) return 0.85 + (jaccard - 0.70) * 0.5;
  if (jaccard >= 0.40) return 0.60 + (jaccard - 0.40) * 0.8;
  return jaccard * 1.2;
}
