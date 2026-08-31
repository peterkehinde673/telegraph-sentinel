use alloc::vec::Vec;
use alloc::string::String;
use alloc::format;

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
pub enum NumberRole {
    CurrentPrice,
    SecondaryPrice,
    Percentage,
    VolumeOrMcap,
    UnitQuantity,
    NegatedPrice,
}

#[derive(Clone, Copy, Debug, PartialEq)]
pub struct NumberMatch {
    pub value: f64,
    pub role: NumberRole,
    pub is_cents: bool,
    pub associated_asset: Option<&'static str>,
}

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
        "fet" | "asi" | "fetch" | "fetchai" => Some("fet"),
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

pub fn detect_multiword_asset(text_lower: &str) -> Option<&'static str> {
    if text_lower.contains("bitcoin cash") {
        return Some("bch");
    }
    if text_lower.contains("ethereum classic") {
        return Some("etc");
    }
    if text_lower.contains("internet computer") {
        return Some("icp");
    }
    if text_lower.contains("lido dao") {
        return Some("steth");
    }
    if text_lower.contains("fetch.ai") || text_lower.contains("fetch ai") {
        return Some("fet");
    }
    if text_lower.contains("shiba inu") {
        return Some("shib");
    }
    if text_lower.contains("near protocol") {
        return Some("near");
    }
    if text_lower.contains("dogwifhat") {
        return Some("wif");
    }
    None
}

pub fn word_sim_to_q_vec(w: &str, q_vec: &[f32]) -> f32 {
    if q_vec.is_empty() || w.is_empty() {
        return 0.0;
    }
    let enc = crate::tokenizer::tokenize(w);
    let w_vec = crate::embed::run(&enc);
    crate::math::cosine(q_vec, &w_vec)
}

pub fn detect_asset_from_q_vec(q_vec: &[f32]) -> Option<&'static str> {
    if q_vec.is_empty() {
        return None;
    }

    let distinguishing_modifiers: &[(&str, &[&str])] = &[
        ("bch", &["cash", "bitcoincash"]),
        ("etc", &["classic", "ethereumclassic"]),
        ("icp", &["computer", "internetcomputer"]),
        ("steth", &["lido", "ldo"]),
        ("wif", &["dogwifhat", "wif"]),
    ];

    for &(cls, words) in distinguishing_modifiers {
        for &w in words {
            let sim = word_sim_to_q_vec(w, q_vec);
            if sim >= 0.40 {
                return Some(cls);
            }
        }
    }

    let asset_targets: &[(&str, &[&str])] = &[
        ("btc", &["bitcoin", "btc"]),
        ("eth", &["ethereum", "eth"]),
        ("sol", &["solana", "sol"]),
        ("ada", &["cardano", "ada"]),
        ("avax", &["avalanche", "avax"]),
        ("link", &["chainlink", "link"]),
        ("doge", &["dogecoin", "doge"]),
        ("dot", &["polkadot", "dot"]),
        ("near", &["near"]),
        ("xrp", &["ripple", "xrp"]),
        ("xmr", &["monero", "xmr"]),
        ("ltc", &["litecoin", "ltc"]),
        ("shib", &["shiba", "shib"]),
        ("mkr", &["maker", "mkr"]),
        ("arb", &["arbitrum", "arb"]),
        ("op", &["optimism", "op"]),
        ("sui", &["sui"]),
        ("tia", &["celestia", "tia"]),
        ("inj", &["injective", "inj"]),
        ("kas", &["kaspa", "kas"]),
        ("trx", &["tron", "trx"]),
        ("ton", &["toncoin", "ton"]),
        ("algo", &["algorand", "algo"]),
        ("vet", &["vechain", "vet"]),
        ("xlm", &["stellar", "xlm"]),
        ("ftm", &["fantom", "ftm"]),
        ("rune", &["thorchain", "rune"]),
        ("sei", &["sei"]),
        ("strk", &["starknet", "strk"]),
        ("wld", &["worldcoin", "wld"]),
        ("ena", &["ethena", "ena"]),
        ("ondo", &["ondo"]),
        ("pendle", &["pendle"]),
        ("bonk", &["bonk"]),
        ("floki", &["floki"]),
        ("jup", &["jupiter", "jup"]),
        ("pyth", &["pyth"]),
        ("fet", &["fet", "asi"]),
        ("comp", &["compound", "comp"]),
        ("sushi", &["sushi"]),
    ];

    let mut best_sim = -1.0f32;
    let mut best_cls = None;

    for &(cls, words) in asset_targets {
        for &w in words {
            let sim = word_sim_to_q_vec(w, q_vec);
            if sim > best_sim {
                best_sim = sim;
                best_cls = Some(cls);
            }
        }
    }

    if best_sim >= 0.40 {
        best_cls
    } else {
        None
    }
}

