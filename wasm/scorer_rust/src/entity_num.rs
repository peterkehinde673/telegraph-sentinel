#![no_std]
use alloc::vec::Vec;
use alloc::string::String;

#[derive(Clone, Debug, PartialEq)]
pub enum TokenKind {
    Word(String),
    Number(String),
}

fn is_digit(c: char) -> bool {
    c >= '0' && c <= '9'
}

fn is_alpha(c: char) -> bool {
    (c >= 'a' && c <= 'z') || (c >= 'A' && c <= 'Z')
}

fn to_lower_char(c: char) -> char {
    if c >= 'A' && c <= 'Z' {
        ((c as u8) + 32) as char
    } else {
        c
    }
}

pub fn extract_tokens(text: &str) -> Vec<TokenKind> {
    let mut tokens = Vec::new();
    let chars: Vec<char> = text.chars().collect();
    let mut i = 0;

    while i < chars.len() {
        let c = chars[i];
        if is_digit(c) || c == '$' || c == '€' || c == '£' {
            let mut num_str = String::new();
            while i < chars.len() && (is_digit(chars[i]) || chars[i] == '.' || chars[i] == ',' || chars[i] == '$' || chars[i] == '%' || chars[i] == '€') {
                if chars[i] != ',' && chars[i] != '$' && chars[i] != '€' {
                    num_str.push(chars[i]);
                }
                i += 1;
            }
            if !num_str.is_empty() {
                tokens.push(TokenKind::Number(num_str));
            }
        } else if is_alpha(c) {
            let mut word = String::new();
            while i < chars.len() && (is_alpha(chars[i]) || is_digit(chars[i])) {
                word.push(to_lower_char(chars[i]));
                i += 1;
            }
            if !word.is_empty() {
                tokens.push(TokenKind::Word(word));
            }
        } else {
            i += 1;
        }
    }
    tokens
}

pub fn check_numerical_consistency(gt_text: &str, cand_text: &str) -> f32 {
    let gt_tokens = extract_tokens(gt_text);
    let cand_tokens = extract_tokens(cand_text);

    let gt_numbers: Vec<&String> = gt_tokens.iter().filter_map(|t| match t {
        TokenKind::Number(n) => Some(n),
        _ => None,
    }).collect();

    if gt_numbers.is_empty() {
        return 1.0; // No numbers to verify
    }

    let cand_numbers: Vec<&String> = cand_tokens.iter().filter_map(|t| match t {
        TokenKind::Number(n) => Some(n),
        _ => None,
    }).collect();

    if cand_numbers.is_empty() {
        return 0.2; // Missing required numerical values
    }

    let mut matched = 0;
    for gn in &gt_numbers {
        if cand_numbers.iter().any(|cn| cn == gn || cn.starts_with(gn.as_str()) || gn.starts_with(cn.as_str())) {
            matched += 1;
        }
    }

    if matched == gt_numbers.len() {
        1.0
    } else if matched > 0 {
        0.5
    } else {
        0.0 // Contradicting or completely mismatched numbers
    }
}

pub fn check_contradiction(gt_text: &str, cand_text: &str) -> bool {
    let pairs = [
        ("yes", "no"),
        ("true", "false"),
        ("up", "down"),
        ("higher", "lower"),
        ("increase", "decrease"),
        ("bullish", "bearish"),
        ("approved", "rejected"),
        ("success", "failed"),
    ];

    let gt_lower: String = gt_text.chars().map(to_lower_char).collect();
    let cand_lower: String = cand_text.chars().map(to_lower_char).collect();

    for (pos, neg) in pairs {
        let gt_has_pos = gt_lower.contains(pos);
        let gt_has_neg = gt_lower.contains(neg);
        let cand_has_pos = cand_lower.contains(pos);
        let cand_has_neg = cand_lower.contains(neg);

        if (gt_has_pos && !gt_has_neg && cand_has_neg && !cand_has_pos) ||
           (gt_has_neg && !gt_has_pos && cand_has_pos && !cand_has_neg) {
            return true; // Direct polarity conflict
        }
    }
    false
}
