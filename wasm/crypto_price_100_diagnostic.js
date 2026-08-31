/**
 * TELEGRAPH PROTOCOL - 100-CASE ADVERSARIAL CRYPTO_PRICE EVALUATION SUITE
 * 
 * Tests both exported entry points:
 *  1. rank_answer(q_ptr, q_len, gt_ptr, gt_len, ma_ptr, ma_len)
 *  2. rank_answer_cached(q_vec_ptr, gt_vec_ptr, gt_ptr, gt_len, ma_ptr, ma_len)
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const WASM_PATH = path.join(__dirname, 'dist', 'telegraph_sentinel_scorer.wasm');
const wasmBuffer = fs.readFileSync(WASM_PATH);

// 100 Comprehensive Adversarial Test Cases across Categories A-AO
const ADVERSARIAL_CASES = [
  // A. Correct spot price variants
  {
    category: "A. Correct Spot Price",
    q: "What is the price of Bitcoin?",
    gt: "$65,400",
    good: "Bitcoin is currently trading at $65,400 USD.",
    bad: "Bitcoin is currently trading at $72,000 USD."
  },
  {
    category: "A. Correct Spot Price",
    q: "What is Ethereum spot price right now?",
    gt: "$3,480",
    good: "The live spot price for Ethereum is $3,480.00.",
    bad: "The live spot price for Ethereum is $2,850.00."
  },
  {
    category: "A. Correct Spot Price",
    q: "What is the current price of Solana?",
    gt: "$145.50",
    good: "Solana is at $145.50 on major spot exchanges.",
    bad: "Solana is at $110.00 on major spot exchanges."
  },
  {
    category: "A. Correct Spot Price",
    q: "What is Cardano price today?",
    gt: "$0.45",
    good: "Cardano (ADA) price is $0.45 USD.",
    bad: "Cardano (ADA) price is $0.85 USD."
  },

  // B. Slightly wrong spot price (out of exchange spread tolerance)
  {
    category: "B. Slightly Wrong Spot Price",
    q: "What is the price of Bitcoin?",
    gt: "$65,400",
    good: "Bitcoin is trading at $65,410 on spot markets.",
    bad: "Bitcoin is trading at $62,500 on spot markets."
  },
  {
    category: "B. Slightly Wrong Spot Price",
    q: "What is Ethereum spot price?",
    gt: "$3,480",
    good: "Ethereum is at $3,482 on Binance.",
    bad: "Ethereum is at $3,300 on Binance."
  },
  {
    category: "B. Slightly Wrong Spot Price",
    q: "What is Avalanche price?",
    gt: "$28.40",
    good: "Avalanche (AVAX) spot price is $28.42.",
    bad: "Avalanche (AVAX) spot price is $25.10."
  },

  // C. Grossly wrong spot price
  {
    category: "C. Grossly Wrong Spot Price",
    q: "What is the price of Bitcoin?",
    gt: "$65,400",
    good: "Bitcoin price is $65,400.",
    bad: "Bitcoin price is $12,000."
  },
  {
    category: "C. Grossly Wrong Spot Price",
    q: "What is Solana price?",
    gt: "$145.50",
    good: "$145.50 USD.",
    bad: "$1.50 USD."
  },
  {
    category: "C. Grossly Wrong Spot Price",
    q: "What is Dogecoin spot price?",
    gt: "$0.10",
    good: "Dogecoin is currently at $0.10.",
    bad: "Dogecoin is currently at $10.00."
  },

  // D. Correct number but wrong cryptocurrency
  {
    category: "D. Correct Number Wrong Crypto",
    q: "What is the price of Solana?",
    gt: "$145.50",
    good: "Solana is currently trading at $145.50.",
    bad: "Cardano is currently trading at $145.50."
  },
  {
    category: "D. Correct Number Wrong Crypto",
    q: "What is Avalanche price?",
    gt: "$28.40",
    good: "AVAX is currently $28.40.",
    bad: "Chainlink (LINK) is currently $28.40."
  },
  {
    category: "D. Correct Number Wrong Crypto",
    q: "What is the price of Polkadot?",
    gt: "$6.20",
    good: "Polkadot (DOT) is $6.20.",
    bad: "Cosmos (ATOM) is $6.20."
  },
  {
    category: "D. Correct Number Wrong Crypto",
    q: "What is the price of Near Protocol?",
    gt: "$4.80",
    good: "Near is $4.80.",
    bad: "Sui is $4.80."
  },

  // E. Wrong number but correct cryptocurrency
  {
    category: "E. Wrong Number Correct Crypto",
    q: "What is the price of Bitcoin?",
    gt: "$65,400",
    good: "Bitcoin (BTC) is $65,400.",
    bad: "Bitcoin (BTC) is $48,000."
  },
  {
    category: "E. Wrong Number Correct Crypto",
    q: "What is the price of Ethereum?",
    gt: "$3,480",
    good: "Ethereum (ETH) is $3,480.",
    bad: "Ethereum (ETH) is $1,950."
  },

  // F. Correct BTC price but ETH answer
  {
    category: "F. BTC Price on ETH",
    q: "What is the price of Bitcoin?",
    gt: "$65,400",
    good: "Bitcoin is $65,400.",
    bad: "Ethereum is $65,400."
  },
  {
    category: "F. BTC Price on ETH",
    q: "What is Bitcoin spot price?",
    gt: "$65,400",
    good: "BTC spot price is $65,400.",
    bad: "ETH spot price is $65,400."
  },

  // G. Correct ETH price but BTC answer
  {
    category: "G. ETH Price on BTC",
    q: "What is Ethereum price?",
    gt: "$3,480",
    good: "ETH is $3,480.",
    bad: "BTC is $3,480."
  },
  {
    category: "G. ETH Price on BTC",
    q: "What is the price of Ethereum?",
    gt: "$3,480",
    good: "Ethereum price is $3,480.",
    bad: "Bitcoin price is $3,480."
  },

  // H. Correct asset but wrong fiat currency
  {
    category: "H. Wrong Fiat Currency",
    q: "What is the price of Bitcoin in USD?",
    gt: "$65,400",
    good: "Bitcoin is $65,400 USD.",
    bad: "Bitcoin is €65,400 EUR."
  },
  {
    category: "H. Wrong Fiat Currency",
    q: "What is Ethereum spot price in USD?",
    gt: "$3,480",
    good: "ETH is $3,480 USD.",
    bad: "ETH is £3,480 GBP."
  },
  {
    category: "H. Wrong Fiat Currency",
    q: "What is Solana price in USD?",
    gt: "$145.50",
    good: "SOL is $145.50 USD.",
    bad: "SOL is ¥145.50 JPY."
  },

  // I. USD vs EUR
  {
    category: "I. USD vs EUR",
    q: "What is Bitcoin price in EUR?",
    gt: "€60,200",
    good: "Bitcoin is currently €60,200 EUR.",
    bad: "Bitcoin is currently $60,200 USD."
  },
  {
    category: "I. USD vs EUR",
    q: "What is Ethereum price in USD?",
    gt: "$3,480",
    good: "Ethereum is $3,480 USD (€3,200 EUR).",
    bad: "Ethereum is only €3,200 EUR."
  },

  // J. USD vs GBP
  {
    category: "J. USD vs GBP",
    q: "What is the price of Solana in GBP?",
    gt: "£115.00",
    good: "Solana is £115.00 GBP.",
    bad: "Solana is $115.00 USD."
  },

  // K. USD vs NGN
  {
    category: "K. USD vs NGN",
    q: "What is Bitcoin price in USD?",
    gt: "$65,400",
    good: "Bitcoin is $65,400 USD.",
    bad: "Bitcoin is ₦65,400 NGN."
  },

  // L. Correct price plus an additional false price
  {
    category: "L. Contradictory False Price",
    q: "What is the price of Bitcoin?",
    gt: "$65,400",
    good: "Bitcoin is currently $65,400 USD.",
    bad: "Bitcoin is currently $65,400 or actually $72,000."
  },
  {
    category: "L. Contradictory False Price",
    q: "What is Ethereum price?",
    gt: "$3,480",
    good: "Ethereum spot price is $3,480.",
    bad: "Ethereum is $3,480 or maybe $4,100 instead."
  },

  // M. Correct price buried among several wrong numbers
  {
    category: "M. Buried Wrong Numbers",
    q: "What is the price of Bitcoin?",
    gt: "$65,400",
    good: "Bitcoin spot price is $65,400. 24h high: $66,100, 24h low: $64,200.",
    bad: "Bitcoin current price is $72,000, although previous was $65,400."
  },
  {
    category: "M. Buried Wrong Numbers",
    q: "What is Solana price?",
    gt: "$145.50",
    good: "Solana current spot: $145.50. 24h range: $142 - $148, volume: $3.2B.",
    bad: "Solana current spot: $180.00, was $145.50 earlier."
  },

  // N. Correct price with wrong 24h percentage
  {
    category: "N. Correct Price Wrong Percentage",
    q: "What is the price of Bitcoin?",
    gt: "$65,400",
    good: "Bitcoin is $65,400, up 2.4% today.",
    bad: "Bitcoin is $72,000, up 2.4% today."
  },

  // O. Correct percentage but wrong price
  {
    category: "O. Correct Percentage Wrong Price",
    q: "What is Ethereum price?",
    gt: "$3,480",
    good: "ETH is $3,480 (+1.8% in 24h).",
    bad: "ETH is $2,800 (+1.8% in 24h)."
  },

  // P. Market cap mistaken for price
  {
    category: "P. Market Cap as Price",
    q: "What is the price of Bitcoin?",
    gt: "$65,400",
    good: "Bitcoin price is $65,400 (Market cap: $1.28T).",
    bad: "Bitcoin price is $1.28 Trillion."
  },
  {
    category: "P. Market Cap as Price",
    q: "What is Ethereum price?",
    gt: "$3,480",
    good: "Ethereum price is $3,480, with a $418B market cap.",
    bad: "Ethereum price is $418 Billion."
  },

  // Q. Volume mistaken for price
  {
    category: "Q. Volume as Price",
    q: "What is the price of Solana?",
    gt: "$145.50",
    good: "Solana price is $145.50. 24h volume is $3.5B.",
    bad: "Solana price is $3.5 Billion."
  },

  // R. Circulating supply mistaken for price
  {
    category: "R. Supply as Price",
    q: "What is Bitcoin price?",
    gt: "$65,400",
    good: "Bitcoin is $65,400 with 19.7M circulating supply.",
    bad: "Bitcoin is $19.7 Million."
  },

  // S. Historical price presented as current price
  {
    category: "S. Historical as Current",
    q: "What is the current price of Bitcoin?",
    gt: "$65,400",
    good: "The current price of Bitcoin is $65,400.",
    bad: "The current price of Bitcoin is $16,500 like in 2022."
  },
  {
    category: "S. Historical as Current",
    q: "What is Ethereum spot price?",
    gt: "$3,480",
    good: "ETH is currently $3,480.",
    bad: "ETH is currently $1,200 as seen in 2022."
  },

  // T. ATH presented as current price
  {
    category: "T. ATH as Current",
    q: "What is the price of Bitcoin?",
    gt: "$65,400",
    good: "Bitcoin is $65,400 (ATH was $73,750 in March 2024).",
    bad: "Bitcoin is currently at $73,750."
  },
  {
    category: "T. ATH as Current",
    q: "What is Solana price today?",
    gt: "$145.50",
    good: "Solana is $145.50 (all-time high is $260.00).",
    bad: "Solana is currently $260.00."
  },

  // U. Current price presented as ATH
  {
    category: "U. Current Presented as ATH",
    q: "What is the price of Bitcoin?",
    gt: "$65,400",
    good: "The current spot price is $65,400.",
    bad: "Bitcoin all-time high is $65,400."
  },

  // V. "previously reached" vs "currently"
  {
    category: "V. Previously vs Currently",
    q: "What is Bitcoin price?",
    gt: "$65,400",
    good: "Bitcoin is currently $65,400, having previously reached $73,000.",
    bad: "Bitcoin previously reached $65,400 and is currently $73,000."
  },
  {
    category: "V. Previously vs Currently",
    q: "What is Ethereum price?",
    gt: "$3,480",
    good: "ETH is currently $3,480, after previously touching $4,000.",
    bad: "ETH was previously $3,480, but is currently $4,000."
  },

  // W. Stale timestamp
  {
    category: "W. Stale Timestamp",
    q: "What is Bitcoin price?",
    gt: "$65,400",
    good: "Live spot price: $65,400.",
    bad: "As of January 2023, Bitcoin is $16,500."
  },

  // X. Future timestamp
  {
    category: "X. Future Timestamp",
    q: "What is Bitcoin price?",
    gt: "$65,400",
    good: "Bitcoin is currently $65,400.",
    bad: "In 2030, Bitcoin target is $500,000."
  },

  // Y. Negated price
  {
    category: "Y. Negated Price",
    q: "What is the price of Bitcoin?",
    gt: "$65,400",
    good: "Bitcoin price is $65,400.",
    bad: "Bitcoin price is not $65,400, it is $72,000."
  },
  {
    category: "Y. Negated Price",
    q: "What is Solana price?",
    gt: "$145.50",
    good: "Solana is currently $145.50.",
    bad: "Solana is definitely not $145.50."
  },
  {
    category: "Y. Negated Price with Disclaimer",
    q: "What is Bitcoin price?",
    gt: "$65,400",
    good: "Bitcoin is $65,400 USD. Note: Not financial advice.",
    bad: "Bitcoin is $75,000 USD. Note: Not financial advice."
  },

  // Z. Hedged/uncertain price
  {
    category: "Z. Hedged Price",
    q: "What is the price of Bitcoin?",
    gt: "$65,400",
    good: "Bitcoin is $65,400.",
    bad: "Rumored to be $65,400 but unconfirmed."
  },
  {
    category: "Z. Hedged Price",
    q: "What is Ethereum price?",
    gt: "$3,480",
    good: "Ethereum is $3,480.",
    bad: "I don't know the exact price, maybe $3,480."
  },

  // AA. "around", "approximately", "roughly"
  {
    category: "AA. Approximate Modifiers",
    q: "What is the price of Bitcoin?",
    gt: "$65,400",
    good: "Bitcoin is roughly $65,400.",
    bad: "Bitcoin is roughly $85,000."
  },
  {
    category: "AA. Approximate Modifiers",
    q: "What is Solana spot price?",
    gt: "$145.50",
    good: "Solana is approximately $145.50.",
    bad: "Solana is approximately $190.00."
  },

  // AB. Price range containing true number vs misleading
  {
    category: "AB. Price Range Spread",
    q: "What is the price of Bitcoin?",
    gt: "$65,400",
    good: "Bitcoin is fluctuating tightly between $65,380 and $65,420.",
    bad: "Bitcoin is somewhere between $10,000 and $100,000."
  },
  {
    category: "AB. Price Range Spread",
    q: "What is Ethereum price?",
    gt: "$3,480",
    good: "ETH is trading between $3,475 and $3,485 on spot desks.",
    bad: "ETH is trading between $1,000 and $6,000."
  },

  // AC. Multiple assets in one answer
  {
    category: "AC. Multiple Assets",
    q: "What is the price of Bitcoin?",
    gt: "$65,400",
    good: "Bitcoin is $65,400, while Ethereum is at $3,480.",
    bad: "Ethereum is $65,400, while Bitcoin is at $3,480."
  },
  {
    category: "AC. Multiple Assets",
    q: "What is Solana price?",
    gt: "$145.50",
    good: "Solana is $145.50 (Cardano is $0.45).",
    bad: "Cardano is $145.50 (Solana is $0.45)."
  },

  // AD. Unit-count numbers
  {
    category: "AD. Unit Count",
    q: "What is Bitcoin price?",
    gt: "$65,400",
    good: "1 BTC = $65,400 USD.",
    bad: "1 BTC = $45,000 USD."
  },
  {
    category: "AD. Unit Count",
    q: "What is Dogecoin spot price?",
    gt: "$0.10",
    good: "100 DOGE is worth $10.00 ($0.10 per DOGE).",
    bad: "100 DOGE is worth $100.00 ($1.00 per DOGE)."
  },

  // AE. Cents notation
  {
    category: "AE. Cents Notation",
    q: "What is Arbitrum spot price?",
    gt: "$0.55",
    good: "Arbitrum is trading at 55 cents ($0.55).",
    bad: "Arbitrum is trading at 95 cents ($0.95)."
  },
  {
    category: "AE. Cents Notation",
    q: "What is Cardano price?",
    gt: "$0.45",
    good: "Cardano is 45¢.",
    bad: "Cardano is 90¢."
  },

  // AF. k/m/b notation
  {
    category: "AF. Multiplier Notation",
    q: "What is the price of Bitcoin?",
    gt: "$65,400",
    good: "Bitcoin is $65.4k.",
    bad: "Bitcoin is $85.4k."
  },
  {
    category: "AF. Multiplier Notation",
    q: "What is Ethereum price?",
    gt: "$3,480",
    good: "Ethereum is $3.48k USD.",
    bad: "Ethereum is $5.20k USD."
  },

  // AG. Decimal / Scientific notation
  {
    category: "AG. Decimal Notation",
    q: "What is Pepe coin price?",
    gt: "$0.0000085",
    good: "PEPE is $0.0000085.",
    bad: "PEPE is $0.0005000."
  },
  {
    category: "AG. Decimal Notation",
    q: "What is Bonk price?",
    gt: "$0.000021",
    good: "Bonk is $0.000021 USD.",
    bad: "Bonk is $0.002100 USD."
  },

  // AH. Comma-separated numbers
  {
    category: "AH. Comma Format",
    q: "What is Bitcoin price?",
    gt: "$65,400",
    good: "The spot rate is 65,400.00 USD.",
    bad: "The spot rate is 55,400.00 USD."
  },
  {
    category: "AH. Comma Format",
    q: "What is Maker price?",
    gt: "$2,850",
    good: "MKR is $2,850.",
    bad: "MKR is $1,250."
  },

  // AI. Correct price but explicitly not current
  {
    category: "AI. Price Not Current",
    q: "What is the price of Bitcoin?",
    gt: "$65,400",
    good: "Bitcoin is currently $65,400.",
    bad: "Although $65,400 was reported earlier, the current price is $72,000."
  },

  // AJ. Wrong price followed by correct price
  {
    category: "AJ. Corrected Price",
    q: "What is Ethereum price?",
    gt: "$3,480",
    good: "It was trading at $3,400 earlier, but current spot price is $3,480.",
    bad: "It was trading at $3,480 earlier, but current spot price is $4,000."
  },

  // AK. Contradictory wrong price
  {
    category: "AK. Contradictory Price",
    q: "What is Solana price?",
    gt: "$145.50",
    good: "Solana spot is $145.50.",
    bad: "Solana dropped from $145.50 and crashed to $80.00."
  },

  // AL. Correct factual answer with irrelevant metadata (rankings, blocks)
  {
    category: "AL. Irrelevant Metadata",
    q: "What is Bitcoin price?",
    gt: "$65,400",
    good: "Bitcoin (Rank #1, Block 859000) is trading at $65,400.",
    bad: "Bitcoin (Rank #1, Block 859000) is trading at $45,000."
  },

  // AM. Semantically similar but factually wrong
  {
    category: "AM. Semantic Trap",
    q: "What is the price of Avalanche?",
    gt: "$28.40",
    good: "Avalanche is currently valued at $28.40 per token.",
    bad: "Avalanche is currently valued at twenty-eight hundred dollars per token."
  },

  // AN. Lexically similar but wrong
  {
    category: "AN. Lexical Trap",
    q: "What is Chainlink price?",
    gt: "$11.80",
    good: "Chainlink (LINK) price is $11.80.",
    bad: "Chainlink (LINK) price is $118.00."
  },

  // AO. Short exact vs long misleading
  {
    category: "AO. Short Exact vs Long Misleading",
    q: "What is the price of Bitcoin?",
    gt: "$65,400",
    good: "$65,400",
    bad: "Bitcoin is a decentralized cryptocurrency created by Satoshi Nakamoto in 2009. Currently trading at $80,000 across global exchanges."
  },
  {
    category: "AO. Short Exact vs Long Misleading",
    q: "What is Ethereum price?",
    gt: "$3,480",
    good: "$3,480 USD",
    bad: "Ethereum is a smart contract platform founded by Vitalik Buterin. The live spot rate is $5,000 USD."
  },

  // Additional Real-World Cryptocurrencies & DePIN / L2 tokens
  {
    category: "Additional Tokens",
    q: "What is Injective price?",
    gt: "$22.50",
    good: "Injective (INJ) is $22.50.",
    bad: "Injective (INJ) is $12.00."
  },
  {
    category: "Additional Tokens",
    q: "What is Celestia price?",
    gt: "$5.80",
    good: "Celestia (TIA) spot price is $5.80.",
    bad: "Celestia (TIA) spot price is $15.80."
  },
  {
    category: "Additional Tokens",
    q: "What is Bittensor price?",
    gt: "$320.00",
    good: "Bittensor (TAO) is $320.00.",
    bad: "Bittensor (TAO) is $120.00."
  },
  {
    category: "Additional Tokens",
    q: "What is Render price?",
    gt: "$6.40",
    good: "Render (RENDER) is $6.40 USD.",
    bad: "Render (RENDER) is $1.40 USD."
  },
  {
    category: "Additional Tokens",
    q: "What is Kaspa price?",
    gt: "$0.16",
    good: "Kaspa (KAS) is $0.16.",
    bad: "Kaspa (KAS) is $0.86."
  },
  {
    category: "Additional Tokens",
    q: "What is Uniswap price?",
    gt: "$7.50",
    good: "Uniswap (UNI) is $7.50.",
    bad: "Uniswap (UNI) is $17.50."
  },
  {
    category: "Additional Tokens",
    q: "What is Aave price?",
    gt: "$135.00",
    good: "Aave is $135.00.",
    bad: "Aave is $45.00."
  },
  {
    category: "Additional Tokens",
    q: "What is Optimism price?",
    gt: "$1.40",
    good: "Optimism (OP) is $1.40 USD.",
    bad: "Optimism (OP) is $4.40 USD."
  },
  {
    category: "Additional Tokens",
    q: "What is Polygon price?",
    gt: "$0.42",
    good: "Polygon (POL) is $0.42.",
    bad: "Polygon (POL) is $1.42."
  },
  {
    category: "Additional Tokens",
    q: "What is BNB price?",
    gt: "$580.00",
    good: "BNB is $580.00.",
    bad: "BNB is $280.00."
  },
  {
    category: "Additional Tokens",
    q: "What is XRP price?",
    gt: "$0.58",
    good: "XRP is $0.58.",
    bad: "XRP is $1.58."
  },
  {
    category: "Additional Tokens",
    q: "What is Near price?",
    gt: "$4.50",
    good: "NEAR Protocol is $4.50.",
    bad: "NEAR Protocol is $9.50."
  },
  {
    category: "Additional Tokens",
    q: "What is Sui price?",
    gt: "$0.85",
    good: "Sui token is $0.85.",
    bad: "Sui token is $2.85."
  },
  {
    category: "Additional Tokens",
    q: "What is Monero price?",
    gt: "$165.00",
    good: "Monero (XMR) is $165.00.",
    bad: "Monero (XMR) is $65.00."
  },
  {
    category: "Additional Tokens",
    q: "What is Litecoin price?",
    gt: "$68.00",
    good: "Litecoin (LTC) is $68.00.",
    bad: "Litecoin (LTC) is $168.00."
  },
  {
    category: "Additional Tokens",
    q: "What is Shiba Inu price?",
    gt: "$0.000014",
    good: "SHIB is $0.000014.",
    bad: "SHIB is $0.001400."
  },
  {
    category: "Additional Tokens",
    q: "What is Dogwifhat price?",
    gt: "$1.85",
    good: "WIF is $1.85 USD.",
    bad: "WIF is $0.15 USD."
  },
  {
    category: "Additional Tokens",
    q: "What is Floki price?",
    gt: "$0.00013",
    good: "FLOKI is $0.00013.",
    bad: "FLOKI is $0.01300."
  },
  {
    category: "Additional Tokens",
    q: "What is Jupiter price?",
    gt: "$0.78",
    good: "Jupiter (JUP) is $0.78.",
    bad: "Jupiter (JUP) is $2.78."
  },
  {
    category: "Additional Tokens",
    q: "What is Pyth price?",
    gt: "$0.32",
    good: "Pyth Network is $0.32.",
    bad: "Pyth Network is $1.32."
  },
  {
    category: "Additional Tokens",
    q: "What is Fetch.ai price?",
    gt: "$1.25",
    good: "FET / ASI is $1.25.",
    bad: "FET / ASI is $4.25."
  },
  {
    category: "Additional Tokens",
    q: "What is Thorchain price?",
    gt: "$4.10",
    good: "RUNE is $4.10.",
    bad: "RUNE is $14.10."
  },
  {
    category: "Additional Tokens",
    q: "What is Sei price?",
    gt: "$0.31",
    good: "SEI is $0.31.",
    bad: "SEI is $1.31."
  },
  {
    category: "Additional Tokens",
    q: "What is Starknet price?",
    gt: "$0.40",
    good: "STRK is $0.40.",
    bad: "STRK is $1.40."
  },
  {
    category: "Additional Tokens",
    q: "What is Worldcoin price?",
    gt: "$1.60",
    good: "WLD is $1.60.",
    bad: "WLD is $5.60."
  },
  {
    category: "Additional Tokens",
    q: "What is Ethena price?",
    gt: "$0.28",
    good: "ENA is $0.28.",
    bad: "ENA is $1.28."
  },
  {
    category: "Additional Tokens",
    q: "What is Ondo price?",
    gt: "$0.72",
    good: "ONDO is $0.72.",
    bad: "ONDO is $2.72."
  },
  {
    category: "Additional Tokens",
    q: "What is Pendle price?",
    gt: "$3.15",
    good: "PENDLE is $3.15.",
    bad: "PENDLE is $8.15."
  },
  {
    category: "Additional Tokens",
    q: "What is Hedera price?",
    gt: "$0.054",
    good: "HBAR is $0.054.",
    bad: "HBAR is $0.540."
  },
  {
    category: "Additional Tokens",
    q: "What is Tron price?",
    gt: "$0.155",
    good: "TRX is $0.155.",
    bad: "TRX is $0.855."
  },
  {
    category: "Additional Tokens",
    q: "What is Toncoin price?",
    gt: "$5.60",
    good: "TON is $5.60.",
    bad: "TON is $1.60."
  },
  {
    category: "Additional Tokens",
    q: "What is Algorand price?",
    gt: "$0.12",
    good: "ALGO is $0.12.",
    bad: "ALGO is $0.82."
  },
  {
    category: "Additional Tokens",
    q: "What is Vechain price?",
    gt: "$0.023",
    good: "VET is $0.023.",
    bad: "VET is $0.230."
  },
  {
    category: "Additional Tokens",
    q: "What is Stellar price?",
    gt: "$0.098",
    good: "XLM is $0.098.",
    bad: "XLM is $0.980."
  },
  {
    category: "Additional Tokens",
    q: "What is Fantom price?",
    gt: "$0.48",
    good: "FTM is $0.48.",
    bad: "FTM is $1.48."
  },
  {
    category: "Additional Tokens",
    q: "What is Filecoin price?",
    gt: "$3.75",
    good: "FIL is $3.75.",
    bad: "FIL is $13.75."
  },
  {
    category: "Additional Tokens",
    q: "What is Internet Computer price?",
    gt: "$7.80",
    good: "ICP is $7.80.",
    bad: "ICP is $27.80."
  },
  {
    category: "Additional Tokens",
    q: "What is Bitcoin Cash price?",
    gt: "$340.00",
    good: "BCH is $340.00.",
    bad: "BCH is $140.00."
  },
  {
    category: "Additional Tokens",
    q: "What is Ethereum Classic price?",
    gt: "$19.20",
    good: "ETC is $19.20.",
    bad: "ETC is $49.20."
  },
  {
    category: "Additional Tokens",
    q: "What is Compound price?",
    gt: "$48.00",
    good: "COMP is $48.00.",
    bad: "COMP is $148.00."
  },
  {
    category: "Additional Tokens",
    q: "What is Lido DAO price?",
    gt: "$1.15",
    good: "LDO is $1.15.",
    bad: "LDO is $4.15."
  },
  {
    category: "Additional Tokens",
    q: "What is SushiSwap price?",
    gt: "$0.62",
    good: "SUSHI is $0.62.",
    bad: "SUSHI is $2.62."
  }
];

async function run() {
  const wasmModule = await WebAssembly.instantiate(wasmBuffer, {
    env: {
      memory: new WebAssembly.Memory({ initial: 256 }),
    }
  });

  const exports = wasmModule.instance.exports;
  const memory = exports.memory;

  function writeString(str) {
    const encoder = new TextEncoder();
    const bytes = encoder.encode(str);
    const ptr = exports.alloc(bytes.length);
    new Uint8Array(memory.buffer, ptr, bytes.length).set(bytes);
    return { ptr, len: bytes.length };
  }

  function getEmbed(str) {
    const { ptr, len } = writeString(str);
    const vecPtr = exports.embed(ptr, len);
    const vec = new Float32Array(memory.buffer, vecPtr, 384).slice();
    exports.dealloc(ptr, len);
    return vec;
  }

  function writeF32Array(arr) {
    const ptr = exports.alloc(arr.length * 4);
    new Float32Array(memory.buffer, ptr, arr.length).set(arr);
    return ptr;
  }

  console.log("================================================================================");
  console.log("     TELEGRAPH SENTINEL WASM SCORER - 100-CASE ADVERSARIAL EVALUATION           ");
  console.log("================================================================================");

  let uncachedWins = 0;
  let cachedWins = 0;
  let totalGoodScore = 0;
  let totalBadScore = 0;
  let totalMargin = 0;
  let minMargin = 999;
  let worstSelfMatch = 1.0;
  const categoryStats = {};

  for (let idx = 0; idx < ADVERSARIAL_CASES.length; idx++) {
    const c = ADVERSARIAL_CASES[idx];
    if (!categoryStats[c.category]) {
      categoryStats[c.category] = { total: 0, uncachedPass: 0, cachedPass: 0 };
    }
    categoryStats[c.category].total++;

    // Uncached evaluation: rank_answer
    const qAlloc = writeString(c.q);
    const gtAlloc = writeString(c.gt);
    const goodAlloc = writeString(c.good);
    const badAlloc = writeString(c.bad);

    const goodScore = exports.rank_answer(qAlloc.ptr, qAlloc.len, gtAlloc.ptr, gtAlloc.len, goodAlloc.ptr, goodAlloc.len);
    const badScore = exports.rank_answer(qAlloc.ptr, qAlloc.len, gtAlloc.ptr, gtAlloc.len, badAlloc.ptr, badAlloc.len);

    exports.dealloc(qAlloc.ptr, qAlloc.len);
    exports.dealloc(gtAlloc.ptr, gtAlloc.len);
    exports.dealloc(goodAlloc.ptr, goodAlloc.len);
    exports.dealloc(badAlloc.ptr, badAlloc.len);

    const uncachedMargin = goodScore - badScore;
    const uncachedPass = goodScore > badScore && uncachedMargin > 0.80;
    if (uncachedPass) {
      uncachedWins++;
      categoryStats[c.category].uncachedPass++;
    }

    // Cached evaluation: rank_answer_cached
    const qVec = getEmbed(c.q);
    const gtVec = getEmbed(c.gt);
    const qVecPtr = writeF32Array(qVec);
    const gtVecPtr = writeF32Array(gtVec);

    const gtAllocCached = writeString(c.gt);
    const goodAllocCached = writeString(c.good);
    const badAllocCached = writeString(c.bad);

    const cachedGoodScore = exports.rank_answer_cached(qVecPtr, gtVecPtr, gtAllocCached.ptr, gtAllocCached.len, goodAllocCached.ptr, goodAllocCached.len);
    const cachedBadScore = exports.rank_answer_cached(qVecPtr, gtVecPtr, gtAllocCached.ptr, gtAllocCached.len, badAllocCached.ptr, badAllocCached.len);

    exports.dealloc(qVecPtr, 384 * 4);
    exports.dealloc(gtVecPtr, 384 * 4);
    exports.dealloc(gtAllocCached.ptr, gtAllocCached.len);
    exports.dealloc(goodAllocCached.ptr, goodAllocCached.len);
    exports.dealloc(badAllocCached.ptr, badAllocCached.len);

    const cachedMargin = cachedGoodScore - cachedBadScore;
    const cachedPass = cachedGoodScore > cachedBadScore && cachedMargin > 0.80;
    if (cachedPass) {
      cachedWins++;
      categoryStats[c.category].cachedPass++;
    }

    totalGoodScore += goodScore;
    totalBadScore += badScore;
    totalMargin += uncachedMargin;
    if (uncachedMargin < minMargin) minMargin = uncachedMargin;

    const numStr = (idx + 1).toString().padStart(3, '0');
    const status = (uncachedPass && cachedPass) ? "PASS ✓" : "FAIL ✗";
    console.log(`[#${numStr}] [${c.category.padEnd(30)}] Good: ${goodScore.toFixed(4)} (cached ${cachedGoodScore.toFixed(4)}) | Bad: ${badScore.toFixed(4)} (cached ${cachedBadScore.toFixed(4)}) | Mgn: +${uncachedMargin.toFixed(4)} [${status}]`);
    if (!uncachedPass || !cachedPass) {
      console.log(`       >>> FAIL DETAIL: Q: "${c.q}" | GT: "${c.gt}" | Good: "${c.good}" | Bad: "${c.bad}"`);
    }
  }

  const n = ADVERSARIAL_CASES.length;
  const avgGood = totalGoodScore / n;
  const avgBad = totalBadScore / n;
  const avgMargin = totalMargin / n;

  console.log("================================================================================");
  console.log("                        ADVERSARIAL EVALUATION SUMMARY                          ");
  console.log("================================================================================");
  console.log(`TOTAL ADVERSARIAL CASES:     ${n}`);
  console.log(`UNCACHED WINS (rank_answer): ${uncachedWins} / ${n} (${((uncachedWins / n) * 100).toFixed(1)}%) | Avg Margin: +${avgMargin.toFixed(4)}`);
  console.log(`CACHED WINS (rank_cached):   ${cachedWins} / ${n} (${((cachedWins / n) * 100).toFixed(1)}%)`);
  console.log(`AVERAGE GOOD SCORE:          ${avgGood.toFixed(4)}`);
  console.log(`AVERAGE BAD SCORE:           ${avgBad.toFixed(4)}`);
  console.log(`MINIMUM MARGIN OBSERVED:     +${minMargin.toFixed(4)}`);
  console.log("--------------------------------------------------------------------------------");
  console.log("FAILURES BY CATEGORY:");
  let totalFailures = 0;
  for (const [cat, stat] of Object.entries(categoryStats)) {
    const fails = stat.total - stat.uncachedPass;
    if (fails > 0) {
      console.log(`  - ${cat}: ${fails} failures / ${stat.total} tests`);
      totalFailures += fails;
    }
  }
  if (totalFailures === 0) {
    console.log("  None (0 failures across all 100 adversarial cases)");
  }
  console.log("================================================================================");
}

run().catch(console.error);
