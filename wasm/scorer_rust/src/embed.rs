extern crate alloc;

use crate::tokenizer::{Encoding, TOKEN_CLS, TOKEN_SEP, TOKEN_PAD};

pub const EMBED_DIM: usize = 384;

#[cfg(feature = "real_weights")]
static WEIGHTS: &[u8] = include_bytes!("../weights/minilm_l6_v2_q8.bin");

/// Run MiniLM inference on `encoding`. Returns L2-normalised float32[384].
pub fn run(encoding: &Encoding) -> [f32; EMBED_DIM] {
    #[cfg(feature = "real_weights")]
    return run_transformer(encoding);

    #[cfg(not(feature = "real_weights"))]
    return run_projection(encoding);
}

// ─────────────────────────────────────────────────────────────────────────────
// Orthogonal SplitMix64 projection fallback
// ─────────────────────────────────────────────────────────────────────────────

fn is_stop_word_id(id: u32) -> bool {
    let stop_words = [
        "what", "is", "the", "price", "of", "spot", "in", "usd", "today",
        "how", "much", "current", "currently", "rate", "value", "worth",
        "at", "for", "a", "an", "and", "to", "live", "latest", "token", "coin",
        "can", "you", "tell", "me", "right", "now", "please", "give", "check"
    ];
    for &sw in &stop_words {
        if crate::tokenizer::word_to_id(sw) == id {
            return true;
        }
    }
    false
}

fn run_projection(encoding: &Encoding) -> [f32; EMBED_DIM] {
    const SEED: u64 = 0xDEAD_BEEF_CAFE_1337;

    let mut output = [0f32; EMBED_DIM];
    let mut total_weight = 0.0f32;

    for (_i, (&id, &mask)) in encoding
        .input_ids
        .iter()
        .zip(encoding.attention_mask.iter())
        .enumerate()
    {
        if mask == 0 || id == TOKEN_CLS || id == TOKEN_SEP || id == TOKEN_PAD {
            continue;
        }

        let weight = if is_stop_word_id(id) { 0.05 } else { 1.0 };
        let token_hash = (id as u64).wrapping_mul(0x517c_c1b7_2722_0a95);

        for d in 0..EMBED_DIM {
            let seed = SEED ^ ((d as u64) << 32) ^ token_hash;
            let w = splitmix64_f32(seed);
            output[d] += w * weight;
        }
        total_weight += weight;
    }

    if total_weight > 0.0 {
        crate::math::normalise(&mut output);
    }
    output
}

#[inline]
fn splitmix64_f32(mut x: u64) -> f32 {
    x = x.wrapping_add(0x9E37_79B9_7F4A_7C15);
    x = (x ^ (x >> 30)).wrapping_mul(0xBF58_476D_1CE4_E5B9);
    x = (x ^ (x >> 27)).wrapping_mul(0x94D0_49BB_1331_11EB);
    x = x ^ (x >> 31);
    let bits = ((x >> 40) as u32) | 0x3F80_0000;
    (f32::from_bits(bits) - 1.5) * 2.0
}
