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

// Canonical asset aliases across all major/mid-cap cryptocurrencies
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

// Find multi-word asset combinations (e.g. "bitcoin cash" -> "bch", "ethereum classic" -> "etc")
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
    None
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

            // --- CONTEXT INSPECTION BEFORE NUMBER (prefix window) ---
            let prefix_window: String = if start_idx > 0 {
                let p_start = start_idx.saturating_sub(40);
                lower_chars[p_start..start_idx].iter().collect()
            } else {
                String::new()
            };

            // Detect associated asset in the immediate prefix window (e.g. "Bitcoin is $65,400" -> btc)
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

            // 1. Check for Ranking / Ordinal prefixes: "#", "rank #", "rank ", "ranked ", "no. ", "top "
            let is_rank = prefix_window.ends_with('#')
                || prefix_window.ends_with("rank ")
                || prefix_window.ends_with("ranked ")
                || prefix_window.ends_with("rank #")
                || prefix_window.ends_with("ranked #")
                || prefix_window.ends_with("no. ")
                || prefix_window.ends_with("top ")
                || prefix_window.ends_with("block ");

            if is_rank {
                continue;
            }

            // 2. Check for Clock Times: "14:00", "05:30:00"
            if i < len && chars[i] == ':' && i + 2 < len && is_digit(chars[i + 1]) && is_digit(chars[i + 2]) {
                i += 3;
                if i < len && chars[i] == ':' && i + 2 < len && is_digit(chars[i + 1]) && is_digit(chars[i + 2]) {
                    i += 3;
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
                let s_end = (j + 40).min(len);
                lower_chars[j..s_end].iter().collect()
            } else {
                String::new()
            };

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
                // Suffix Multipliers: k, m, b, t
                else if rem.starts_with("trillion") || (rem.starts_with('t') && (rem.len() == 1 || !is_alpha(rem.chars().nth(1).unwrap_or(' ')))) {
                    multiplier = 1_000_000_000_000.0;
                    is_vol_or_mcap = true;
                } else if rem.starts_with("billion") || (rem.starts_with('b') && (rem.len() == 1 || !is_alpha(rem.chars().nth(1).unwrap_or(' ')))) {
                    multiplier = 1_000_000_000.0;
                    is_vol_or_mcap = true;
                } else if rem.starts_with("million") || (rem.starts_with('m') && (rem.len() == 1 || !is_alpha(rem.chars().nth(1).unwrap_or(' ')))) {
                    multiplier = 1_000_000.0;
                    if prefix_window.contains("vol") || prefix_window.contains("cap") || rem.contains("vol") || rem.contains("cap") || prefix_window.contains("supply") {
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

                // Check for unit-count tokens, e.g. "1 BTC", "100 DOGE"
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

            // Check if context contains explicit volume/mcap/supply indicators
            if prefix_window.contains("volume")
                || prefix_window.contains("24h vol")
                || prefix_window.contains("vol:")
                || prefix_window.contains("mcap")
                || prefix_window.contains("market cap")
                || prefix_window.contains("capitalization")
                || prefix_window.contains("tvl")
                || prefix_window.contains("supply")
                || prefix_window.contains("liquidity")
                || prefix_window.contains("fdv")
            {
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
            if is_unit_count && (final_val == 1.0 || final_val == 10.0 || final_val == 100.0) && !has_prefix_curr {
                nums.push(NumberMatch {
                    value: final_val,
                    role: NumberRole::UnitQuantity,
                    is_cents,
                    associated_asset,
                });
                continue;
            }

            // Sanitize disclaimers from prefix before negation check
            let clean_prefix = prefix_window
                .replace("not financial advice", "")
                .replace("not guaranteed", "");

            let has_negation = clean_prefix.contains("not ")
                || clean_prefix.contains("not $")
                || clean_prefix.contains("isn't ")
                || clean_prefix.contains("wasn't ")
                || clean_prefix.contains("no longer ")
                || clean_prefix.contains("never ")
                || clean_prefix.contains("rejected at ")
                || clean_prefix.contains("dropped below ")
                || clean_prefix.contains("failed to reach ");

            let mut has_past_or_secondary = prefix_window.contains("ath")
                || prefix_window.contains("all-time high")
                || prefix_window.contains("all time high")
                || prefix_window.contains("peak")
                || prefix_window.contains("record high")
                || prefix_window.contains("atl")
                || prefix_window.contains("all-time low")
                || prefix_window.contains("all time low")
                || prefix_window.contains("24h high")
                || prefix_window.contains("24h low")
                || prefix_window.contains("24-hour high")
                || prefix_window.contains("24-hour low")
                || prefix_window.contains("day high")
                || prefix_window.contains("day low")
                || prefix_window.contains("daily high")
                || prefix_window.contains("daily low")
                || prefix_window.contains("52w")
                || prefix_window.contains("52-week")
                || prefix_window.contains("high of")
                || prefix_window.contains("low of")
                || prefix_window.contains("high:")
                || prefix_window.contains("low:")
                || prefix_window.contains("opened at")
                || prefix_window.contains("closed at")
                || prefix_window.contains("open:")
                || prefix_window.contains("close:")
                || prefix_window.contains("yesterday was")
                || prefix_window.contains("yesterday at")
                || prefix_window.contains("was trading at")
                || prefix_window.contains("was previously")
                || prefix_window.contains("previously reached")
                || prefix_window.contains("previously touched")
                || prefix_window.contains("previously hit")
                || prefix_window.contains("previously at")
                || prefix_window.contains("previously was")
                || prefix_window.contains("previous was")
                || prefix_window.contains("previous price")
                || prefix_window.contains("prior was")
                || prefix_window.contains("prior price")
                || prefix_window.contains("earlier was")
                || prefix_window.contains("was earlier")
                || prefix_window.contains("formerly at")
                || prefix_window.contains("in the past")
                || prefix_window.contains("support at")
                || prefix_window.contains("resistance at")
                || prefix_window.contains("target of")
                || suffix_window.contains("was reported earlier")
                || suffix_window.contains("reported earlier")
                || suffix_window.contains("earlier today")
                || suffix_window.contains("was earlier")
                || suffix_window.contains("was previously");

            let immediate_prefix = if prefix_window.len() > 20 {
                &prefix_window[prefix_window.len() - 20..]
            } else {
                &prefix_window
            };
            if (immediate_prefix.contains("current")
                || immediate_prefix.contains("spot")
                || immediate_prefix.contains("now is")
                || immediate_prefix.contains("now at")
                || immediate_prefix.contains("currently")
                || immediate_prefix.contains("is trading at")
                || immediate_prefix.contains("is $")
                || immediate_prefix.contains("is at"))
                && !immediate_prefix.contains("was ")
                && !immediate_prefix.contains("earlier")
                && !immediate_prefix.contains("previous")
                && !prefix_window.contains("was trading at")
                && !prefix_window.contains("was previously")
            {
                has_past_or_secondary = false;
            }

            // Determine Number Role based on prefix and context:
            let role = if is_pct {
                NumberRole::Percentage
            } else if is_vol_or_mcap {
                NumberRole::VolumeOrMcap
            } else if has_negation {
                NumberRole::NegatedPrice
            } else if has_past_or_secondary {
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

pub fn check_numeric_consistency_with_target(gt_text: &str, cand_text: &str, target_asset: Option<&'static str>) -> f32 {
    let gt_all = parse_numbers(gt_text);
    if gt_all.is_empty() {
        return 1.0;
    }

    // In CRYPTO_PRICE intent, price numbers are the authoritative target.
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

    // Check for unit conversions (e.g. "100 DOGE = $10.00" -> unit price $0.10)
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
            // Check if candidate ONLY gave ATH or secondary price when GT was a current spot price
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
            cand_all.iter().filter(|n| n.role != NumberRole::NegatedPrice).copied().collect()
        }
    };

    if cand_nums.is_empty() {
        return 0.0; // Missing price for a factual price query is zero score
    }

    let mut total_score = 0.0;
    let mut matching_indices = Vec::new();

    for gn in &gt_nums {
        let mut best_match: f64 = 0.0;
        let mut best_idx = None;

        for (idx, cn) in cand_nums.iter().enumerate() {
            // If target asset is known and this candidate number was explicitly attached to a competing asset, skip it
            if let Some(target) = target_asset {
                if let Some(cand_asset) = cn.associated_asset {
                    if cand_asset != target && cand_asset != "usdt" && cand_asset != "usdc" {
                        continue;
                    }
                }
            }

            let diff = if gn.value > cn.value { gn.value - cn.value } else { cn.value - gn.value };
            let max_v = if gn.value > cn.value { gn.value } else { gn.value };
            let rel_diff = if max_v > 0.0 { diff / max_v } else { diff };

            // Calibrated continuous price error curve:
            // <= 0.8% error: 1.00 (covers exchange spread/rounding: $65,400 vs $65,400.25)
            // 0.8% - 2.0% error: 1.00 -> 0.80
            // 2.0% - 3.5% error: 0.80 -> 0.00
            // > 3.5% error: 0.00 (factual failure on spot crypto price)
            let match_score = if rel_diff <= 0.008 {
                1.00
            } else if rel_diff <= 0.020 {
                1.00 - 16.666 * (rel_diff - 0.008)
            } else if rel_diff <= 0.035 {
                0.80 * exp(-15000.0 * (rel_diff - 0.020) * (rel_diff - 0.020))
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

    // Check if candidate contains multiple contradictory current prices or broad fake ranges
    if cand_nums.len() > gt_nums.len() {
        let cand_lower = to_lower_str(cand_text);

        // Check if candidate is a price range like "between $A and $B"
        if cand_nums.len() == 2 && (cand_lower.contains("between") || cand_lower.contains("to") || cand_lower.contains('-')) {
            let p1 = cand_nums[0].value;
            let p2 = cand_nums[1].value;
            let range_min = if p1 < p2 { p1 } else { p2 };
            let range_max = if p1 > p2 { p1 } else { p2 };
            let spread = if range_max > 0.0 { (range_max - range_min) / range_max } else { 0.0 };

            // If range spread is wider than 4% (e.g. "$10,000 to $20,000"), fail it
            if spread > 0.04 {
                return 0.00;
            }
        }

        // Check for conflicting alternative price assertions
        let mut conflicting_claims = 0;
        for (idx, cn) in cand_nums.iter().enumerate() {
            if !matching_indices.contains(&idx) {
                for gn in &gt_nums {
                    let diff = if gn.value > cn.value { gn.value - cn.value } else { cn.value - gn.value };
                    let max_v = if gn.value > cn.value { gn.value } else { gn.value };
                    let rel_diff = if max_v > 0.0 { diff / max_v } else { diff };
                    if rel_diff > 0.035 {
                        conflicting_claims += 1;
                    }
                }
            }
        }

        if conflicting_claims > 0 {
            // If candidate presents multiple contradictory current prices with different values
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

    if score < 0.01 {
        0.0
    } else {
        score
    }
}

#[allow(dead_code)]
pub fn check_numeric_consistency(gt_text: &str, cand_text: &str) -> f32 {
    check_numeric_consistency_with_target(gt_text, cand_text, None)
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

#[allow(dead_code)]
pub const ALL_ASSET_CLASSES: &[&str] = &[
    "btc", "eth", "sol", "ada", "xrp", "doge", "avax", "link", "matic",
    "bnb", "arb", "op", "sui", "near", "inj", "tia", "kas", "mkr",
    "uni", "aave", "tao", "render", "dot", "atom", "pepe", "bonk",
    "wif", "shib", "ltc", "bch", "xmr", "etc", "fil", "icp", "hbar",
    "trx", "ton", "algo", "vet", "xlm", "ftm", "rune", "sei", "strk",
    "wld", "ena", "ondo", "pendle", "jup", "pyth", "fet", "floki",
    "comp", "steth", "sushi", "band", "gala", "chz", "sand", "mana",
    "crv", "snx", "dydx", "gmx", "ens", "1inch", "ar", "akt", "stx",
    "imx", "grt",
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
        "near" => &["near", "near protocol"],
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
        "wif" => &["dogwifhat", "wif"],
        "shib" => &["shiba", "shib", "shiba inu"],
        "ltc" => &["litecoin", "ltc"],
        "bch" => &["bitcoin cash", "bch", "bitcoincash"],
        "xmr" => &["monero", "xmr"],
        "etc" => &["ethereum classic", "etc", "ethereumclassic"],
        "fil" => &["filecoin", "fil"],
        "icp" => &["internet computer", "icp", "internetcomputer"],
        "hbar" => &["hedera", "hbar"],
        "trx" => &["tron", "trx"],
        "ton" => &["toncoin", "ton"],
        "algo" => &["algorand", "algo"],
        "vet" => &["vechain", "vet"],
        "xlm" => &["stellar", "xlm"],
        "ftm" => &["fantom", "ftm", "sonic"],
        "rune" => &["thorchain", "rune"],
        "sei" => &["sei"],
        "strk" => &["starknet", "strk"],
        "wld" => &["worldcoin", "wld"],
        "ena" => &["ethena", "ena"],
        "ondo" => &["ondo"],
        "pendle" => &["pendle"],
        "jup" => &["jupiter", "jup"],
        "pyth" => &["pyth"],
        "fet" => &["fetch ai", "fet", "asi", "fetch", "fetch.ai"],
        "floki" => &["floki"],
        "comp" => &["compound", "comp"],
        "steth" => &["lido dao", "lido", "ldo", "steth"],
        "sushi" => &["sushiswap", "sushi"],
        _ => &[],
    }
}

pub fn get_sim_for_class(q_vec: &[f32], cls: &str) -> f32 {
    let aliases = get_asset_aliases(cls);
    if aliases.is_empty() {
        return 0.0;
    }
    let name = aliases[0];
    let template = format!("What is the price of {}?", name);
    let enc = crate::tokenizer::tokenize(&template);
    let t_vec = crate::embed::run(&enc);
    crate::math::cosine(q_vec, &t_vec)
}

pub fn check_entity_consistency(q_text: &str, gt_text: &str, cand_text: &str, q_vec: &[f32]) -> f32 {
    let cand_lower = to_lower_str(cand_text);
    let cand_words = extract_words(cand_text);

    // 1. If question or ground truth text is available, use direct lexical/alias matching:
    let target_class = if !q_text.is_empty() || !gt_text.is_empty() {
        let combined = String::from(q_text) + " " + gt_text;
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

    if let Some(target) = target_class {
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
            return 0.00; // Zero credit for attributing to wrong asset
        } else {
            return 1.00; // Concise answers without explicit asset name (e.g. "$145.50 USD")
        }
    }

    // 2. Dynamic Entity Extraction for unlisted / arbitrary crypto assets in uncached mode:
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

    // 3. Fast Cached Mode fallback (q_text is empty, only q_vec exists):
    if !q_vec.is_empty() {
        // Find assets mentioned in candidate:
        let mut cand_assets = Vec::new();
        if let Some(multi) = detect_multiword_asset(&cand_lower) {
            cand_assets.push(multi);
        } else {
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
        }

        if !cand_assets.is_empty() {
            for &cls in &cand_assets {
                let sim = get_sim_for_class(q_vec, cls);
                // If candidate asset matches query vector with high cosine similarity (>= 0.91):
                if sim >= 0.91 {
                    return 1.00;
                } else if sim < 0.86 {
                    return 0.00; // Explicit wrong asset mentioned
                }
            }
        }
    }

    1.00
}

pub fn check_currency_consistency(q_text: &str, gt_text: &str, cand_text: &str, q_vec: &[f32]) -> f32 {
    let combined_ref = String::from(q_text) + " " + gt_text;
    let ref_lower = to_lower_str(&combined_ref);
    let cand_lower = to_lower_str(cand_text);

    let mut has_ref_eur = ref_lower.contains("eur") || ref_lower.contains('€');
    let mut has_ref_usd = ref_lower.contains("usd") || ref_lower.contains('$') || ref_lower.contains("usdt") || ref_lower.contains("usdc") || ref_lower.contains("dollars") || ref_lower.contains("cents");
    let mut has_ref_gbp = ref_lower.contains("gbp") || ref_lower.contains('£');
    let mut has_ref_jpy = ref_lower.contains("jpy") || ref_lower.contains('¥');
    let has_ref_cad = ref_lower.contains("cad") || ref_lower.contains("c$");
    let has_ref_aud = ref_lower.contains("aud") || ref_lower.contains("a$");
    let mut has_ref_ngn = ref_lower.contains("ngn") || ref_lower.contains("naira") || ref_lower.contains('₦');

    // In cached mode, if ref has no explicit currency symbol, check q_vec
    if !has_ref_eur && !has_ref_usd && !has_ref_gbp && !has_ref_jpy && !has_ref_cad && !has_ref_aud && !has_ref_ngn && !q_vec.is_empty() {
        let eur_enc = crate::tokenizer::tokenize("What is the price in EUR euros?");
        let eur_vec = crate::embed::run(&eur_enc);
        let eur_sim = crate::math::cosine(q_vec, &eur_vec);

        let gbp_enc = crate::tokenizer::tokenize("What is the price in GBP pounds?");
        let gbp_vec = crate::embed::run(&gbp_enc);
        let gbp_sim = crate::math::cosine(q_vec, &gbp_vec);

        let jpy_enc = crate::tokenizer::tokenize("What is the price in JPY yen?");
        let jpy_vec = crate::embed::run(&jpy_enc);
        let jpy_sim = crate::math::cosine(q_vec, &jpy_vec);

        let ngn_enc = crate::tokenizer::tokenize("What is the price in NGN naira?");
        let ngn_vec = crate::embed::run(&ngn_enc);
        let ngn_sim = crate::math::cosine(q_vec, &ngn_vec);

        if eur_sim > 0.96 {
            has_ref_eur = true;
        } else if gbp_sim > 0.96 {
            has_ref_gbp = true;
        } else if jpy_sim > 0.96 {
            has_ref_jpy = true;
        } else if ngn_sim > 0.96 {
            has_ref_ngn = true;
        } else {
            has_ref_usd = true;
        }
    }

    let has_cand_eur = cand_lower.contains("eur") || cand_lower.contains('€');
    let has_cand_usd = cand_lower.contains("usd") || cand_lower.contains('$') || cand_lower.contains("usdt") || cand_lower.contains("usdc") || cand_lower.contains("dollars") || cand_lower.contains("cents");
    let has_cand_gbp = cand_lower.contains("gbp") || cand_lower.contains('£');
    let has_cand_jpy = cand_lower.contains("jpy") || cand_lower.contains('¥');
    let has_cand_cad = cand_lower.contains("cad") || cand_lower.contains("c$");
    let has_cand_aud = cand_lower.contains("aud") || cand_lower.contains("a$");
    let has_cand_ngn = cand_lower.contains("ngn") || cand_lower.contains("naira") || cand_lower.contains('₦');

    if has_ref_usd || (!has_ref_eur && !has_ref_gbp && !has_ref_jpy && !has_ref_cad && !has_ref_aud && !has_ref_ngn) {
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
        if has_cand_ngn && !has_cand_usd {
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

    1.00
}

pub fn check_polarity_and_negation(gt_text: &str, cand_text: &str) -> f32 {
    let gt_lower = to_lower_str(gt_text);
    let cand_lower = to_lower_str(cand_text);

    // Filter out standard non-factual disclaimers from candidate
    let sanitized_cand = cand_lower
        .replace("not financial advice", "")
        .replace("not an endorsement", "")
        .replace("not guaranteed", "")
        .replace("not liable", "")
        .replace("not responsible", "")
        .replace("do not invest", "");

    let direct_negations = [
        "is not", "isn't", "was not", "wasn't", "no longer", "false", "incorrect",
        "dropped below", "rejected at", "failed to reach", "untrue", "fake", "manipulated",
        "definitely not", "certainly not", "absolutely not",
    ];

    let gt_has_neg = direct_negations.iter().any(|&nw| gt_lower.contains(nw));
    let cand_has_neg = direct_negations.iter().any(|&nw| sanitized_cand.contains(nw));

    // If query was a boolean / polarity check and candidate flips it:
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
        // If candidate directly negates the price statement, score 0
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
    let combined_ref = String::from(q_text) + " " + gt_text;
    let ref_lower = to_lower_str(&combined_ref);
    let cand_lower = to_lower_str(cand_text);

    let historical_markers = [
        "all-time high", "all time high", "ath", "historic high", "historic peak",
        "all-time low", "all time low", "atl", "record high", "record low",
    ];

    let ref_is_historical = historical_markers.iter().any(|&m| ref_lower.contains(m));
    let cand_is_historical = historical_markers.iter().any(|&m| cand_lower.contains(m));

    // If reference asked for ATH and candidate gave current price without ATH:
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

    if hedge_markers.iter().any(|&hm| cand_lower.contains(hm)) {
        return 0.00; // Zero credit for uncertain / rumored claims
    }

    1.00
}
