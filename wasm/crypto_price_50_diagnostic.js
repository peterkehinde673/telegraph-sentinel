import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

const wasmPath = path.resolve(rootDir, 'wasm/dist/telegraph_sentinel_scorer.wasm');
const mirrorPath = path.resolve(rootDir, 'docs/sentinel_scorer.wasm');

if (!fs.existsSync(wasmPath)) {
  console.error(`Error: WASM artifact not found at ${wasmPath}`);
  process.exit(1);
}

const wasmBuffer = fs.readFileSync(wasmPath);
const mirrorBuffer = fs.existsSync(mirrorPath) ? fs.readFileSync(mirrorPath) : null;

// Verify Header
if (
  wasmBuffer.length < 4 ||
  wasmBuffer[0] !== 0x00 ||
  wasmBuffer[1] !== 0x61 ||
  wasmBuffer[2] !== 0x73 ||
  wasmBuffer[3] !== 0x6d
) {
  console.error('Error: Invalid WebAssembly magic header');
  process.exit(1);
}

const byteSize = wasmBuffer.length;
const sha256 = crypto.createHash('sha256').update(wasmBuffer).digest('hex');
const isByteIdentical = mirrorBuffer ? wasmBuffer.equals(mirrorBuffer) : false;

export const adversarial50Cases = [
  // 1-5: Canonical Spot Pricing
  { id: 1, q: "What is the price of Bitcoin?", gt: "$65,400", good: "Bitcoin (BTC) is currently trading at $65,400 USD.", bad: "Bitcoin (BTC) is currently trading at $12,000 USD." },
  { id: 2, q: "What is Ethereum price?", gt: "$3,480", good: "Ethereum is trading at $3,480.00 USD (+1.40% 24h).", bad: "Ethereum is trading at $850.00 USD (+1.40% 24h)." },
  { id: 3, q: "What is Solana spot price?", gt: "$145.50", good: "1 SOL = $145.50 USD.", bad: "1 SOL = $22.00 USD." },
  { id: 4, q: "What is Avalanche price?", gt: "$28.40", good: "As of August 30, 2026, AVAX is $28.40 USD.", bad: "As of August 30, 2026, AVAX is $4.10 USD." },
  { id: 5, q: "What is Chainlink price?", gt: "$11.80", good: "LINK is $11.80 with $2.5B 24h volume, ranked #15.", bad: "LINK is $1.50 with $2.5B 24h volume, ranked #15." },

  // 6-10: Suffix Multipliers & Units
  { id: 6, q: "What is Arbitrum spot price?", gt: "$0.55", good: "ARB is trading at 55 cents.", bad: "ARB is trading at 5 cents." },
  { id: 7, q: "What is Bitcoin price in USD?", gt: "$65,400", good: "BTC is currently trading at $65.4k.", bad: "BTC is currently trading at $25.4k." },
  { id: 8, q: "What is MakerDAO token value?", gt: "$2,100", good: "MKR is at $2.1k USD.", bad: "MKR is at $0.35k USD." },
  { id: 9, q: "What is Sui token price?", gt: "$1.85", good: "SUI is currently $1.85 USD.", bad: "SUI is currently $9.80 USD." },
  { id: 10, q: "What is Injective spot price?", gt: "$24.50", good: "Injective is trading at $24.50 USD.", bad: "Injective is trading at $1.50 USD." },

  // 11-15: Unseen Dynamic Crypto Assets
  { id: 11, q: "What is the price of Kaspa?", gt: "$0.16", good: "Kaspa (KAS) is worth $0.16.", bad: "Kaspa (KAS) is worth $2.50." },
  { id: 12, q: "What is the current price of Celestia?", gt: "$5.20", good: "Celestia (TIA) is currently $5.20 USD.", bad: "Celestia (TIA) is currently $0.45 USD." },
  { id: 13, q: "What is Near Protocol price?", gt: "$4.65", good: "NEAR is $4.65 on Binance.", bad: "NEAR is $0.90 on Binance." },
  { id: 14, q: "What is Bittensor token value?", gt: "$320.00", good: "TAO is $320.00 USD.", bad: "TAO is $45.00 USD." },
  { id: 15, q: "What is Render token price?", gt: "$6.10", good: "RENDER is trading around $6.10.", bad: "RENDER is trading around $0.80." },

  // 16-20: Asset Substitutions (Same price, wrong asset)
  { id: 16, q: "What is the price of Solana?", gt: "$145.50", good: "Solana is $145.50.", bad: "Cardano is $145.50." },
  { id: 17, q: "What is Bitcoin spot price?", gt: "$65,400", good: "Bitcoin spot is $65,400 USD.", bad: "Ethereum spot is $65,400 USD." },
  { id: 18, q: "What is Injective price?", gt: "$24.50", good: "Injective is $24.50.", bad: "Bitcoin is $24.50." },
  { id: 19, q: "What is Uniswap price?", gt: "$7.25", good: "UNI is $7.25.", bad: "AAVE is $7.25." },
  { id: 20, q: "What is Polygon price?", gt: "$0.45", good: "Polygon (MATIC) is currently $0.45.", bad: "Arbitrum (ARB) is currently $0.45." },

  // 21-25: Small / Medium Discrepancies vs Tolerances
  { id: 21, q: "What is Ethereum price?", gt: "$3,480", good: "Ethereum is around $3,480.00 right now.", bad: "Ethereum is around $3,400.00 right now." },
  { id: 22, q: "What is Bitcoin spot price?", gt: "$65,400", good: "Bitcoin is $65,420 (Coinbase feed).", bad: "Bitcoin is $63,000 (Coinbase feed)." },
  { id: 23, q: "What is Solana price?", gt: "$145.50", good: "SOL is $145.60 on Kraken.", bad: "SOL is $138.00 on Kraken." },
  { id: 24, q: "What is Avalanche spot price?", gt: "$28.40", good: "AVAX is $28.38 USD.", bad: "AVAX is $25.00 USD." },
  { id: 25, q: "What is Chainlink price?", gt: "$11.80", good: "LINK is $11.82.", bad: "LINK is $10.50." },

  // 26-30: Negations and Contradictions
  { id: 26, q: "What is the price of Bitcoin?", gt: "$65,400", good: "Bitcoin is currently trading at $65,400.", bad: "Bitcoin is not trading at $65,400." },
  { id: 27, q: "What is Ethereum spot price?", gt: "$3,480", good: "ETH is at $3,480 USD.", bad: "ETH dropped below $3,480 and is not $3,480." },
  { id: 28, q: "What is Solana spot price?", gt: "$145.50", good: "SOL is at $145.50.", bad: "SOL failed to reach $145.50 and rejected at $145.50." },
  { id: 29, q: "What is Dogecoin price?", gt: "$0.10", good: "DOGE is $0.10.", bad: "DOGE is no longer $0.10." },
  { id: 30, q: "What is Cardano price?", gt: "$0.35", good: "ADA is $0.35 USD.", bad: "Claims of ADA at $0.35 are false." },

  // 31-35: Stale & Historical vs Spot
  { id: 31, q: "What is the price of Bitcoin?", gt: "$65,400", good: "Bitcoin spot price is $65,400.", bad: "Bitcoin all-time high was $65,400 in 2021." },
  { id: 32, q: "What is Ethereum price?", gt: "$3,480", good: "Ethereum is trading at $3,480 right now.", bad: "Ethereum peaked at $3,480 last year." },
  { id: 33, q: "What is Solana spot price?", gt: "$145.50", good: "Solana is $145.50 today.", bad: "Solana opened at $145.50 yesterday before crashing." },
  { id: 34, q: "What is Avalanche price?", gt: "$28.40", good: "AVAX is $28.40.", bad: "AVAX previously reached $28.40 in 2023." },
  { id: 35, q: "What is Chainlink spot price?", gt: "$11.80", good: "LINK is $11.80.", bad: "LINK was trading at $11.80 last month." },

  // 36-40: Currency Mismatches
  { id: 36, q: "What is Solana price in USD?", gt: "$145.50", good: "Solana is $145.50 USD.", bad: "Solana is 145.50 EUR." },
  { id: 37, q: "What is Chainlink price?", gt: "$11.80 USD", good: "LINK is $11.80 USD.", bad: "LINK is 11.80 GBP." },
  { id: 38, q: "What is Bitcoin price?", gt: "$65,400", good: "BTC is $65,400 USD.", bad: "BTC is 65,400 JPY." },
  { id: 39, q: "What is Ethereum spot price?", gt: "$3,480", good: "ETH is $3,480 USD.", bad: "ETH is 3,480 CAD." },
  { id: 40, q: "What is Cardano price?", gt: "$0.35", good: "ADA is $0.35 USD.", bad: "ADA is 0.35 AUD." },

  // 41-45: Hedging, Uncertainty, and Conflicting Claims
  { id: 41, q: "What is Avalanche price?", gt: "$28.40", good: "AVAX is $28.40 USD.", bad: "AVAX is $28.40 according to some, but actually it is $4.10." },
  { id: 42, q: "What is Dogecoin spot price?", gt: "$0.10", good: "DOGE is trading at $0.10.", bad: "DOGE is unconfirmed and rumored around $0.10 maybe." },
  { id: 43, q: "What is Bitcoin price?", gt: "$65,400", good: "Bitcoin is trading between $65,300 and $65,500.", bad: "Bitcoin is trading between $10,000 and $20,000." },
  { id: 44, q: "What is Polkadot price?", gt: "$4.20", good: "DOT is $4.20.", bad: "DOT might be around $4.20 or possibly $1.10." },
  { id: 45, q: "What is Cosmos price?", gt: "$4.50", good: "ATOM is $4.50 USD.", bad: "It is disputed whether ATOM is $4.50 or $0.50." },

  // 46-50: Small Decimals, Scientific Exponents & Concise GTs
  { id: 46, q: "What is Pepe token price?", gt: "$0.0000095", good: "PEPE is trading at $0.0000095.", bad: "PEPE is trading at $0.0001500." },
  { id: 47, q: "What is Bonk price in USD?", gt: "$0.000022", good: "BONK is currently $0.000022.", bad: "BONK is currently $0.005000." },
  { id: 48, q: "What is Uniswap price?", gt: "$7.25", good: "$7.25 USD", bad: "$0.80 USD" },
  { id: 49, q: "What is Polygon price?", gt: "$0.45", good: "$0.45", bad: "$12.00" },
  { id: 50, q: "What is Bitcoin spot price?", gt: "$65,400", good: "Bitcoin is 65,400 USD on Coinbase as of 14:00 UTC.", bad: "Bitcoin is 12,000 USD on Coinbase as of 14:00 UTC." }
];

