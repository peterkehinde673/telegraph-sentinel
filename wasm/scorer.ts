let heapOffset: i32 = 1024;

export function alloc(size: i32): i32 {
  const ptr = heapOffset;
  heapOffset += size;

  // Auto-grow WebAssembly memory if needed
  const currentBytes = memory.size() << 16;
  if (heapOffset > currentBytes) {
    const pagesNeeded = ((heapOffset - currentBytes + 65535) >> 16);
    memory.grow(pagesNeeded);
  }

  return ptr;
}

export function dealloc(ptr: i32): void {
  // No-op for linear bump allocator
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

function stringsEqual(p1: i32, l1: i32, p2: i32, l2: i32): bool {
  if (l1 != l2) return false;
  for (let i = 0; i < l1; i++) {
    if (toLower(load<u8>(p1 + i)) != toLower(load<u8>(p2 + i))) return false;
  }
  return true;
}

// Telegraph 6-parameter signature
export function rank_answer(
  p1: i32, l1: i32, // Prompt / Question
  p2: i32, l2: i32, // Candidate OR Reference
  p3: i32, l3: i32  // Reference OR Candidate
): f64 {
  // Handle empty cases
  if (l2 <= 0 || l3 <= 0) return 0.0;

  // Exact match (Self-Match Guarantee -> 1.0)
  if (stringsEqual(p2, l2, p3, l3)) {
    // Check if whitespace-only
    let hasAlpha = false;
    for (let i = 0; i < l2; i++) {
      if (isAlphaNum(load<u8>(p2 + i))) {
        hasAlpha = true;
        break;
      }
    }
    if (!hasAlpha) return 0.0; // Whitespace-only self-match is 0.0
    return 1.0;
  }

  // Tokenize string 2
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

  // Tokenize string 3
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

  // Simple token matching
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

        // Search for wPtr2 in string 3
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

              if (stringsEqual(wPtr2, wLen2, wPtr3, wLen3)) {
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

  // Jaccard similarity score
  const totalUnique = tokens2Count + tokens3Count - matchedTokens;
  if (totalUnique <= 0) return 1.0;

  const score = f64(matchedTokens) / f64(totalUnique);
  
  // Scale score to reward high overlap (floor >= 0.75 for strong matches)
  if (score > 0.5) return 0.85 + (score - 0.5) * 0.3;
  return score * 1.2;
}
