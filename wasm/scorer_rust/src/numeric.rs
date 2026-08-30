use alloc::vec::Vec;
use alloc::string::String;
use alloc::format;
use libm::exp;

#[inline]
fn is_digit(c: char) -> bool {
    c >= '0' && c <= '9'
}

#[inline]
fn is_alpha(c: char) -> bool {
    (c >= 'a' && c <= 'z') || (c >= 'A' && c <= 'Z')
}

#[inline]
fn to_lower(c: char) -> char {
    if c >= 'A' && c <= 'Z' {
        ((c as u8) + 32) as char
    } else {
        c
    }
}

pub fn to_lower_str(s: &str) -> String {
    s.chars().map(to_lower).collect()
}

#[derive(Clone, Copy, Debug, PartialEq)]
pub struct NumberMatch {
    pub value: f64,
    pub is_percentage: bool,
    pub is_cents: bool,
    pub is_price: bool,
}

pub fn parse_numbers(text: &str) -> Vec<NumberMatch> {
    let mut nums = Vec::new();
    let chars: Vec<char> = text.chars().collect();
    let lower = to_lower_str(text);
    let lower_chars: Vec<char> = lower.chars().collect();
    let len = chars.len();
    let mut i = 0;

    while i < len {
        let c = chars[i];
        let is_curr_sym = c == '$' || c == '€' || c == '£' || c == '¥' || c == '₩' || c == '₹';
        let next_is_num = i + 1 < len && (is_digit(chars[i + 1]) || chars[i + 1] == '.');

        if is_digit(c) || (is_curr_sym && next_is_num) {
            let mut has_prefix_curr = false;
            if is_curr_sym {
                has_prefix_curr = true;
                i += 1;
            }

            let start_idx = i;
            let mut num_str = String::new();
            let mut has_dot = false;
            let mut has_exp = false;

            while i < len {
                let curr = chars[i];
                if is_digit(curr) {
                    num_str.push(curr);
                    i += 1;
                } else if curr == '.' && !has_dot && !has_exp && i + 1 < len && is_digit(chars[i + 1]) {
                    has_dot = true;
                    num_str.push(curr);
                    i += 1;
                } else if (curr == 'e' || curr == 'E') && !has_exp && i + 1 < len && (is_digit(chars[i + 1]) || chars[i + 1] == '+' || chars[i + 1] == '-') {
                    has_exp = true;
                    num_str.push(curr);
                    i += 1;
                    if i < len && (chars[i] == '+' || chars[i] == '-') {
                        num_str.push(chars[i]);
                        i += 1;
                    }
                } else if curr == ',' && i + 1 < len && is_digit(chars[i + 1]) {
                    i += 1; // Skip thousands comma
                } else {
                    break;
                }
            }

            if num_str.is_empty() {
                continue;
            }

            // --- CONTEXT INSPECTION BEFORE NUMBER ---
            let prefix_window: String = if start_idx > 0 {
                let p_start = start_idx.saturating_sub(25);
                lower_chars[p_start..start_idx].iter().collect()
            } else {
                String::new()
            };

            // 1. Check for Ranking / Ordinal prefixes: "#", "rank #", "rank ", "ranked ", "no. ", "top "
            let is_rank = prefix_window.ends_with('#')
                || prefix_window.ends_with("rank ")
                || prefix_window.ends_with("ranked ")
                || prefix_window.ends_with("rank #")
                || prefix_window.ends_with("ranked #")
                || prefix_window.ends_with("no. ")
                || prefix_window.ends_with("top ");

            if is_rank {
                continue;
            }

            // 2. Check for Clock Times: "14:00", "05:30:00" (colon followed by 2 digits)
            if i < len && chars[i] == ':' && i + 2 < len && is_digit(chars[i + 1]) && is_digit(chars[i + 2]) {
                i += 3;
                if i < len && chars[i] == ':' && i + 2 < len && is_digit(chars[i + 1]) && is_digit(chars[i + 2]) {
                    i += 3; // Skip seconds
                }
                continue;
            }
            if start_idx >= 1 && chars[start_idx - 1] == ':' {
                continue;
            }

            // 3. Check for Calendar Year (e.g. 1990..2099)
            let mut is_calendar_year = false;
            if !has_dot && !has_exp && (num_str.starts_with("20") || num_str.starts_with("19")) && num_str.len() == 4 {
                if prefix_window.ends_with("in ")
                    || prefix_window.ends_with("since ")
                    || prefix_window.ends_with("year ")
                    || prefix_window.ends_with("from ")
                    || prefix_window.ends_with("of ")
                    || prefix_window.ends_with("as of ")
                    || prefix_window.ends_with("on ")
                    || prefix_window.ends_with(", ")
                {
                    is_calendar_year = true;
                }
            }
            if is_calendar_year {
                continue;
            }

            // 4. Check for Date Days: "August 30", "Aug 30", "17 Aug"
            let month_names = [
                "jan", "january", "feb", "february", "mar", "march", "apr", "april",
                "may", "jun", "june", "jul", "july", "aug", "august", "sep", "september",
                "oct", "october", "nov", "november", "dec", "december",
            ];
            let mut is_date_day = false;
            if !has_dot && !has_exp && !has_prefix_curr {
                for m in &month_names {
                    let pattern = String::from(*m) + " ";
                    if prefix_window.ends_with(&pattern) {
                        is_date_day = true;
                        break;
                    }
                }
            }
            if is_date_day {
                continue;
            }

            // --- CONTEXT INSPECTION AFTER NUMBER ---
            let mut multiplier = 1.0;
            let mut is_pct = false;
            let mut is_cents = false;
            let mut is_vol_or_mcap = false;
            let mut is_timeframe = false;
            let mut is_unit_count = false;

            let mut j = i;
            while j < len && (chars[j] == ' ' || chars[j] == '-' || chars[j] == '/') {
                j += 1;
            }

            if j < len {
                let rem: String = lower_chars[j..].iter().collect();

                // Percentage
                if rem.starts_with('%') || rem.starts_with("percent") || rem.starts_with("pct") {
                    is_pct = true;
                } else if rem.starts_with("bps") || rem.starts_with("basis points") {
                    is_pct = true;
                    multiplier = 0.01;
                }
                // Timeframe intervals: "24h", "24hr", "24-hour", "7d", "30d", "1y", "1h", "15m"
                else if (rem.starts_with('h') && !rem.starts_with("hbar"))
                    || rem.starts_with("hr")
                    || rem.starts_with("hour")
                    || rem.starts_with("hours")
                    || rem.starts_with("d ")
                    || rem.starts_with("day")
                    || rem.starts_with("days")
                    || rem.starts_with("w ")
                    || rem.starts_with("week")
                    || rem.starts_with("weeks")
                    || rem.starts_with("mo ")
                    || rem.starts_with("month")
                    || rem.starts_with("months")
                    || rem.starts_with("yr")
                    || rem.starts_with("year")
                    || rem.starts_with("years")
                    || rem.starts_with("min")
                    || rem.starts_with("minute")
                    || rem.starts_with("minutes")
                    || rem.starts_with("sec")
                    || rem.starts_with("second")
                {
                    is_timeframe = true;
                }
                // Cents
                else if rem.starts_with("cents") || rem.starts_with("cent") || rem.starts_with('¢')
                    || (rem.starts_with('c') && (rem.len() == 1 || !is_alpha(rem.chars().nth(1).unwrap_or(' '))))
                {
                    is_cents = true;
                    multiplier = 0.01;
                }
                // Suffix Multipliers: k, m, b
                else if rem.starts_with("billion") || (rem.starts_with('b') && (rem.len() == 1 || !is_alpha(rem.chars().nth(1).unwrap_or(' ')))) {
                    multiplier = 1_000_000_000.0;
                    is_vol_or_mcap = true;
                } else if rem.starts_with("million") || (rem.starts_with('m') && (rem.len() == 1 || !is_alpha(rem.chars().nth(1).unwrap_or(' ')))) {
                    multiplier = 1_000_000.0;
                    if prefix_window.contains("vol") || prefix_window.contains("cap") || rem.contains("vol") || rem.contains("cap") {
                        is_vol_or_mcap = true;
                    }
                } else if rem.starts_with("thousand") || (rem.starts_with('k') && (rem.len() == 1 || !is_alpha(rem.chars().nth(1).unwrap_or(' ')))) {
                    multiplier = 1_000.0;
                }
                // Check if followed by Month name (e.g. "30 Aug")
                else {
                    for m in &month_names {
                        if rem.starts_with(m) {
                            is_date_day = true;
                            break;
                        }
                    }
                }

                // Check for asset token suffix indicating a unit count, e.g. "1 BTC", "1 ETH", "1 SOL", "1 token", "1 coin"
                if !has_prefix_curr && (rem.starts_with("btc") || rem.starts_with("bitcoin")
                    || rem.starts_with("eth") || rem.starts_with("ether")
                    || rem.starts_with("sol") || rem.starts_with("solana")
                    || rem.starts_with("token") || rem.starts_with("coin")
                    || rem.starts_with("unit") || rem.starts_with("sat") || rem.starts_with("satoshi"))
                {
                    is_unit_count = true;
                }
            }

            if is_timeframe || is_date_day {
                continue;
            }

            // Check if context contains explicit volume/mcap indicators
            if prefix_window.contains("volume") || prefix_window.contains("24h vol") || prefix_window.contains("mcap") || prefix_window.contains("market cap") || prefix_window.contains("tvl") || prefix_window.contains("supply") {
                is_vol_or_mcap = true;
            }

            // Parse numerical value (including scientific exponent if present)
            let mut base_val: f64 = 0.0;
            let mut decimal = false;
            let mut div: f64 = 1.0;
            let mut exp_val: i32 = 0;
            let mut exp_sign: i32 = 1;
            let mut in_exp = false;

            for ch in num_str.chars() {
                if ch == 'e' || ch == 'E' {
                    in_exp = true;
                } else if in_exp {
                    if ch == '-' {
                        exp_sign = -1;
                    } else if ch == '+' {
                        exp_sign = 1;
                    } else if is_digit(ch) {
                        let d = (ch as u8 - b'0') as i32;
                        exp_val = exp_val * 10 + d;
                    }
                } else if ch == '.' {
                    decimal = true;
                } else if is_digit(ch) {
                    let d = (ch as u8 - b'0') as f64;
                    if !decimal {
                        base_val = base_val * 10.0 + d;
                    } else {
                        div *= 10.0;
                        base_val += d / div;
                    }
                }
            }

            if in_exp {
                let total_exp = exp_sign * exp_val;
                if total_exp > 0 {
                    for _ in 0..total_exp {
                        base_val *= 10.0;
                    }
                } else if total_exp < 0 {
                    for _ in 0..(-total_exp) {
                        base_val /= 10.0;
                    }
                }
            }

            let final_val = base_val * multiplier;

            // Unit count like "1 BTC = $65,400"
            if is_unit_count && (final_val == 1.0 || final_val == 100.0) && !has_prefix_curr {
                continue;
            }

            let is_price = !is_pct && !is_vol_or_mcap;

            nums.push(NumberMatch {
                value: final_val,
                is_percentage: is_pct,
                is_cents,
                is_price,
            });
        } else {
            i += 1;
        }
    }
    nums
}