pub fn is_exchange_or_platform(word: &str) -> bool {
    matches!(
        word,
        "binance" | "coinbase" | "kraken" | "okx" | "bybit" | "gate" | "kucoin"
            | "mexc" | "bitfinex" | "gemini" | "bitget" | "crypto.com" | "robinhood"
            | "raydium" | "aerodrome" | "uniswap" | "sushiswap" | "pancakeswap"
    )
}

#[inline]
fn is_currency_symbol(c: char) -> bool {
    c == '$' || c == '€' || c == '£' || c == '¥' || c == '₩' || c == '₹' || c == '₦' || c == '¢'
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
        let is_curr_sym = is_currency_symbol(c);
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
                    i += 1;
                } else {
                    break;
                }
            }

            if num_str.is_empty() {
                continue;
            }

            let prefix_window: String = if start_idx > 0 {
                let p_start = start_idx.saturating_sub(45);
                lower_chars[p_start..start_idx].iter().collect()
            } else {
                String::new()
            };

            let mut associated_asset: Option<&'static str> = None;
            if let Some(multi) = detect_multiword_asset(&prefix_window) {
                associated_asset = Some(multi);
            } else {
                let p_words = extract_words(&prefix_window);
                for w in p_words.iter().rev() {
                    if is_exchange_or_platform(w) {
                        continue;
                    }
                    if let Some(cls) = get_canonical_asset_class(w) {
                        if cls != "usdt" && cls != "usdc" {
                            associated_asset = Some(cls);
                            break;
                        }
                    }
                }
            }

            // 1. Ranking / Ordinal / Block prefixes
            let is_rank_or_block = prefix_window.ends_with('#')
                || prefix_window.ends_with("rank ")
                || prefix_window.ends_with("ranked ")
                || prefix_window.ends_with("rank #")
                || prefix_window.ends_with("ranked #")
                || prefix_window.ends_with("no. ")
                || prefix_window.ends_with("top ")
                || prefix_window.ends_with("block ")
                || prefix_window.ends_with("block #")
                || prefix_window.ends_with("height ")
                || prefix_window.ends_with("epoch ");

            if is_rank_or_block {
                continue;
            }

            // 2. Exact Clock Times check
            let is_clock_time = !has_prefix_curr && start_idx >= 2 && chars[start_idx - 1] == ':' && is_digit(chars[start_idx - 2]);
            if is_clock_time {
                continue;
            }

            // 3. Calendar Year
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

            // 4. Date Days: "August 30", "Aug 30"
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

            // --- CONTEXT INSPECTION AFTER NUMBER (suffix window) ---
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

            let suffix_window: String = if j < len {
                let s_end = (j + 45).min(len);
                lower_chars[j..s_end].iter().collect()
            } else {
                String::new()
            };

            if j < len {
                let rem: String = lower_chars[j..].iter().collect();

                if rem.starts_with('%') || rem.starts_with("percent") || rem.starts_with("pct") {
                    is_pct = true;
                } else if rem.starts_with("bps") || rem.starts_with("basis points") {
                    is_pct = true;
                    multiplier = 0.01;
                } else if (rem.starts_with('h') && !rem.starts_with("hbar"))
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
                } else if rem.starts_with("cents") || rem.starts_with("cent") || rem.starts_with('¢')
                    || (rem.starts_with('c') && (rem.len() == 1 || !is_alpha(rem.chars().nth(1).unwrap_or(' '))))
                {
                    is_cents = true;
                    multiplier = 0.01;
                } else if rem.starts_with("trillion") || (rem.starts_with('t') && (rem.len() == 1 || !is_alpha(rem.chars().nth(1).unwrap_or(' ')))) {
                    multiplier = 1_000_000_000_000.0;
                    is_vol_or_mcap = true;
                } else if rem.starts_with("billion") || (rem.starts_with('b') && (rem.len() == 1 || !is_alpha(rem.chars().nth(1).unwrap_or(' ')))) {
                    multiplier = 1_000_000_000.0;
                    is_vol_or_mcap = true;
                } else if rem.starts_with("million") || (rem.starts_with('m') && (rem.len() == 1 || !is_alpha(rem.chars().nth(1).unwrap_or(' ')))) {
                    multiplier = 1_000_000.0;
                    let imm_s = if rem.len() > 25 { &rem[..25] } else { &rem };
                    let imm_p = if prefix_window.len() > 20 { &prefix_window[prefix_window.len() - 20..] } else { &prefix_window };
                    if imm_p.contains("vol") || imm_p.contains("cap") || imm_p.contains("supply")
                        || imm_s.contains("vol") || imm_s.contains("cap") || imm_s.contains("supply") || imm_s.contains("circulat") {
                        is_vol_or_mcap = true;
                    }
                } else if rem.starts_with("thousand") || (rem.starts_with('k') && (rem.len() == 1 || !is_alpha(rem.chars().nth(1).unwrap_or(' ')))) {
                    multiplier = 1_000.0;
                } else {
                    for m in &month_names {
                        if rem.starts_with(m) {
                            is_date_day = true;
                            break;
                        }
                    }
                }

                if !has_prefix_curr && (rem.starts_with("btc") || rem.starts_with("bitcoin")
                    || rem.starts_with("eth") || rem.starts_with("ether")
                    || rem.starts_with("sol") || rem.starts_with("solana")
                    || rem.starts_with("doge") || rem.starts_with("ada")
                    || rem.starts_with("token") || rem.starts_with("coin")
                    || rem.starts_with("unit") || rem.starts_with("sat") || rem.starts_with("satoshi"))
                {
                    is_unit_count = true;
                }
            }

            if is_timeframe || is_date_day {
                continue;
            }

            let imm_p_check = if prefix_window.len() > 18 {
                &prefix_window[prefix_window.len() - 18..]
            } else {
                &prefix_window
            };
            if imm_p_check.ends_with("volume ")
                || imm_p_check.ends_with("vol ")
                || imm_p_check.ends_with("vol: ")
                || imm_p_check.ends_with("mcap ")
                || imm_p_check.ends_with("market cap ")
                || imm_p_check.ends_with("supply ")
                || imm_p_check.ends_with("circulating supply ")
                || imm_p_check.ends_with("tvl ")
                || imm_p_check.ends_with("liquidity ")
                || imm_p_check.ends_with("fdv ")
            {
                is_vol_or_mcap = true;
            }

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

            if is_unit_count && (final_val >= 1.0 && final_val <= 1000000.0) && !has_prefix_curr {
                nums.push(NumberMatch {
                    value: final_val,
                    role: NumberRole::UnitQuantity,
                    is_cents,
                    associated_asset,
                });
                continue;
            }

            let clean_prefix = prefix_window
                .replace("not financial advice", "")
                .replace("not guaranteed", "")
                .replace("not an endorsement", "");

            let has_negation = clean_prefix.contains("not ")
                || clean_prefix.contains("not $")
                || clean_prefix.contains("isn't ")
                || clean_prefix.contains("wasn't ")
                || clean_prefix.contains("no longer ")
                || clean_prefix.contains("never ")
                || clean_prefix.contains("rejected at ")
                || clean_prefix.contains("dropped below ")
                || clean_prefix.contains("failed to reach ");

            let imm_p = if clean_prefix.len() > 25 {
                &clean_prefix[clean_prefix.len() - 25..]
            } else {
                &clean_prefix
            };

            let imm_s = if suffix_window.len() > 30 {
                &suffix_window[..30]
            } else {
                &suffix_window
            };

            let has_past_marker = imm_p.contains("ath")
                || imm_p.contains("all-time high")
                || imm_p.contains("all time high")
                || imm_p.contains("peak")
                || imm_p.contains("record high")
                || imm_p.contains("atl")
                || imm_p.contains("all-time low")
                || imm_p.contains("all time low")
                || imm_p.contains("24h high")
                || imm_p.contains("24h low")
                || imm_p.contains("24-hour high")
                || imm_p.contains("24-hour low")
                || imm_p.contains("day high")
                || imm_p.contains("day low")
                || imm_p.contains("52w")
                || imm_p.contains("high of")
                || imm_p.contains("low of")
                || imm_p.contains("high:")
                || imm_p.contains("low:")
                || imm_p.contains("opened at")
                || imm_p.contains("closed at")
                || imm_p.contains("open:")
                || imm_p.contains("close:")
                || imm_p.contains("yesterday was")
                || imm_p.contains("yesterday at")
                || imm_p.contains("yesterday")
                || imm_p.contains("was trading at")
                || imm_p.contains("was previously")
                || imm_p.contains("previously reached")
                || imm_p.contains("previously touched")
                || imm_p.contains("previously hit")
                || imm_p.contains("previously at")
                || imm_p.contains("previously was")
                || imm_p.contains("previous was")
                || imm_p.contains("previous price")
                || imm_p.contains("prior was")
                || imm_p.contains("prior price")
                || imm_p.contains("earlier was")
                || imm_p.contains("was earlier")
                || imm_p.ends_with("was ")
                || imm_p.ends_with("was $")
                || imm_s.starts_with(" earlier")
                || imm_s.starts_with(" previously")
                || imm_s.starts_with(" was reported earlier")
                || imm_s.contains("reported earlier");

            let role = if is_pct {
                NumberRole::Percentage
            } else if is_vol_or_mcap {
                NumberRole::VolumeOrMcap
            } else if has_negation {
                NumberRole::NegatedPrice
            } else if has_past_marker {
                NumberRole::SecondaryPrice
            } else {
                NumberRole::CurrentPrice
            };

            nums.push(NumberMatch {
                value: final_val,
                role,
                is_cents,
                associated_asset,
            });
        } else {
            i += 1;
        }
    }
    nums
}

