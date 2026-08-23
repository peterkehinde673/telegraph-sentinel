#![no_std]
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

pub fn parse_numbers(text: &str) -> Vec<f64> {
    let mut nums = Vec::new();
    let chars: Vec<char> = text.chars().collect();
    let mut i = 0;

    while i < chars.len() {
        if is_digit(chars[i]) || (chars[i] == '.' && i + 1 < chars.len() && is_digit(chars[i + 1])) {
            let mut num_str = String::new();
            while i < chars.len() && (is_digit(chars[i]) || chars[i] == '.') {
                num_str.push(chars[i]);
                i += 1;
            }

            let mut multiplier = 1.0;
            let mut j = i;
            while j < chars.len() && chars[j] == ' ' { j += 1; }
            if j < chars.len() {
                let lower_c = to_lower(chars[j]);
                if lower_c == 'm' || (j + 6 < chars.len() && &text[j..j+7].to_lowercase() == "million") {
                    multiplier = 1_000_000.0;
                } else if lower_c == 'b' || (j + 6 < chars.len() && &text[j..j+7].to_lowercase() == "billion") {
                    multiplier = 1_000_000_000.0;
                } else if lower_c == 'k' {
                    multiplier = 1_000.0;
                }
            }

            let mut val = 0.0;
            let mut decimal = false;
            let mut div = 1.0;

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
            nums.push(val * multiplier);
        } else {
            i += 1;
        }
    }
    nums
}

pub fn check_numeric_match(gt_text: &str, cand_text: &str) -> f32 {
    let gt_nums = parse_numbers(gt_text);
    if gt_nums.is_empty() {
        return 1.0;
    }

    let cand_nums = parse_numbers(cand_text);
    if cand_nums.is_empty() {
        return 0.0;
    }

    let mut all_matched = true;
    for &gn in &gt_nums {
        let mut found = false;
        for &cn in &cand_nums {
            let diff = if gn > cn { gn - cn } else { cn - gn };
            let max_val = if gn > cn { gn } else { cn };
            let rel_diff = if max_val > 0.0 { diff / max_val } else { diff };
            if rel_diff <= 0.01 {
                found = true;
                break;
            }
        }
        if !found {
            all_matched = false;
            break;
        }
    }

    if all_matched { 1.0 } else { 0.0 }
}

pub fn check_polarity_conflict(gt_text: &str, cand_text: &str) -> bool {
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

        if (gt_has_pos && !gt_has_neg && cand_has_neg && !cand_has_pos) ||
           (gt_has_neg && !gt_has_pos && cand_has_pos && !cand_has_neg) {
            return true;
        }
    }
    false
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

pub fn calculate_token_recall(gt_text: &str, cand_text: &str) -> f32 {
    let gt_words = extract_words(gt_text);
    if gt_words.is_empty() {
        return 1.0;
    }
    let cand_words = extract_words(cand_text);
    if cand_words.is_empty() {
        return 0.0;
    }

    let mut matched = 0;
    for gw in &gt_words {
        if cand_words.contains(gw) {
            matched += 1;
        }
    }

    (matched as f32) / (gt_words.len() as f32)
}
