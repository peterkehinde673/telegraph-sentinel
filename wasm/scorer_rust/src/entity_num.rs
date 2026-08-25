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
            | "which" | "does" | "about" | "currently" | "trading" | "price" | "value" | "symbol" | "ticker"
    )
}

#[derive(Clone, Copy, Debug, PartialEq)]
pub struct NumberMatch {
    pub value: f64,
    pub is_percentage: bool,
}

pub fn parse_crypto_numbers(text: &str) -> Vec<NumberMatch> {
    let mut nums = Vec::new();
    let chars: Vec<char> = text.chars().collect();
    let mut i = 0;

    while i < chars.len() {
        let c = chars[i];
        if is_digit(c) || ((c == '$' || c == '€' || c == '£' || c == '¥') && i + 1 < chars.len() && (is_digit(chars[i + 1]) || chars[i + 1] == '.')) {
            if !is_digit(chars[i]) {
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
    let gt_nums = parse_crypto_numbers(gt_text);
    if gt_nums.is_empty() {
        return 1.0;
    }

    let cand_nums = parse_crypto_numbers(cand_text);
    if cand_nums.is_empty() {
        return 0.0;
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
    } else {
        0.0
    }
}

pub fn check_numeric_match(gt_text: &str, cand_text: &str) -> f32 {
    check_numeric_consistency(gt_text, cand_text)
}

pub fn extract_crypto_entities(text: &str) -> Vec<&'static str> {
    let entities = [
        ("bitcoin", "btc"), ("btc", "btc"),
        ("ethereum", "eth"), ("ether", "eth"), ("eth", "eth"),
        ("solana", "sol"), ("sol", "sol"),
        ("aave", "aave"),
        ("cardano", "ada"), ("ada", "ada"),
        ("arbitrum", "arb"), ("arb", "arb"),
        ("optimism", "op"), ("op", "op"),
        ("uniswap", "uni"), ("uni", "uni"),
        ("chainlink", "link"), ("link", "link"),
        ("polygon", "matic"), ("matic", "matic"), ("pol", "matic"),
        ("makerdao", "mkr"), ("maker", "mkr"), ("mkr", "mkr"),
        ("tether", "usdt"), ("usdt", "usdt"),
        ("usdc", "usdc"),
        ("lido", "steth"), ("steth", "steth"),
        ("avalanche", "avax"), ("avax", "avax"),
        ("binance", "bnb"), ("bnb", "bnb"),
        ("ripple", "xrp"), ("xrp", "xrp"),
        ("dogecoin", "doge"), ("doge", "doge"),
    ];

    let words = extract_words(text);
    let mut found = Vec::new();

    for (name, canonical) in entities {
        if words.iter().any(|w| w == name) {
            if !found.contains(&canonical) {
                found.push(canonical);
            }
        }
    }
    found
}

pub fn check_crypto_entity_consistency(q_text: &str, gt_text: &str, cand_text: &str) -> f32 {
    let mut ref_entities = extract_crypto_entities(gt_text);
    if ref_entities.is_empty() {
        ref_entities = extract_crypto_entities(q_text);
    }

    if ref_entities.is_empty() {
        return 1.0;
    }

    let cand_entities = extract_crypto_entities(cand_text);
    if cand_entities.is_empty() {
        return 0.50;
    }

    let mut matched = 0;
    let mut substituted_wrong = false;

    for &re in &ref_entities {
        if cand_entities.contains(&re) {
            matched += 1;
        } else {
            substituted_wrong = true;
        }
    }

    if matched == ref_entities.len() && !substituted_wrong {
        1.0
    } else if substituted_wrong {
        0.0
    } else {
        0.20
    }
}

pub fn check_currency_consistency(q_text: &str, gt_text: &str, cand_text: &str) -> f32 {
    let combined_ref = String::from(q_text) + " " + gt_text;
    let ref_lower: String = combined_ref.chars().map(to_lower).collect();
    let cand_lower: String = cand_text.chars().map(to_lower).collect();

    let has_ref_eur = ref_lower.contains("eur") || ref_lower.contains('€');
    let has_ref_usd = ref_lower.contains("usd") || ref_lower.contains('$') || ref_lower.contains("usdt") || ref_lower.contains("usdc");

    let has_cand_eur = cand_lower.contains("eur") || cand_lower.contains('€');
    let has_cand_usd = cand_lower.contains("usd") || cand_lower.contains('$') || cand_lower.contains("usdt") || cand_lower.contains("usdc");

    if (has_ref_usd && !has_ref_eur && has_cand_eur) || (has_ref_eur && !has_ref_usd && has_cand_usd && !has_cand_eur) {
        return 0.0;
    }
    1.0
}

pub fn check_polarity_conflict(gt_text: &str, cand_text: &str) -> f32 {
    let pairs = [
        ("yes", "no"),
        ("true", "false"),
        ("up", "down"),
        ("higher", "lower"),
        ("increase", "decrease"),
        ("bullish", "bearish"),
        ("passed", "rejected"),
        ("passed", "failed"),
        ("approved", "rejected"),
        ("success", "failed"),
    ];

    let gt_lower: String = gt_text.chars().map(to_lower).collect();
    let cand_lower: String = cand_text.chars().map(to_lower).collect();

    for (pos, neg) in pairs {
        let gt_has_pos = gt_lower.contains(pos);
        let gt_has_neg = gt_lower.contains(neg);
        let cand_has_pos = cand_lower.contains(pos);
        let cand_has_neg = cand_lower.contains(neg);

        if (gt_has_pos && !gt_has_neg && cand_has_neg && !cand_has_pos)
            || (gt_has_neg && !gt_has_pos && cand_has_pos && !cand_has_neg)
        {
            return 0.0;
        }
    }
    1.0
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

pub fn contains_whole_word(haystack: &str, needle: &str) -> bool {
    let all_n_words = extract_words(needle);
    let key_n_words: Vec<&String> = all_n_words.iter().filter(|w| !is_stopword(w.as_str())).collect();
    let effective_n = if key_n_words.is_empty() { all_n_words.iter().collect() } else { key_n_words };

    if effective_n.is_empty() { return false; }

    let h_words = extract_words(haystack);
    for nw in &effective_n {
        if !h_words.contains(nw) {
            return false;
        }
    }
    true
}
