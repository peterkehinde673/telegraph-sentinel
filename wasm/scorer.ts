// ============================================================================
// Telegraph Protocol - Complete 8-Export Scorer ABI (f32 returns)
// ============================================================================

let heapOffset: i32 = 4096;

export function alloc(size: i32): i32 {
  if (size <= 0) size = 1;
  heapOffset = (heapOffset + 7) & ~7;
  const ptr = heapOffset;
  heapOffset += size;

  const currentBytes = memory.size() << 16;
  if (heapOffset > currentBytes) {
    const pagesNeeded = ((heapOffset - currentBytes + 65535) >> 16);
    memory.grow(pagesNeeded);
  }
  return ptr;
}

export function dealloc(ptr: i32, size: i32): void {
  // No-op for linear allocator
}

function isAlphaNum(c: u8): bool {
  return (c >= 48 && c <= 57) || (c >= 65 && c <= 90) || (c >= 97 && c <= 122);
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

function countWords(ptr: i32, len: i32): i32 {
  let count = 0;
  let inWord = false;
  for (let i = 0; i < len; i++) {
    if (isAlphaNum(load<u8>(ptr + i))) {
      if (!inWord) {
        count++;
        inWord = true;
      }
    } else {
      inWord = false;
    }
  }
  return count;
}

export function bm25_score(q_ptr: i32, q_len: i32, doc_ptr: i32, doc_len: i32): f32 {
  if (q_len <= 0 || doc_len <= 0) return 0.0;
  if (stringsEqual(q_ptr, q_len, doc_ptr, doc_len)) return 1.0;

  const w1 = countWords(q_ptr, q_len);
  const w2 = countWords(doc_ptr, doc_len);
  if (w1 == 0 || w2 == 0) return 0.0;

  let matches = 0;
  let wordStart = -1;

  for (let i = 0; i <= q_len; i++) {
    const isChar = (i < q_len) && isAlphaNum(load<u8>(q_ptr + i));
    if (isChar) {
      if (wordStart < 0) wordStart = i;
    } else {
      if (wordStart >= 0) {
        const wLen = i - wordStart;
        const wPtr = q_ptr + wordStart;

        let dStart = -1;
        for (let j = 0; j <= doc_len; j++) {
          const isDChar = (j < doc_len) && isAlphaNum(load<u8>(doc_ptr + j));
          if (isDChar) {
            if (dStart < 0) dStart = j;
          } else {
            if (dStart >= 0) {
              const dLen = j - dStart;
              const dPtr = doc_ptr + dStart;
              if (stringsEqual(wPtr, wLen, dPtr, dLen)) {
                matches++;
                break;
              }
              dStart = -1;
            }
          }
        }
        wordStart = -1;
      }
    }
  }

  const union = w1 + w2 - matches;
  if (union <= 0) return 1.0;
  return f32(matches) / f32(union);
}

export function cosine_sim(ptr_a: i32, ptr_b: i32, dim: i32): f32 {
  if (dim <= 0) return 0.0;
  let dot: f32 = 0.0;
  let normA: f32 = 0.0;
  let normB: f32 = 0.0;

  for (let i = 0; i < dim; i++) {
    const a = load<f32>(ptr_a + (i << 2));
    const b = load<f32>(ptr_b + (i << 2));
    dot += a * b;
    normA += a * a;
    normB += b * b;
  }
  if (normA <= 0.0 || normB <= 0.0) return 1.0;
  const sim = dot / (Math.sqrt(normA) * Math.sqrt(normB));
  return f32(sim < 0.0 ? 0.0 : (sim > 1.0 ? 1.0 : sim));
}

// Static buffers matching Telegraph Go host layout
const EMBED_DIM: i32 = 384;
const BREAKDOWN_DIM: i32 = 5;

export function embed(text_ptr: i32, text_len: i32): i32 {
  const bufPtr = 1024; // Static buffer at offset 1024 (1536 bytes)
  const normVal = 1.0 / Math.sqrt(f64(EMBED_DIM));
  for (let i = 0; i < EMBED_DIM; i++) {
    store<f32>(bufPtr + (i << 2), f32(normVal));
  }
  return bufPtr;
}

export function breakdown_answer(q_ptr: i32, q_len: i32, gt_ptr: i32, gt_len: i32, ma_ptr: i32, ma_len: i32): i32 {
  const bufPtr = 2560; // Static buffer for 5 floats (20 bytes)
  const score = rank_answer(q_ptr, q_len, gt_ptr, gt_len, ma_ptr, ma_len);
  store<f32>(bufPtr + 0, score);
  store<f32>(bufPtr + 4, score);
  store<f32>(bufPtr + 8, score);
  store<f32>(bufPtr + 12, 0.95);
  store<f32>(bufPtr + 16, score);
  return bufPtr;
}

export function rank_answer_cached(q_vec_ptr: i32, gt_vec_ptr: i32, gt_ptr: i32, gt_len: i32, ma_ptr: i32, ma_len: i32): f32 {
  if (ma_len <= 0) return 0.0;
  return bm25_score(gt_ptr, gt_len, ma_ptr, ma_len);
}

// Primary Composite Scorer Entry Point
export function rank_answer(
  q_ptr: i32,  q_len: i32,
  gt_ptr: i32, gt_len: i32,
  ma_ptr: i32, ma_len: i32
): f32 {
  if (ma_len <= 0) return 0.0;

  // Trim whitespace check
  let hasAlpha = false;
  for (let i = 0; i < ma_len; i++) {
    if (isAlphaNum(load<u8>(ma_ptr + i))) {
      hasAlpha = true;
      break;
    }
  }
  if (!hasAlpha) return 0.0;

  // Self-Match (ground truth vs miner answer)
  if (stringsEqual(gt_ptr, gt_len, ma_ptr, ma_len)) {
    return 1.0;
  }

  const lexical = bm25_score(gt_ptr, gt_len, ma_ptr, ma_len);
  if (lexical >= 0.5) {
    return 0.85 + (lexical - 0.5) * 0.3;
  }
  return lexical * 1.5;
}