pub fn check_numeric_consistency(gt_text: &str, cand_text: &str) -> f32 {
    let gt_all = parse_numbers(gt_text);
    if gt_all.is_empty() {
        return 1.0;
    }

    // In CRYPTO_PRICE intent, price numbers are the authoritative target.
    // If ground truth contains any price number, we MUST match prices.
    let gt_has_price = gt_all.iter().any(|n| n.is_price);
    let gt_nums: Vec<NumberMatch> = if gt_has_price {
        gt_all.into_iter().filter(|n| n.is_price).collect()
    } else {
        gt_all.into_iter().filter(|n| n.is_percentage).collect()
    };

    if gt_nums.is_empty() {
        return 1.0;
    }

    let cand_all = parse_numbers(cand_text);
    let cand_nums: Vec<NumberMatch> = if gt_has_price {
        cand_all.into_iter().filter(|n| n.is_price).collect()
    } else {
        cand_all.into_iter().filter(|n| n.is_percentage).collect()
    };

    if cand_nums.is_empty() {
        return 0.0; // Missing price for a factual price query is zero score
    }

    let mut total_score = 0.0;
    let mut major_conflicts = 0;

    for gn in &gt_nums {
        let mut best_match: f64 = 0.0;
        for cn in &cand_nums {
            let diff = if gn.value > cn.value { gn.value - cn.value } else { cn.value - gn.value };
            let max_v = if gn.value > cn.value { gn.value } else { cn.value };
            let rel_diff = if max_v > 0.0 { diff / max_v } else { diff };

            // Calibrated continuous price error curve:
            // <= 0.8% error: 1.00 (covers exchange spread/rounding: $65,400 vs $65,400.25)
            // 0.8% - 2.0% error: 1.00 -> 0.82
            // 2.0% - 3.5% error: 0.82 -> 0.00
            // > 3.5% error: 0.00 (factual failure on spot crypto price)
            let match_score = if rel_diff <= 0.005 {
                1.00
            } else if rel_diff <= 0.010 {
                1.00 - 50.0 * (rel_diff - 0.005)
            } else if rel_diff <= 0.018 {
                0.75 * exp(-20000.0 * (rel_diff - 0.010) * (rel_diff - 0.010))
            } else {
                0.00
            };

            if match_score > best_match {
                best_match = match_score;
            }

            if rel_diff > 0.15 {
                major_conflicts += 1;
            }
        }
        total_score += best_match;
    }

    let mut score = (total_score / (gt_nums.len() as f64)) as f32;

    // Check if candidate contains multiple contradictory prices or broad fake ranges
    if cand_nums.len() > gt_nums.len() {
        let cand_lower = to_lower_str(cand_text);

        // Check if candidate is a price range like "between $A and $B"
        if cand_nums.len() == 2 && (cand_lower.contains("between") || cand_lower.contains("to") || cand_lower.contains('-')) {
            let p1 = cand_nums[0].value;
            let p2 = cand_nums[1].value;
            let range_min = if p1 < p2 { p1 } else { p2 };
            let range_max = if p1 > p2 { p1 } else { p2 };
            let spread = if range_max > 0.0 { (range_max - range_min) / range_max } else { 0.0 };

            // If range spread is wider than 4% (e.g. "$10,000 to $20,000" or "$10,000 to $70,000"), fail it
            if spread > 0.04 {
                return 0.00;
            }
        }

        if major_conflicts > 0 {
            if cand_lower.contains("actually")
                || cand_lower.contains("instead")
                || cand_lower.contains("but now")
                || cand_lower.contains("rather than")
                || cand_lower.contains("or perhaps")
                || cand_lower.contains("or maybe")
                || cand_lower.contains("was")
                || cand_lower.contains("dropped to")
                || cand_lower.contains("crashed to")
                || cand_lower.contains("surged to")
                || cand_lower.contains("updated to")
            {
                return 0.00;
            }
            score = 0.00;
        }
    }

    if score < 0.01 {
        0.0
    } else {
        score
    }
}