WebAssembly.instantiate(wasmBuffer, {}).then(({ instance }) => {
  const ex = instance.exports;
  const { alloc, rank_answer, rank_answer_cached, embed, memory } = ex;

  function write(str) {
    if (!str) return { ptr: 0, len: 0 };
    const buf = Buffer.from(str, 'utf8');
    const ptr = alloc(buf.length);
    new Uint8Array(memory.buffer).set(buf, ptr);
    return { ptr, len: buf.length };
  }

  function getEmbed(str) {
    const w = write(str);
    const ptr = embed(w.ptr, w.len);
    const copy = alloc(384 * 4);
    new Uint8Array(memory.buffer).set(new Uint8Array(memory.buffer, ptr, 384 * 4), copy);
    return copy;
  }

  console.log('================================================================');
  console.log('     50-CASE ADVERSARIAL CRYPTO_PRICE EVALUATION SUITE          ');
  console.log('================================================================');

  let uncachedWins = 0, uncachedTotalMargin = 0;
  let cachedWins = 0, cachedTotalMargin = 0;

  adversarial50Cases.forEach((t, i) => {
    const qW = write(t.q);
    const gtW = write(t.gt);
    const gW = write(t.good);
    const bW = write(t.bad);

    // Uncached evaluation (rank_answer)
    const uGood = rank_answer(qW.ptr, qW.len, gtW.ptr, gtW.len, gW.ptr, gW.len);
    const uBad = rank_answer(qW.ptr, qW.len, gtW.ptr, gtW.len, bW.ptr, bW.len);
    const uMargin = uGood - uBad;
    if (uGood > uBad) uncachedWins++;
    uncachedTotalMargin += uMargin;

    // Cached evaluation (rank_answer_cached)
    const qVec = getEmbed(t.q);
    const gtVec = getEmbed(t.gt);
    const cGood = rank_answer_cached(qVec, gtVec, gtW.ptr, gtW.len, gW.ptr, gW.len);
    const cBad = rank_answer_cached(qVec, gtVec, gtW.ptr, gtW.len, bW.ptr, bW.len);
    const cMargin = cGood - cBad;
    if (cGood > cBad) cachedWins++;
    cachedTotalMargin += cMargin;

    console.log(`Case #${(i + 1).toString().padStart(2, '0')}: [Uncached] Good: ${uGood.toFixed(4)} | Bad: ${uBad.toFixed(4)} | Margin: +${uMargin.toFixed(4)} [${uGood > uBad ? 'PASS' : 'FAIL'}]`);
    console.log(`         [Cached]   Good: ${cGood.toFixed(4)} | Bad: ${cBad.toFixed(4)} | Margin: +${cMargin.toFixed(4)} [${cGood > cBad ? 'PASS' : 'FAIL'}]`);
  });

  const uAvgMargin = uncachedTotalMargin / adversarial50Cases.length;
  const cAvgMargin = cachedTotalMargin / adversarial50Cases.length;

  console.log('\n================================================================');
  console.log(`TOTAL ADVERSARIAL CASES:     ${adversarial50Cases.length}`);
  console.log(`UNCACHED WINS (rank_answer): ${uncachedWins} / ${adversarial50Cases.length} (${((uncachedWins / adversarial50Cases.length) * 100).toFixed(1)}%) | Avg Margin: +${uAvgMargin.toFixed(4)}`);
  console.log(`CACHED WINS (rank_cached):   ${cachedWins} / ${adversarial50Cases.length} (${((cachedWins / adversarial50Cases.length) * 100).toFixed(1)}%) | Avg Margin: +${cAvgMargin.toFixed(4)}`);
  console.log('================================================================\n');
});
