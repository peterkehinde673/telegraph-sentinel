use alloc::vec::Vec;
use alloc::string::String;

fn is_digit(c: char) -> bool {
    c >= '0' && c <= '9'
}

fn is_alpha(c: char) -> bool {
    (c >= 'a' && c <= 'z') || (c >= 'A' && c <= 'Z')
}

fn to_lower(c: char) -> char {
    if c >= 'A' && c <= 'Z' {
        ((c as u8) + 32) as char
    } else {
        c
    }
}

pub fn is_stopword(w: &str) -> bool {
    matches!(
        w,
        "the" | "a" | "an" | "of" | "in" | "on" | "at" | "to" | "for" | "with" | "by" | "is"
            | "are" | "was" | "were" | "it" | "and" | "or" | "as" | "what" | "who" | "did"
            | "which" | "does" | "about" | "currently" | "trading" | "price" | "value" | "symbol" | "ticker" | "spot"
    )
}

#[derive(Clone, Copy, Debug, PartialEq)]
pub struct NumberMatch {
    pub value: f64,
    pub is_percentage: bool,
}

pub fn parse_numbers(text: &str) -> Vec<NumberMatch> {
    let mut nums = Vec::new();
    let chars: Vec<char> = text.chars().collect();
    let mut i = 0;

    while i < chars.len() {
        let c = chars[i];
        if is_digit(c) || ((c == '$' || c == '€' || c == '£' || c == '¥') && i + 1 < chars.len() && (is_digit(chars[i + 1]) || chars[i + 1] == '.')) {
            if !is_digit(c) {
                i += 1;
            }

            let mut num_str = String::new();
            let mut has_dot = false;

            while i < chars.len() {
                let curr = chars[i];
                if is_digit(curr) {
                    num_str.push(curr);
                    i += 1;
                } else if curr == '.' && !has_dot && i + 1 < chars.len() && is_digit(chars[i + 1]) {
                    has_dot = true;
                    num_str.push(curr);
                    i += 1;
                } else if curr == ',' && i + 1 < chars.len() && is_digit(chars[i + 1]) {
                    i += 1;
                } else {
                    break;
                }
            }

            let mut multiplier = 1.0;
            let mut is_pct = false;

            let mut j = i;
            while j < chars.len() && chars[j] == ' ' { j += 1; }

            if j < chars.len() {
                let rem: String = chars[j..].iter().map(|&ch| to_lower(ch)).collect();
                if rem.starts_with('%') || rem.starts_with("percent") {
                    is_pct = true;
                } else if rem.starts_with("bps") || rem.starts_with("basis points") {
                    is_pct = true;
                    multiplier = 0.01;
                } else if rem.starts_with("billion") || rem.starts_with('b') {
                    multiplier = 1_000_000_000.0;
                } else if rem.starts_with("million") || rem.starts_with('m') {
                    multiplier = 1_000_000.0;
                } else if rem.starts_with("thousand") || rem.starts_with('k') {
                    multiplier = 1_000.0;
                }
            }

            let mut val: f64 = 0.0;
            let mut decimal = false;
            let mut div: f64 = 1.0;

            for ch in num_str.chars() {
                if ch == '.' {
                    decimal = true;
                } else if is_digit(ch) {
                    let d = (ch as u8 - b'0') as f64;
                    if !decimal {
                        val = val * 10.0 + d;
                    } else {
                        div *= 10.0;
                        val += d / div;
                    }
                }
            }

            if !num_str.is_empty() {
                nums.push(NumberMatch {
                    value: val * multiplier,
                    is_percentage: is_pct,
                });
            }
        } else {
            i += 1;
        }
    }
    nums
}

pub fn check_numeric_consistency(gt_text: &str, cand_text: &str) -> f32 {
    let gt_nums = parse_numbers(gt_text);
    if gt_nums.is_empty() {
        return 1.0;
    }

    let cand_nums = parse_numbers(cand_text);
    if cand_nums.is_empty() {
        return 0.40;
    }

    let mut matched_count = 0;
    for gn in &gt_nums {
        for cn in &cand_nums {
            let diff = if gn.value > cn.value { gn.value - cn.value } else { cn.value - gn.value };
            let max_v = if gn.value > cn.value { gn.value } else { cn.value };
            let rel_diff = if max_v > 0.0 { diff / max_v } else { diff };

            if rel_diff <= 0.02 {
                matched_count += 1;
                break;
            }
        }
    }

    if matched_count == gt_nums.len() {
        1.0
    } else if matched_count > 0 {
        0.50
    } else {
        0.05
    }
}

