#![no_std]
#![allow(clippy::missing_safety_doc)]

extern crate alloc;

use alloc::string::String;

mod allocator;
mod bm25;
mod embed;
mod math;
mod numeric;
mod tokenizer;

const EMBED_DIM: usize = 384;
static mut EMBED_BUF: [f32; EMBED_DIM] = [0f32; EMBED_DIM];

const BREAKDOWN_DIM: usize = 5;
static mut BREAKDOWN_BUF: [f32; BREAKDOWN_DIM] = [0f32; BREAKDOWN_DIM];

const IDX_RELEVANCE:    usize = 0;
const IDX_CORRECTNESS:  usize = 1;
const IDX_LEXICAL:      usize = 2;
const IDX_LENGTH:       usize = 3;
const IDX_COMPOSITE:    usize = 4;

const W_RELEVANCE:   f32 = 0.20;
const W_CORRECTNESS: f32 = 0.60;
const W_LEXICAL:     f32 = 0.15;
const W_LENGTH:      f32 = 0.05;

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

fn to_lower_str(s: &str) -> String {
    let mut out = String::new();
    for c in s.chars() {
        if c >= 'A' && c <= 'Z' {
            out.push(((c as u8) + 32) as char);
        } else {
            out.push(c);
        }
    }
    out
}

#[inline]
fn apply_high_separation_curve(raw: f32) -> f32 {
    let x = math::clamp01(raw);
    if x <= 0.03 {
        return 0.0;
    }
    if x >= 0.99 {
        return 1.0;
    }
    let x3 = x * x * x;
    let inv_x = 1.0 - x;
    let inv_x3 = inv_x * inv_x * inv_x;
    let den = x3 + inv_x3;
    if den <= 0.0 {
        0.0
    } else {
        math::clamp01(x3 / den)
    }
}

#[inline]
unsafe fn compute_signals(
    question: &str,
    ground_truth: &str,
    miner_answer: &str,
) -> (f32, f32, f32, f32) {
    let q_enc = tokenizer::tokenize(question);
    let gt_enc = tokenizer::tokenize(ground_truth);
    let ma_enc = tokenizer::tokenize(miner_answer);

    let q_vec = embed::run(&q_enc);
    let gt_vec = embed::run(&gt_enc);
    let ma_vec = embed::run(&ma_enc);

    signals_from_vecs(&q_vec, &gt_vec, question, ground_truth, miner_answer, &ma_vec)
}

#[inline]
unsafe fn signals_from_vecs(
    q_vec: &[f32],
    gt_vec: &[f32],
    question: &str,
    ground_truth: &str,
    miner_answer: &str,
    ma_vec: &[f32],
) -> (f32, f32, f32, f32) {
    let relevance = math::cosine(q_vec, ma_vec);
    let cosine_sim = math::cosine(gt_vec, ma_vec);
    let lexical = bm25::score(ground_truth, miner_answer);

    let num_mult = numeric::check_numeric_consistency(ground_truth, miner_answer);
    let entity_mult = numeric::check_entity_consistency(question, ground_truth, miner_answer);
    let polarity_mult = numeric::check_polarity_and_negation(ground_truth, miner_answer);

    let gt_nums = numeric::parse_numbers(ground_truth);
    let gt_has_nums = !gt_nums.is_empty();

    let gt_l = to_lower_str(ground_truth);
    let ma_l = to_lower_str(miner_answer);
    let is_exact = gt_l.trim() == ma_l.trim();
    let contains_gt = ma_l.contains(&gt_l) && !gt_l.is_empty();

    let is_boolean_match = if gt_l == "no" || gt_l == "false" {
        (ma_l.starts_with("no") || ma_l.contains("no ") || ma_l.contains("not ") || ma_l.contains("never")) && !ma_l.starts_with("yes")
    } else if gt_l == "yes" || gt_l == "true" {
        (ma_l.starts_with("yes") || ma_l.contains("yes ") || ma_l.contains("confirmed")) && !ma_l.contains("not") && !ma_l.contains("no")
    } else {
        false
    };

    let base_correctness = if is_exact {
        1.0
    } else if is_boolean_match || contains_gt || (gt_has_nums && num_mult >= 0.90) {
        cosine_sim.max(0.92)
    } else {
        cosine_sim * 0.05
    };

    let factual_multiplier = num_mult * entity_mult * polarity_mult;
    let correctness = base_correctness * factual_multiplier;
    let len_quality = math::sigmoid((miner_answer.len() as f32 - 25.0) / 20.0);

    (relevance * factual_multiplier, correctness, lexical * factual_multiplier, len_quality)
}

#[inline]
fn composite(relevance: f32, correctness: f32, lexical: f32, len_quality: f32) -> f32 {
    let base_quality = 0.65 + (0.20 * relevance) + (0.15 * lexical);
    let raw = correctness * base_quality * (0.95 + 0.05 * len_quality);

    apply_high_separation_curve(raw)
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

    if ground_truth.trim() == miner_answer.trim() {
        return 1.0;
    }

    let (relevance, correctness, lexical, len_quality) =
        compute_signals(question, ground_truth, miner_answer);
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

    if ground_truth.trim() == miner_answer.trim() {
        return 1.0;
    }

    let q_vec = read_f32s(q_vec_ptr, EMBED_DIM as i32);
    let gt_vec = read_f32s(gt_vec_ptr, EMBED_DIM as i32);

    let ma_enc = tokenizer::tokenize(miner_answer);
    let ma_vec = embed::run(&ma_enc);

    let (relevance, correctness, lexical, len_quality) =
        signals_from_vecs(q_vec, gt_vec, "", ground_truth, miner_answer, &ma_vec);

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

    BREAKDOWN_BUF[IDX_RELEVANCE]   = relevance;
    BREAKDOWN_BUF[IDX_CORRECTNESS] = correctness;
    BREAKDOWN_BUF[IDX_LEXICAL]     = lexical;
    BREAKDOWN_BUF[IDX_LENGTH]      = len_quality;
    BREAKDOWN_BUF[IDX_COMPOSITE]   = comp;

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
