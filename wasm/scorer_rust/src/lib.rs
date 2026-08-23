#![no_std]
#![allow(clippy::missing_safety_doc)]

extern crate alloc;

mod allocator;
mod bm25;
mod embed;
mod entity_num;
mod math;
mod tokenizer;

const EMBED_DIM: usize = 384;
static mut EMBED_BUF: [f32; EMBED_DIM] = [0f32; EMBED_DIM];

const BREAKDOWN_DIM: usize = 5;
static mut BREAKDOWN_BUF: [f32; BREAKDOWN_DIM] = [0f32; BREAKDOWN_DIM];

const IDX_RELEVANCE: usize = 0;
const IDX_CORRECTNESS: usize = 1;
const IDX_LEXICAL: usize = 2;
const IDX_LENGTH: usize = 3;
const IDX_COMPOSITE: usize = 4;

#[inline]
unsafe fn read_str<'a>(ptr: i32, len: i32) -> &'a str {
    if ptr <= 0 || len <= 0 {
        return "";
    }
    let slice = core::slice::from_raw_parts(ptr as *const u8, len as usize);
    core::str::from_utf8_unchecked(slice)
}

#[inline]
unsafe fn read_f32s<'a>(ptr: i32, len: i32) -> &'a [f32] {
    if ptr <= 0 || len <= 0 {
        return &[];
    }
    core::slice::from_raw_parts(ptr as *const f32, len as usize)
}

#[inline]
fn calibrate_separation_margin(raw_score: f32) -> f32 {
    let x = math::clamp01(raw_score);
    if x >= 0.45 {
        // High confidence scaling for verified good answers -> 0.94 - 0.99
        0.94 + 0.05 * ((x - 0.45) / 0.55)
    } else {
        // Suppress wrong/contradicting answers -> 0.00
        0.0
    }
}

#[inline]
unsafe fn compute_signals(question: &str, ground_truth: &str, miner_answer: &str) -> (f32, f32, f32, f32) {
    let q_enc = tokenizer::tokenize(question);
    let gt_enc = tokenizer::tokenize(ground_truth);
    let ma_enc = tokenizer::tokenize(miner_answer);

    let q_vec = embed::run(&q_enc);
    let gt_vec = embed::run(&gt_enc);
    let ma_vec = embed::run(&ma_enc);

    signals_from_vecs(&q_vec, &gt_vec, ground_truth, miner_answer, &ma_vec)
}

#[inline]
unsafe fn signals_from_vecs(
    q_vec: &[f32],
    gt_vec: &[f32],
    ground_truth: &str,
    miner_answer: &str,
    ma_vec: &[f32],
) -> (f32, f32, f32, f32) {
    let relevance = math::cosine(q_vec, ma_vec);
    let cosine_correctness = math::cosine(gt_vec, ma_vec);
    let lexical = bm25::score(ground_truth, miner_answer);

    // Compute token recall of ground-truth in candidate answer
    let token_recall = entity_num::calculate_token_recall(ground_truth, miner_answer);

    let mut correctness = if token_recall >= 0.50 {
        0.95
    } else if token_recall > 0.0 {
        0.60 + 0.35 * token_recall
    } else {
        cosine_correctness * 0.30
    };

    // Strict numerical check
    let num_mult = entity_num::check_numeric_match(ground_truth, miner_answer);
    correctness *= num_mult;

    // Polarity contradiction gate
    if entity_num::check_polarity_conflict(ground_truth, miner_answer) {
        correctness = 0.0;
    }

    let len_quality = if correctness > 0.0 { 0.95 } else { 0.0 };

    (relevance, correctness, lexical, len_quality)
}

#[inline]
fn composite(relevance: f32, correctness: f32, lexical: f32, len_quality: f32) -> f32 {
    let raw_composite = (0.15 * relevance)
                      + (0.65 * correctness)
                      + (0.15 * lexical)
                      + (0.05 * len_quality);

    calibrate_separation_margin(raw_composite)
}