pub fn check_numeric_consistency_with_target(gt_text: &str, cand_text: &str, target_asset: Option<&'static str>, q_vec: &[f32]) -> f32 {
    let gt_all = parse_numbers(gt_text);
    if gt_all.is_empty() {
        return 1.0;
    }

    let gt_prices: Vec<NumberMatch> = gt_all.iter().filter(|n| n.role == NumberRole::CurrentPrice).copied().collect();
    let gt_nums: Vec<NumberMatch> = if !gt_prices.is_empty() {
        gt_prices
    } else {
        let pcts: Vec<NumberMatch> = gt_all.iter().filter(|n| n.role == NumberRole::Percentage).copied().collect();
        if !pcts.is_empty() {
            pcts
        } else {
            gt_all
        }
    };

    if gt_nums.is_empty() {
        return 1.0;
    }

    let cand_all = parse_numbers(cand_text);
    let cand_prices: Vec<NumberMatch> = cand_all.iter().filter(|n| n.role == NumberRole::CurrentPrice).copied().collect();

    let mut resolved_cand_prices = cand_prices;
    if resolved_cand_prices.is_empty() {
        let units: Vec<NumberMatch> = cand_all.iter().filter(|n| n.role == NumberRole::UnitQuantity).copied().collect();
        let secondaries: Vec<NumberMatch> = cand_all.iter().filter(|n| n.role == NumberRole::SecondaryPrice).copied().collect();
        let all_raw_prices: Vec<NumberMatch> = cand_all.iter().filter(|n| n.role != NumberRole::Percentage && n.role != NumberRole::VolumeOrMcap && n.role != NumberRole::UnitQuantity && n.role != NumberRole::NegatedPrice).copied().collect();

        if !units.is_empty() && !all_raw_prices.is_empty() {
            let u_val = units[0].value;
            let p_val = all_raw_prices[0].value;
            if u_val > 1.0 {
                resolved_cand_prices.push(NumberMatch {
                    value: p_val / u_val,
                    role: NumberRole::CurrentPrice,
                    is_cents: false,
                    associated_asset: all_raw_prices[0].associated_asset,
                });
            }
        } else if resolved_cand_prices.is_empty() && !secondaries.is_empty() {
            return 0.00;
        }
    }

    let cand_nums: Vec<NumberMatch> = if !resolved_cand_prices.is_empty() {
        resolved_cand_prices
    } else {
        let pcts: Vec<NumberMatch> = cand_all.iter().filter(|n| n.role == NumberRole::Percentage).copied().collect();
        if !pcts.is_empty() {
            pcts
        } else {
            cand_all.iter().filter(|n| n.role != NumberRole::NegatedPrice && n.role != NumberRole::VolumeOrMcap && n.role != NumberRole::UnitQuantity).copied().collect()
        }
    };

    if cand_nums.is_empty() {
        return 0.0;
    }

    let mut total_score = 0.0;
    let mut matching_indices = Vec::new();

    for gn in &gt_nums {
        let mut best_match: f64 = 0.0;
        let mut best_idx = None;

        for (idx, cn) in cand_nums.iter().enumerate() {
            if let Some(target) = target_asset {
                if let Some(cand_asset) = cn.associated_asset {
                    if cand_asset != target && cand_asset != "usdt" && cand_asset != "usdc" {
                        continue;
                    }
                }
            } else if !q_vec.is_empty() {
                if let Some(cand_asset) = cn.associated_asset {
                    let sim = word_sim_to_q_vec(cand_asset, q_vec);
                    if sim < 0.15 && get_canonical_asset_class(cand_asset).is_some() {
                        continue;
                    }
                }
            }

            let diff = if gn.value > cn.value { gn.value - cn.value } else { cn.value - gn.value };
            let max_v = if gn.value > cn.value { gn.value } else { gn.value };
            let rel_diff = if max_v > 0.0 { diff / max_v } else { diff };

            let match_score = if rel_diff <= 0.003 {
                1.00
            } else if rel_diff <= 0.008 {
                1.00 - 200.0 * (rel_diff - 0.003)
            } else {
                0.00
            };

            if match_score > best_match {
                best_match = match_score;
                best_idx = Some(idx);
            }
        }
        total_score += best_match;
        if let Some(idx) = best_idx {
            matching_indices.push(idx);
        }
    }

    let score = (total_score / (gt_nums.len() as f64)) as f32;
    if score <= 0.01 {
        return 0.0;
    }

    if cand_nums.len() > gt_nums.len() {
        let cand_lower = to_lower_str(cand_text);

        if cand_nums.len() == 2 && (cand_lower.contains("between") || cand_lower.contains(" to ") || cand_lower.contains('-')) {
            let p1 = cand_nums[0].value;
            let p2 = cand_nums[1].value;
            let range_min = if p1 < p2 { p1 } else { p2 };
            let range_max = if p1 > p2 { p1 } else { p2 };
            let spread = if range_max > 0.0 { (range_max - range_min) / range_max } else { 0.0 };

            if spread > 0.04 {
                return 0.00;
            }
        }

        let mut conflicting_claims = 0;
        for (idx, cn) in cand_nums.iter().enumerate() {
            if !matching_indices.contains(&idx) {
                if let Some(target) = target_asset {
                    if let Some(cand_asset) = cn.associated_asset {
                        if cand_asset != target && cand_asset != "usdt" && cand_asset != "usdc" {
                            continue;
                        }
                    }
                }

                for gn in &gt_nums {
                    let diff = if gn.value > cn.value { gn.value - cn.value } else { cn.value - gn.value };
                    let max_v = if gn.value > cn.value { gn.value } else { gn.value };
                    let rel_diff = if max_v > 0.0 { diff / max_v } else { diff };
                    if rel_diff > 0.008 {
                        conflicting_claims += 1;
                    }
                }
            }
        }

        if conflicting_claims > 0 {
            if cand_lower.contains("or ")
                || cand_lower.contains("actually")
                || cand_lower.contains("instead")
                || cand_lower.contains("but now")
                || cand_lower.contains("rather than")
                || cand_lower.contains("maybe")
                || cand_lower.contains("perhaps")
                || cand_lower.contains("dropped to")
                || cand_lower.contains("crashed to")
                || cand_lower.contains("surged to")
                || cand_lower.contains("updated to")
            {
                return 0.00;
            }
        }
    }

    score
}