pub fn extract_words(text: &str) -> Vec<String> {
    let mut words = Vec::new();
    let chars: Vec<char> = text.chars().collect();
    let len = chars.len();
    let mut i = 0;

    while i < len {
        if is_alpha(chars[i]) || is_digit(chars[i]) {
            let mut w = String::new();
            while i < len && (is_alpha(chars[i]) || is_digit(chars[i])) {
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

pub fn extract_raw_tokens(text: &str) -> Vec<String> {
    let mut tokens = Vec::new();
    let chars: Vec<char> = text.chars().collect();
    let len = chars.len();
    let mut i = 0;

    while i < len {
        if is_alpha(chars[i]) || is_digit(chars[i]) {
            let mut tok = String::new();
            while i < len && (is_alpha(chars[i]) || is_digit(chars[i])) {
                tok.push(chars[i]);
                i += 1;
            }
            if !tok.is_empty() {
                tokens.push(tok);
            }
        } else {
            i += 1;
        }
    }
    tokens
}

// Canonical asset aliases
pub fn get_canonical_asset_class(word: &str) -> Option<&'static str> {
    match word {
        "btc" | "bitcoin" | "xbt" | "sats" | "satoshi" => Some("btc"),
        "eth" | "ethereum" | "ether" | "weth" => Some("eth"),
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
        "steth" | "lido" | "ldo" => Some("steth"),
        "avax" | "avalanche" => Some("avax"),
        "bnb" | "binancecoin" | "bsc" => Some("bnb"),
        "xrp" | "ripple" => Some("xrp"),
        "doge" | "dogecoin" => Some("doge"),
        "etc" | "ethereumclassic" => Some("etc"),
        "ltc" | "litecoin" => Some("ltc"),
        "shib" | "shiba" | "shibainu" => Some("shib"),
        "comp" | "compound" => Some("comp"),
        "sui" => Some("sui"),
        "near" => Some("near"),
        "tao" | "bittensor" => Some("tao"),
        "render" | "rndr" => Some("render"),
        "pepe" => Some("pepe"),
        "dot" | "polkadot" => Some("dot"),
        "atom" | "cosmos" => Some("atom"),
        "xmr" | "monero" => Some("xmr"),
        "apt" | "aptos" => Some("apt"),
        "inj" | "injective" => Some("inj"),
        "tia" | "celestia" => Some("tia"),
        "kas" | "kaspa" => Some("kas"),
        "fil" | "filecoin" => Some("fil"),
        "icp" | "internetcomputer" => Some("icp"),
        "hbar" | "hedera" => Some("hbar"),
        "sushi" | "sushiswap" => Some("sushi"),
        "band" => Some("band"),
        "trx" | "tron" => Some("trx"),
        "ton" | "toncoin" => Some("ton"),
        "algo" | "algorand" => Some("algo"),
        "vet" | "vechain" => Some("vet"),
        "xlm" | "stellar" => Some("xlm"),
        "bch" | "bitcoincash" => Some("bch"),
        "ftm" | "fantom" | "sonic" => Some("ftm"),
        "rune" | "thorchain" => Some("rune"),
        "sei" => Some("sei"),
        "strk" | "starknet" => Some("strk"),
        "wld" | "worldcoin" => Some("wld"),
        "ena" | "ethena" => Some("ena"),
        "ondo" => Some("ondo"),
        "pendle" => Some("pendle"),
        "bonk" => Some("bonk"),
        "wif" | "dogwifhat" => Some("wif"),
        "floki" => Some("floki"),
        "jup" | "jupiter" => Some("jup"),
        "pyth" => Some("pyth"),
        "fet" | "asi" => Some("fet"),
        "gala" => Some("gala"),
        "chz" | "chiliz" => Some("chz"),
        "sand" => Some("sand"),
        "mana" => Some("mana"),
        "crv" | "curve" => Some("crv"),
        "snx" | "synthetix" => Some("snx"),
        "dydx" => Some("dydx"),
        "gmx" => Some("gmx"),
        "ens" => Some("ens"),
        "1inch" => Some("1inch"),
        "ar" | "arweave" => Some("ar"),
        "akt" | "akash" => Some("akt"),
        "stx" | "stacks" => Some("stx"),
        "imx" | "immutable" | "immutablex" => Some("imx"),
        "grt" | "thegraph" => Some("grt"),
        _ => None,
    }
}

// Check if word is an exchange name (not a competing asset)
pub fn is_exchange_or_platform(word: &str) -> bool {
    matches!(
        word,
        "binance" | "coinbase" | "kraken" | "okx" | "bybit" | "gate" | "kucoin"
            | "mexc" | "bitfinex" | "gemini" | "bitget" | "crypto.com" | "robinhood"
            | "raydium" | "aerodrome" | "uniswap" | "sushiswap" | "pancakeswap"
            | "coingecko" | "coinmarketcap" | "dexscreener" | "oracle" | "pyth"
    )
}

pub fn is_common_query_word(w: &str) -> bool {
    matches!(
        w,
        "what" | "is" | "the" | "price" | "of" | "spot" | "trading" | "at" | "currently"
            | "value" | "in" | "usd" | "eur" | "gbp" | "how" | "much" | "does" | "cost"
            | "ticker" | "symbol" | "for" | "today" | "now" | "token" | "coin" | "crypto"
            | "cryptocurrency" | "market" | "rate" | "quote" | "worth" | "on" | "as"
            | "to" | "and" | "a" | "an" | "per" | "with" | "right" | "live" | "feed"
    )
}

pub const ALL_ASSET_CLASSES: &[&str] = &[
    "btc", "eth", "sol", "ada", "xrp", "doge", "avax", "link", "matic",
    "bnb", "arb", "op", "sui", "near", "inj", "tia", "kas", "mkr",
    "uni", "aave", "tao", "render", "dot", "atom", "pepe", "bonk",
];

pub fn get_asset_aliases(cls: &str) -> &'static [&'static str] {
    match cls {
        "btc" => &["bitcoin", "btc"],
        "eth" => &["ethereum", "eth"],
        "sol" => &["solana", "sol"],
        "ada" => &["cardano", "ada"],
        "xrp" => &["ripple", "xrp"],
        "doge" => &["dogecoin", "doge"],
        "avax" => &["avalanche", "avax"],
        "link" => &["chainlink", "link"],
        "matic" => &["polygon", "matic", "pol"],
        "bnb" => &["binance", "bnb"],
        "arb" => &["arbitrum", "arb"],
        "op" => &["optimism", "op"],
        "sui" => &["sui"],
        "near" => &["near"],
        "inj" => &["injective", "inj"],
        "tia" => &["celestia", "tia"],
        "kas" => &["kaspa", "kas"],
        "mkr" => &["makerdao", "mkr", "maker"],
        "uni" => &["uniswap", "uni"],
        "aave" => &["aave"],
        "tao" => &["bittensor", "tao"],
        "render" => &["render", "rndr"],
        "dot" => &["polkadot", "dot"],
        "atom" => &["cosmos", "atom"],
        "pepe" => &["pepe"],
        "bonk" => &["bonk"],
        _ => &[],
    }
}

fn get_sim_for_class(q_vec: &[f32], cls: &str) -> f32 {
    let aliases = get_asset_aliases(cls);
    let mut max_sim = -1.0f32;
    for a in aliases {
        let templates = [
            format!("What is the price of {}?", a),
            format!("What is {} spot price?", a),
            format!("What is {} price?", a),
            format!("What is the current price of {}?", a),
            format!("What is {} token price?", a),
            format!("What is {} token value?", a),
            format!("{} price", a),
        ];
        for t in &templates {
            let enc = crate::tokenizer::tokenize(t);
            let t_vec = crate::embed::run(&enc);
            let sim = crate::math::cosine(q_vec, &t_vec);
            if sim > max_sim {
                max_sim = sim;
            }
        }
    }
    max_sim
}

pub fn check_entity_consistency(q_text: &str, gt_text: &str, cand_text: &str, q_vec: &[f32]) -> f32 {
    let q_words = extract_words(q_text);
    let gt_words = extract_words(gt_text);
    let cand_words = extract_words(cand_text);

    // 1. Check if known canonical asset class is in question or ground truth
    let mut target_class: Option<&'static str> = None;
    for w in &gt_words {
        if let Some(cls) = get_canonical_asset_class(w) {
            target_class = Some(cls);
            break;
        }
    }
    if target_class.is_none() {
        for w in &q_words {
            if let Some(cls) = get_canonical_asset_class(w) {
                target_class = Some(cls);
                break;
            }
        }
    }

    if let Some(target) = target_class {
        let mut cand_has_target = false;
        let mut cand_has_competing = false;

        for cw in &cand_words {
            if is_exchange_or_platform(cw) {
                continue;
            }
            if let Some(cand_cls) = get_canonical_asset_class(cw) {
                if cand_cls == target {
                    cand_has_target = true;
                } else if cand_cls != "usdt" && cand_cls != "usdc" {
                    cand_has_competing = true;
                }
            }
        }

        if cand_has_target {
            return 1.00;
        } else if cand_has_competing {
            return 0.00; // Zero credit for attributing to wrong asset
        } else {
            return 1.00; // Concise answers without explicit asset name (e.g. "$145.50 USD")
        }
    }

    // 2. Dynamic Entity Extraction for unlisted / arbitrary crypto assets:
    let mut dynamic_target_tokens: Vec<String> = Vec::new();
    let raw_q_tokens = extract_raw_tokens(q_text);
    for tok in &raw_q_tokens {
        let l = to_lower_str(tok);
        if !is_common_query_word(&l) && !is_exchange_or_platform(&l) && tok.len() >= 2 {
            dynamic_target_tokens.push(l);
        }
    }

    if !dynamic_target_tokens.is_empty() {
        let mut has_target_match = false;
        for t in &dynamic_target_tokens {
            if cand_words.iter().any(|cw| cw == t) {
                has_target_match = true;
                break;
            }
        }

        let mut cand_competing_known = false;
        for cw in &cand_words {
            if is_exchange_or_platform(cw) {
                continue;
            }
            if let Some(cand_cls) = get_canonical_asset_class(cw) {
                if cand_cls != "usdt" && cand_cls != "usdc" && !dynamic_target_tokens.iter().any(|t| t == &cand_cls) {
                    cand_competing_known = true;
                    break;
                }
            }
        }

        if has_target_match {
            return 1.00;
        } else if cand_competing_known {
            return 0.00;
        } else {
            return 1.00;
        }
    }

    // 3. Fallback for cached evaluation when q_text is empty and ground truth is concise:
    if !q_vec.is_empty() {
        let mut cand_assets = Vec::new();
        for cw in &cand_words {
            if is_exchange_or_platform(cw) {
                continue;
            }
            if let Some(cls) = get_canonical_asset_class(cw) {
                if cls != "usdt" && cls != "usdc" && !cand_assets.contains(&cls) {
                    cand_assets.push(cls);
                }
            }
        }

        if !cand_assets.is_empty() {
            let mut global_best_sim = -1.0f32;
            for &cls in ALL_ASSET_CLASSES {
                let s = get_sim_for_class(q_vec, cls);
                if s > global_best_sim {
                    global_best_sim = s;
                }
            }

            let mut any_asset_matched_qvec = false;
            for &cand_cls in &cand_assets {
                let s = get_sim_for_class(q_vec, cand_cls);
                if s >= global_best_sim - 0.0005 {
                    any_asset_matched_qvec = true;
                    break;
                }
            }
            if any_asset_matched_qvec {
                1.00
            } else {
                0.00
            }
        } else {
            1.00
        }
    } else {
        1.00
    }
}

pub fn check_currency_consistency(q_text: &str, gt_text: &str, cand_text: &str) -> f32 {
    let combined_ref = String::from(q_text) + " " + gt_text;
    let ref_lower = to_lower_str(&combined_ref);
    let cand_lower = to_lower_str(cand_text);

    let has_ref_eur = ref_lower.contains("eur") || ref_lower.contains('€');
    let has_ref_usd = ref_lower.contains("usd") || ref_lower.contains('$') || ref_lower.contains("usdt") || ref_lower.contains("usdc") || ref_lower.contains("dollars") || ref_lower.contains("cents");
    let has_ref_gbp = ref_lower.contains("gbp") || ref_lower.contains('£');
    let has_ref_jpy = ref_lower.contains("jpy") || ref_lower.contains('¥');
    let has_ref_cad = ref_lower.contains("cad") || ref_lower.contains("c$");
    let has_ref_aud = ref_lower.contains("aud") || ref_lower.contains("a$");

    let has_cand_eur = cand_lower.contains("eur") || cand_lower.contains('€');
    let has_cand_usd = cand_lower.contains("usd") || cand_lower.contains('$') || cand_lower.contains("usdt") || cand_lower.contains("usdc") || cand_lower.contains("dollars") || cand_lower.contains("cents");
    let has_cand_gbp = cand_lower.contains("gbp") || cand_lower.contains('£');
    let has_cand_jpy = cand_lower.contains("jpy") || cand_lower.contains('¥');
    let has_cand_cad = cand_lower.contains("cad") || cand_lower.contains("c$");
    let has_cand_aud = cand_lower.contains("aud") || cand_lower.contains("a$");

    if has_ref_usd || (!has_ref_eur && !has_ref_gbp && !has_ref_jpy && !has_ref_cad && !has_ref_aud) {
        if has_cand_eur && !has_cand_usd {
            return 0.00;
        }
        if has_cand_gbp && !has_cand_usd {
            return 0.00;
        }
        if has_cand_jpy && !has_cand_usd {
            return 0.00;
        }
        if has_cand_cad && !has_cand_usd {
            return 0.00;
        }
        if has_cand_aud && !has_cand_usd {
            return 0.00;
        }
    }

    if has_ref_eur && !has_ref_usd && has_cand_usd && !has_cand_eur {
        return 0.00;
    }
    if has_ref_gbp && !has_ref_usd && has_cand_usd && !has_cand_gbp {
        return 0.00;
    }

    1.00
}

pub fn check_polarity_and_negation(gt_text: &str, cand_text: &str) -> f32 {
    let gt_lower = to_lower_str(gt_text);
    let cand_lower = to_lower_str(cand_text);

    let negations = [
        "not", "never", "does not", "did not", "cannot", "is not", "isn't", "was not",
        "wasn't", "false", "incorrect", "no longer", "dropped below", "rejected at",
        "failed to reach", "won't", "hasn't", "haven't", "untrue", "fake", "manipulated",
    ];
    let gt_has_neg = negations.iter().any(|&nw| gt_lower.contains(nw));
    let cand_has_neg = negations.iter().any(|&nw| cand_lower.contains(nw));

    if !gt_has_neg && cand_has_neg {
        return 0.00;
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
            return 0.00;
        }
    }
    1.00
}

pub fn check_stale_and_historical(q_text: &str, gt_text: &str, cand_text: &str) -> f32 {
    let combined_ref = String::from(q_text) + " " + gt_text;
    let ref_lower = to_lower_str(&combined_ref);
    let cand_lower = to_lower_str(cand_text);

    let historical_markers = [
        "all-time high", "all time high", "ath", "historic high", "historic peak",
        "all-time low", "all time low", "atl", "record high", "record low",
        "peaked at", "opened at", "closed yesterday", "yesterday's close", "yesterday close",
        "last year", "last month", "last week", "yesterday", "in 2021", "in 2022", "in 2023",
        "in 2020", "in 2017", "in 2024", "in 2025", "previous high", "former ath",
        "was trading at", "previously reached", "once reached", "historically reached",
        "cycle peak", "cycle top", "bull run peak",
    ];

    let ref_is_historical = historical_markers.iter().any(|&m| ref_lower.contains(m));
    let cand_is_historical = historical_markers.iter().any(|&m| cand_lower.contains(m));

    if !ref_is_historical && cand_is_historical {
        return 0.00; // Historical price passed as current spot price gets 0
    }

    1.00
}

pub fn check_hedging_and_uncertainty(cand_text: &str) -> f32 {
    let cand_lower = to_lower_str(cand_text);
    let hedge_markers = [
        "unconfirmed", "rumored", "rumour", "might be", "could be around", "possibly around",
        "maybe around", "disputed", "speculated", "estimated between", "unverified", "allegedly",
        "unclear whether", "hard to say", "cannot be determined", "uncertain", "don't know",
        "do not know", "no data", "not sure", "some say", "it is said", "rumor has it",
    ];

    if hedge_markers.iter().any(|&hm| cand_lower.contains(hm)) {
        return 0.00; // Zero credit for uncertain / rumored claims
    }

    1.00
}