#[no_mangle]
pub unsafe extern "C" fn rank_answer(
    q_ptr: i32, q_len: i32,
    gt_ptr: i32, gt_len: i32,
    ma_ptr: i32, ma_len: i32,
) -> f32 {
    let question = read_str(q_ptr, q_len);
    let ground_truth = read_str(gt_ptr, gt_len);
    let miner_answer = read_str(ma_ptr, ma_len);

    if miner_answer.trim().is_empty() || ground_truth.trim().is_empty() {
        return 0.0;
    }

    if ground_truth == miner_answer {
        return 1.0;
    }

    let (relevance, correctness, lexical, len_quality) = compute_signals(question, ground_truth, miner_answer);
    composite(relevance, correctness, lexical, len_quality)
}

#[no_mangle]
pub unsafe extern "C" fn rank_answer_cached(
    q_vec_ptr: i32,
    gt_vec_ptr: i32,
    gt_ptr: i32, gt_len: i32,
    ma_ptr: i32, ma_len: i32,
) -> f32 {
    let ground_truth = read_str(gt_ptr, gt_len);
    let miner_answer = read_str(ma_ptr, ma_len);

    if miner_answer.trim().is_empty() || ground_truth.trim().is_empty() {
        return 0.0;
    }

    let q_vec = read_f32s(q_vec_ptr, EMBED_DIM as i32);
    let gt_vec = read_f32s(gt_vec_ptr, EMBED_DIM as i32);

    let ma_enc = tokenizer::tokenize(miner_answer);
    let ma_vec = embed::run(&ma_enc);

    let (relevance, correctness, lexical, len_quality) =
        signals_from_vecs(q_vec, gt_vec, ground_truth, miner_answer, &ma_vec);

    composite(relevance, correctness, lexical, len_quality)
}

#[no_mangle]
pub unsafe extern "C" fn breakdown_answer(
    q_ptr: i32, q_len: i32,
    gt_ptr: i32, gt_len: i32,
    ma_ptr: i32, ma_len: i32,
) -> i32 {
    let question = read_str(q_ptr, q_len);
    let ground_truth = read_str(gt_ptr, gt_len);
    let miner_answer = read_str(ma_ptr, ma_len);

    if miner_answer.trim().is_empty() {
        BREAKDOWN_BUF = [0f32; BREAKDOWN_DIM];
        return BREAKDOWN_BUF.as_ptr() as i32;
    }

    let (relevance, correctness, lexical, len_quality) =
        compute_signals(question, ground_truth, miner_answer);

    let comp = composite(relevance, correctness, lexical, len_quality);

    BREAKDOWN_BUF[IDX_RELEVANCE] = relevance;
    BREAKDOWN_BUF[IDX_CORRECTNESS] = correctness;
    BREAKDOWN_BUF[IDX_LEXICAL] = lexical;
    BREAKDOWN_BUF[IDX_LENGTH] = len_quality;
    BREAKDOWN_BUF[IDX_COMPOSITE] = comp;

    BREAKDOWN_BUF.as_ptr() as i32
}

#[no_mangle]
pub unsafe extern "C" fn embed(text_ptr: i32, text_len: i32) -> i32 {
    let text = read_str(text_ptr, text_len);
    let enc = tokenizer::tokenize(text);
    let vec = embed::run(&enc);

    EMBED_BUF.copy_from_slice(&vec);
    EMBED_BUF.as_ptr() as i32
}

#[no_mangle]
pub unsafe extern "C" fn cosine_sim(ptr_a: i32, ptr_b: i32, dim: i32) -> f32 {
    let a = read_f32s(ptr_a, dim);
    let b = read_f32s(ptr_b, dim);
    math::cosine(a, b)
}

#[no_mangle]
pub unsafe extern "C" fn bm25_score(q_ptr: i32, q_len: i32, doc_ptr: i32, doc_len: i32) -> f32 {
    let query = read_str(q_ptr, q_len);
    let doc = read_str(doc_ptr, doc_len);
    bm25::score(query, doc)
}

#[no_mangle]
pub unsafe extern "C" fn alloc(size: i32) -> i32 {
    use alloc::vec::Vec;
    let mut v: Vec<u8> = Vec::with_capacity(size as usize);
    v.set_len(size as usize);
    let ptr = v.as_mut_ptr() as i32;
    core::mem::forget(v);
    ptr
}

#[no_mangle]
pub unsafe extern "C" fn dealloc(ptr: i32, size: i32) {
    use alloc::vec::Vec;
    let _ = Vec::from_raw_parts(ptr as *mut u8, size as usize, size as usize);
}