pub fn extract_words(text: &str) -> Vec<String> {
    let mut words = Vec::new();
    let mut cur = String::new();
    for c in text.chars() {
        if is_alpha(c) || is_digit(c) {
            cur.push(to_lower(c));
        } else if !cur.is_empty() {
            words.push(cur);
            cur = String::new();
        }
    }
    if !cur.is_empty() {
        words.push(cur);
    }
    words
}

pub fn extract_raw_tokens(text: &str) -> Vec<String> {
    let mut tokens = Vec::new();
    let mut cur = String::new();
    for c in text.chars() {
        if is_alpha(c) || is_digit(c) || c == '.' || c == '-' {
            cur.push(c);
        } else if !cur.is_empty() {
            tokens.push(cur);
            cur = String::new();
        }
    }
    if !cur.is_empty() {
        tokens.push(cur);
    }
    tokens
}

pub fn is_common_query_word(w: &str) -> bool {
    matches!(
        w,
        "what" | "is" | "the" | "price" | "of" | "spot" | "current" | "currently"
            | "now" | "today" | "how" | "much" | "in" | "usd" | "token" | "coin"
            | "rate" | "value" | "worth" | "at" | "for" | "a" | "an" | "and"
            | "to" | "live" | "latest" | "2024" | "2025" | "2026"
            | "can" | "you" | "tell" | "me" | "right" | "please" | "give" | "check"
    )
}