pub fn extract_words(text: &str) -> Vec<String> {
    let mut words = Vec::new();
    let chars: Vec<char> = text.chars().collect();
    let mut i = 0;

    while i < chars.len() {
        if is_alpha(chars[i]) || is_digit(chars[i]) {
            let mut w = String::new();
            while i < chars.len() && (is_alpha(chars[i]) || is_digit(chars[i])) {
                w.push(to_lower(chars[i]));
                i += 1;
            }
            if !w.is_empty() {
                words.push(w);
            }
        } else {
            i += 1;
        }
    }
    words
}

pub fn get_canonical_asset_class(word: &str) -> Option<&'static str> {
    match word {
        "btc" | "bitcoin" | "xbt" => Some("btc"),
        "eth" | "ethereum" | "ether" => Some("eth"),
        "sol" | "solana" => Some("sol"),
        "ada" | "cardano" => Some("ada"),
        "arb" | "arbitrum" => Some("arb"),
        "op" | "optimism" => Some("op"),
        "aave" => Some("aave"),
        "uni" | "uniswap" => Some("uni"),
        "link" | "chainlink" => Some("link"),
        "matic" | "polygon" | "pol" => Some("matic"),
        "mkr" | "maker" | "makerdao" => Some("mkr"),
        "usdt" | "tether" => Some("usdt"),
        "usdc" => Some("usdc"),
        "steth" | "lido" => Some("steth"),
        "avax" | "avalanche" => Some("avax"),
        "bnb" | "binance" => Some("bnb"),
        "xrp" | "ripple" => Some("xrp"),
        "doge" | "dogecoin" => Some("doge"),
        "etc" => Some("etc"),
        "ltc" => Some("ltc"),
        "shib" => Some("shib"),
        _ => None,
    }
}

pub fn check_entity_consistency(q_text: &str, gt_text: &str, cand_text: &str) -> f32 {
    let q_words = extract_words(q_text);
    let gt_words = extract_words(gt_text);
    let cand_words = extract_words(cand_text);

    let mut target_class = None;

    for w in &gt_words {
        if let Some(cls) = get_canonical_asset_class(w.as_str()) {
            target_class = Some(cls);
            break;
        }
    }

    if target_class.is_none() {
        for w in &q_words {
            if let Some(cls) = get_canonical_asset_class(w.as_str()) {
                target_class = Some(cls);
                break;
            }
        }
    }

    if let Some(target) = target_class {
        let mut cand_has_target = false;
        let mut cand_has_competing = false;

        for cw in &cand_words {
            if let Some(cand_cls) = get_canonical_asset_class(cw.as_str()) {
                if cand_cls == target {
                    cand_has_target = true;
                } else {
                    cand_has_competing = true;
                }
            }
        }

        if cand_has_target && !cand_has_competing {
            1.00
        } else if cand_has_competing {
            0.01 // Competing entity substitution penalty (e.g. ETC vs ETH)
        } else {
            0.50
        }
    } else {
        1.00
    }
}

pub fn check_polarity_and_negation(gt_text: &str, cand_text: &str) -> f32 {
    let gt_lower: String = gt_text.chars().map(to_lower).collect();
    let cand_lower: String = cand_text.chars().map(to_lower).collect();

    let negations = ["not", "never", "does not", "did not", "cannot", "is not", "isn't", "was not", "wasn't", "false", "incorrect"];
    let gt_has_neg = negations.iter().any(|&nw| gt_lower.contains(nw));
    let cand_has_neg = negations.iter().any(|&nw| cand_lower.contains(nw));

    if !gt_has_neg && cand_has_neg {
        return 0.02;
    }

    let pairs = [
        ("yes", "no"), ("true", "false"), ("up", "down"), ("higher", "lower"),
        ("increase", "decrease"), ("bullish", "bearish"), ("passed", "rejected"),
        ("passed", "failed"), ("approved", "rejected"), ("success", "failed"),
    ];

    for (pos, neg) in pairs {
        let gt_has_pos = gt_lower.contains(pos);
        let gt_has_neg_pair = gt_lower.contains(neg);
        let cand_has_pos = cand_lower.contains(pos);
        let cand_has_neg_pair = cand_lower.contains(neg);

        if (gt_has_pos && !gt_has_neg_pair && cand_has_neg_pair && !cand_has_pos)
            || (gt_has_neg_pair && !gt_has_pos && cand_has_pos && !cand_has_neg_pair)
        {
            return 0.02;
        }
    }
    1.0
}
