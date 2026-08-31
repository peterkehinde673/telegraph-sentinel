#![no_std]
#![allow(clippy::missing_safety_doc, static_mut_refs)]

extern crate alloc;

use alloc::string::String;
use libm::powf;

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

const MAX_NON_EXACT_SCORE: f32 = 0.9880;

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

fn is_normalized_identical(gt: &str, cand: &str) -> bool {
    let gt_t = gt.trim();
    let cand_t = cand.trim();
    if gt_t == cand_t {
        return true;
    }

    let gt_l = to_lower_str(gt_t);
    let cand_l = to_lower_str(cand_t);
    if gt_l == cand_l {
        return true;
    }

    let clean_gt: String = gt_l.chars().filter(|c| !c.is_whitespace() && *c != '.' && *c != ',' && *c != '$' && *c != '€' && *c != '£' && *c != '¥' && *c != '₦').collect();
    let clean_cand: String = cand_l.chars().filter(|c| !c.is_whitespace() && *c != '.' && *c != ',' && *c != '$' && *c != '€' && *c != '£' && *c != '¥' && *c != '₦').collect();

    !clean_gt.is_empty() && clean_gt == clean_cand
}

#[inline]
fn apply_high_separation_curve(raw: f32) -> f32 {
    let x = math::clamp01(raw);
    if x <= 0.02 {
        return 0.0;
    }
    let x_pow = powf(x, 2.5);
    let inv_pow = powf(1.0 - x, 2.5);
    let den = x_pow + inv_pow;
    if den <= 0.0 {
        0.0
    } else {
        let curved = math::clamp01(x_pow / den);
        curved * MAX_NON_EXACT_SCORE
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
    let semantic_sim = math::cosine(gt_vec, ma_vec);
    let lexical = bm25::score(ground_truth, miner_answer);

    let mut target_asset = if !question.is_empty() || !ground_truth.is_empty() {
        let combined = alloc::format!("{} {}", question, ground_truth);
        let lower = to_lower_str(&combined);
        if let Some(multi) = numeric::detect_multiword_asset(&lower) {
            Some(multi)
        } else {
            let mut found = None;
            for w in numeric::extract_words(ground_truth) {
                if let Some(cls) = numeric::get_canonical_asset_class(&w) {
                    found = Some(cls);
                    break;
                }
            }
            if found.is_none() {
                for w in numeric::extract_words(question) {
                    if let Some(cls) = numeric::get_canonical_asset_class(&w) {
                        found = Some(cls);
                        break;
                    }
                }
            }
            found
        }
    } else {
        None
    };

    if target_asset.is_none() {
        target_asset = numeric::detect_asset_from_q_vec(q_vec);
    }

    let num_mult = numeric::check_numeric_consistency_with_target(ground_truth, miner_answer, target_asset);
    let entity_mult = numeric::check_entity_consistency(question, ground_truth, miner_answer, q_vec);
    let currency_mult = numeric::check_currency_consistency(question, ground_truth, miner_answer, q_vec);
    let polarity_mult = numeric::check_polarity_and_negation(ground_truth, miner_answer);
    let stale_mult = numeric::check_stale_and_historical(question, ground_truth, miner_answer);
    let hedge_mult = numeric::check_hedging_and_uncertainty(miner_answer);

    let factual_score = num_mult * entity_mult * currency_mult * polarity_mult * stale_mult * hedge_mult;
    let len_quality = math::sigmoid((miner_answer.len() as f32 - 20.0) / 15.0);

    let base_correctness = if factual_score < 0.02 {
        0.0
    } else {
        let fluency_bonus = 0.90 + (0.07 * math::clamp01(relevance)) + (0.03 * math::clamp01(semantic_sim));
        math::clamp01(factual_score * fluency_bonus)
    };

    (relevance, base_correctness, lexical, len_quality)
}

#[inline]
fn composite(_relevance: f32, correctness: f32, _lexical: f32, _len_quality: f32, is_identical: bool) -> f32 {
    if is_identical {
        return 1.0;
    }

    if correctness <= 0.01 {
        return 0.0;
    }

    apply_high_separation_curve(correctness)
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

    let is_identical = is_normalized_identical(ground_truth, miner_answer);
    if is_identical {
        return 1.0;
    }

    let (relevance, correctness, lexical, len_quality) =
        compute_signals(question, ground_truth, miner_answer);
    composite(relevance, correctness, lexical, len_quality, false)
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

    let is_identical = is_normalized_identical(ground_truth, miner_answer);
    if is_identical {
        return 1.0;
    }

    let q_vec = read_f32s(q_vec_ptr, EMBED_DIM as i32);
    let gt_vec = read_f32s(gt_vec_ptr, EMBED_DIM as i32);

    let ma_enc = tokenizer::tokenize(miner_answer);
    let ma_vec = embed::run(&ma_enc);

    let (relevance, correctness, lexical, len_quality) =
        signals_from_vecs(q_vec, gt_vec, "", ground_truth, miner_answer, &ma_vec);

    composite(relevance, correctness, lexical, len_quality, false)
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

    let is_identical = is_normalized_identical(ground_truth, miner_answer);
    let (relevance, correctness, lexical, len_quality) =
        compute_signals(question, ground_truth, miner_answer);

    let comp = composite(relevance, correctness, lexical, len_quality, is_identical);

    BREAKDOWN_BUF[IDX_RELEVANCE]   = relevance;
    BREAKDOWN_BUF[IDX_CORRECTNESS] = if is_identical { 1.0 } else { correctness };
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