pub fn check_entity_consistency(q_text: &str, gt_text: &str, cand_text: &str, q_vec: &[f32]) -> f32 {
    let cand_lower = to_lower_str(cand_text);
    let cand_words = extract_words(cand_text);

    // 1. Text-based target asset resolution
    let target_class = if !q_text.is_empty() || !gt_text.is_empty() {
        let combined = format!("{} {}", q_text, gt_text);
        let lower = to_lower_str(&combined);
        if let Some(multi) = detect_multiword_asset(&lower) {
            Some(multi)
        } else {
            let mut found = None;
            for w in extract_words(gt_text) {
                if let Some(cls) = get_canonical_asset_class(&w) {
                    found = Some(cls);
                    break;
                }
            }
            if found.is_none() {
                for w in extract_words(q_text) {
                    if let Some(cls) = get_canonical_asset_class(&w) {
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

    let resolved_target = match target_class {
        Some(cls) => Some(cls),
        None => detect_asset_from_q_vec(q_vec),
    };

    if let Some(target) = resolved_target {
        let cand_multi = detect_multiword_asset(&cand_lower);

        let mut cand_has_target = false;
        let mut cand_has_competing = false;

        if let Some(multi) = cand_multi {
            if multi == target {
                cand_has_target = true;
            } else {
                cand_has_competing = true;
            }
        } else {
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
        }

        if cand_has_target {
            return 1.00;
        } else if cand_has_competing {
            return 0.00;
        } else {
            return 1.00;
        }
    }

    // 2. Dynamic unlisted asset extraction (when q_text is present)
    if !q_text.is_empty() {
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
    }

    // 3. Universal Vector-based Dynamic Asset Disambiguation (Cached Mode when q_text is empty)
    if !q_vec.is_empty() {
        let mut cand_tokens: Vec<String> = Vec::new();
        for cw in &cand_words {
            if is_common_query_word(cw) || is_exchange_or_platform(cw) || cw.len() < 2 {
                continue;
            }
            if !cand_tokens.iter().any(|t| t == cw) {
                cand_tokens.push(cw.clone());
            }
        }

        let mut has_query_token_match = false;
        let mut has_unrelated_known_asset = false;

        for tok in &cand_tokens {
            let sim = word_sim_to_q_vec(tok, q_vec);
            if sim >= 0.35 {
                has_query_token_match = true;
                break;
            } else if sim < 0.15 {
                if let Some(cls) = get_canonical_asset_class(tok) {
                    if cls != "usdt" && cls != "usdc" {
                        has_unrelated_known_asset = true;
                    }
                }
            }
        }

        if has_query_token_match {
            return 1.00;
        } else if has_unrelated_known_asset {
            return 0.00;
        }
    }

    1.00
}

pub fn check_currency_consistency(q_text: &str, gt_text: &str, cand_text: &str, _q_vec: &[f32]) -> f32 {
    let combined_ref = format!("{} {}", q_text, gt_text);
    let ref_lower = to_lower_str(&combined_ref);
    let cand_lower = to_lower_str(cand_text);

    let has_ref_eur = ref_lower.contains("eur") || ref_lower.contains('€') || ref_lower.contains("euros");
    let has_ref_gbp = ref_lower.contains("gbp") || ref_lower.contains('£') || ref_lower.contains("pounds");
    let has_ref_jpy = ref_lower.contains("jpy") || ref_lower.contains('¥') || ref_lower.contains("yen");
    let has_ref_cad = ref_lower.contains("cad") || ref_lower.contains("c$");
    let has_ref_aud = ref_lower.contains("aud") || ref_lower.contains("a$");
    let has_ref_ngn = ref_lower.contains("ngn") || ref_lower.contains("naira") || ref_lower.contains('₦');
    let has_ref_usd = ref_lower.contains("usd") || ref_lower.contains('$') || ref_lower.contains("usdt") || ref_lower.contains("usdc") || ref_lower.contains("dollars") || ref_lower.contains("cents");

    let has_cand_eur = cand_lower.contains("eur") || cand_lower.contains('€') || cand_lower.contains("euros");
    let has_cand_gbp = cand_lower.contains("gbp") || cand_lower.contains('£') || cand_lower.contains("pounds");
    let has_cand_jpy = cand_lower.contains("jpy") || cand_lower.contains('¥') || cand_lower.contains("yen");
    let has_cand_cad = cand_lower.contains("cad") || cand_lower.contains("c$");
    let has_cand_aud = cand_lower.contains("aud") || cand_lower.contains("a$");
    let has_cand_ngn = cand_lower.contains("ngn") || cand_lower.contains("naira") || cand_lower.contains('₦');
    let has_cand_usd = cand_lower.contains("usd") || cand_lower.contains('$') || cand_lower.contains("usdt") || cand_lower.contains("usdc") || cand_lower.contains("dollars") || cand_lower.contains("cents");

    if has_ref_usd || (!has_ref_eur && !has_ref_gbp && !has_ref_jpy && !has_ref_cad && !has_ref_aud && !has_ref_ngn) {
        if (has_cand_eur || has_cand_gbp || has_cand_jpy || has_cand_cad || has_cand_aud || has_cand_ngn) && !has_cand_usd {
            return 0.00;
        }
    }

    if has_ref_eur && !has_ref_usd && has_cand_usd && !has_cand_eur {
        return 0.00;
    }
    if has_ref_gbp && !has_ref_usd && has_cand_usd && !has_cand_gbp {
        return 0.00;
    }
    if has_ref_ngn && !has_ref_usd && has_cand_usd && !has_cand_ngn {
        return 0.00;
    }
    if has_ref_jpy && !has_ref_usd && has_cand_usd && !has_cand_jpy {
        return 0.00;
    }

    1.00
}

pub fn check_polarity_and_negation(gt_text: &str, cand_text: &str) -> f32 {
    let gt_lower = to_lower_str(gt_text);
    let cand_lower = to_lower_str(cand_text);

    let sanitized_cand = cand_lower
        .replace("not financial advice", "")
        .replace("not an endorsement", "")
        .replace("not guaranteed", "")
        .replace("not liable", "")
        .replace("not responsible", "")
        .replace("do not invest", "");

    let direct_negations = [
        "is not", "isn't", "was not", "wasn't", "no longer", "false", "incorrect",
        "dropped below", "rejected at", "failed to reach", "untrue", "fake",
        "definitely not", "certainly not", "absolutely not",
    ];

    let gt_has_neg = direct_negations.iter().any(|&nw| gt_lower.contains(nw));
    let cand_has_neg = direct_negations.iter().any(|&nw| sanitized_cand.contains(nw));

    let pairs = [
        ("yes", "no"), ("true", "false"), ("up", "down"), ("higher", "lower"),
        ("increase", "decrease"), ("bullish", "bearish"), ("passed", "rejected"),
        ("passed", "failed"), ("approved", "rejected"), ("success", "failed"),
    ];

    for (pos, neg) in pairs {
        let gt_has_pos = gt_lower.contains(pos);
        let gt_has_neg_pair = gt_lower.contains(neg);
        let cand_has_pos = sanitized_cand.contains(pos);
        let cand_has_neg_pair = sanitized_cand.contains(neg);

        if (gt_has_pos && !gt_has_neg_pair && cand_has_neg_pair && !cand_has_pos)
            || (gt_has_neg_pair && !gt_has_pos && cand_has_pos && !cand_has_neg_pair)
        {
            return 0.00;
        }
    }

    if !gt_has_neg && cand_has_neg {
        if sanitized_cand.contains("is not")
            || sanitized_cand.contains("isn't")
            || sanitized_cand.contains("was not")
            || sanitized_cand.contains("wasn't")
            || sanitized_cand.contains("no longer")
            || sanitized_cand.contains("incorrect")
            || sanitized_cand.contains("false")
            || sanitized_cand.contains("untrue")
            || sanitized_cand.contains("definitely not")
            || sanitized_cand.contains("certainly not")
            || sanitized_cand.contains("not $")
        {
            return 0.00;
        }
    }

    1.00
}

pub fn check_stale_and_historical(q_text: &str, gt_text: &str, cand_text: &str) -> f32 {
    let combined_ref = format!("{} {}", q_text, gt_text);
    let ref_lower = to_lower_str(&combined_ref);
    let cand_lower = to_lower_str(cand_text);

    let historical_markers = [
        "all-time high", "all time high", "ath", "historic high", "historic peak",
        "all-time low", "all time low", "atl", "record high", "record low",
    ];

    let ref_is_historical = historical_markers.iter().any(|&m| ref_lower.contains(m));
    let cand_is_historical = historical_markers.iter().any(|&m| cand_lower.contains(m));

    if ref_is_historical && !cand_is_historical {
        return 0.00;
    }

    1.00
}

pub fn check_hedging_and_uncertainty(cand_text: &str) -> f32 {
    let cand_lower = to_lower_str(cand_text);
    let hedge_markers = [
        "unconfirmed", "rumored", "rumour", "disputed", "speculated",
        "unverified", "allegedly", "hard to say", "cannot be determined",
        "don't know", "do not know", "no data", "not sure", "rumor has it",
    ];

    for marker in hedge_markers {
        if cand_lower.contains(marker) {
            return 0.20;
        }
    }

    1.00
}
