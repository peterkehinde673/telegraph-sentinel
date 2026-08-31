import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

const wasmBuffer = fs.readFileSync(path.resolve(rootDir, 'wasm/dist/telegraph_sentinel_scorer.wasm'));
const { instance } = await WebAssembly.instantiate(wasmBuffer, {});
const ex = instance.exports;

function write(str) {
  if (!str) return { ptr: 0, len: 0 };
  const buf = Buffer.from(str, 'utf8');
  const ptr = ex.alloc(buf.length);
  new Uint8Array(ex.memory.buffer).set(buf, ptr);
  return { ptr, len: buf.length };
}

function writeFloats(floats) {
  const ptr = ex.alloc(floats.length * 4);
  new Float32Array(ex.memory.buffer, ptr, floats.length).set(floats);
  return ptr;
}

function rank(q, gt, ans) {
  const wQ = write(q);
  const wGt = write(gt);
  const wAns = write(ans);
  const score = ex.rank_answer(wQ.ptr, wQ.len, wGt.ptr, wGt.len, wAns.ptr, wAns.len);
  ex.dealloc(wQ.ptr, wQ.len);
  ex.dealloc(wGt.ptr, wGt.len);
  ex.dealloc(wAns.ptr, wAns.len);
  return score;
}

function rankCached(q, gt, ans) {
  const wQ = write(q);
  const wGt = write(gt);
  const wAns = write(ans);

  // Safely copy out q_vec and gt_vec so neither overwrites the other
  const qPtr = ex.embed(wQ.ptr, wQ.len);
  const qVec = new Float32Array(new Float32Array(ex.memory.buffer, qPtr, 384));
  const gtPtr = ex.embed(wGt.ptr, wGt.len);
  const gtVec = new Float32Array(new Float32Array(ex.memory.buffer, gtPtr, 384));

  const qVecAlloc = writeFloats(qVec);
  const gtVecAlloc = writeFloats(gtVec);

  const score = ex.rank_answer_cached(qVecAlloc, gtVecAlloc, wGt.ptr, wGt.len, wAns.ptr, wAns.len);

  ex.dealloc(qVecAlloc, 384 * 4);
  ex.dealloc(gtVecAlloc, 384 * 4);
  ex.dealloc(wQ.ptr, wQ.len);
  ex.dealloc(wGt.ptr, wGt.len);
  ex.dealloc(wAns.ptr, wAns.len);
  return score;
}

const stressCases = [
  { cat: "1. Exact Identity", q: "What is Bitcoin price?", gt: "$65,400", good: "$65,400", bad: "$12,000" },
  { cat: "2. Paraphrased Answer", q: "What is the price of Bitcoin?", gt: "$65,400", good: "Bitcoin (BTC) is currently trading at $65,400 USD.", bad: "Bitcoin is around $12,000 USD." },
  { cat: "3. Punctuation Changes", q: "What is Ethereum price?", gt: "$3,480", good: "Ethereum is: $3,480.00!", bad: "Ethereum is: $850.00!" },
  { cat: "4. Currency Formatting", q: "What is Solana spot price?", gt: "$145.50", good: "1 SOL = USD 145.50.", bad: "1 SOL = USD 22.00." },
  { cat: "5. Shorthand notation (k)", q: "What is Bitcoin price in USD?", gt: "$65,400", good: "BTC is currently trading at $65.4k.", bad: "BTC is currently trading at $25.4k." },
  { cat: "6. Raw integer notation", q: "What is Bitcoin price?", gt: "$65,400", good: "Bitcoin is 65400 USD.", bad: "Bitcoin is 12000 USD." },
  { cat: "7. Two decimal notation", q: "What is Ethereum price?", gt: "$3,480", good: "ETH is $3,480.00.", bad: "ETH is $850.00." },
  { cat: "8. Cents notation", q: "What is Arbitrum spot price?", gt: "$0.55", good: "ARB is trading at 55 cents.", bad: "ARB is trading at 5 cents." },
  { cat: "9. Extra Context", q: "What is Avalanche price?", gt: "$28.40", good: "As of August 30, 2026, AVAX is $28.40 USD.", bad: "As of August 30, 2026, AVAX is $4.10 USD." },
  { cat: "10. Disclaimers", q: "What is Chainlink price?", gt: "$11.80", good: "LINK is $11.80 with $2.5B volume. Not financial advice.", bad: "LINK is $1.50 with $2.5B volume. Not financial advice." },
  { cat: "11. Multiple Numbers", q: "What is Bitcoin price?", gt: "$65,400", good: "Bitcoin (Rank #1, Block 859000) is $65,400.", bad: "Bitcoin (Rank #1, Block 859000) is $45,000." },
  { cat: "12. Delta 1% Price Error", q: "What is Bitcoin price?", gt: "$65,400", good: "Bitcoin is $65,400.", bad: "Bitcoin is $64,746 (1% lower)." },
  { cat: "13. Delta 2% Price Error", q: "What is Ethereum price?", gt: "$3,480", good: "ETH is $3,480.", bad: "ETH is $3,410 (2% lower)." },
  { cat: "14. Delta 5% Price Error", q: "What is Solana price?", gt: "$145.50", good: "SOL is $145.50.", bad: "SOL is $138.20." },
  { cat: "15. Delta 10% Price Error", q: "What is Bitcoin price?", gt: "$65,400", good: "BTC is $65,400.", bad: "BTC is $58,860." },
  { cat: "16. Delta 50% Price Error", q: "What is Bitcoin price?", gt: "$65,400", good: "BTC is $65,400.", bad: "BTC is $32,700." },
  { cat: "17. Grossly Wrong Price", q: "What is Ethereum price?", gt: "$3,480", good: "Ethereum is $3,480.", bad: "Ethereum is $85." },
  { cat: "18. Wrong Asset Attribution", q: "What is Solana price?", gt: "$145.50", good: "Solana is $145.50.", bad: "Cardano is $145.50." },
  { cat: "19. Wrong Value Correct Asset", q: "What is Avalanche price?", gt: "$28.40", good: "AVAX is $28.40.", bad: "AVAX is $284.00." },
  { cat: "20. Multiple Assets", q: "What is Bitcoin price?", gt: "$65,400", good: "Bitcoin is $65,400, while Ethereum is $3,480.", bad: "Ethereum is $65,400, while Bitcoin is $3,480." },
  { cat: "21. Competing Prices", q: "What is Bitcoin price?", gt: "$65,400", good: "Bitcoin is currently $65,400.", bad: "Bitcoin is $65,400 or actually $72,000." },
  { cat: "22. Historical vs Current", q: "What is Bitcoin price?", gt: "$65,400", good: "Bitcoin is $65,400 (previously reached $73,000).", bad: "Bitcoin was $65,400 earlier but is $73,000 now." },
  { cat: "23. ATH vs Spot", q: "What is Solana price today?", gt: "$145.50", good: "Solana is $145.50 (ATH is $260.00).", bad: "Solana is currently $260.00." },
  { cat: "24. Negated Answer", q: "What is Ethereum price?", gt: "$3,480", good: "Ethereum is currently $3,480.", bad: "Ethereum is not $3,480." },
  { cat: "25. 'not X but Y' statement", q: "What is Bitcoin price?", gt: "$65,400", good: "BTC is $65,400, not $50,000.", bad: "BTC is $50,000, not $65,400." },
  { cat: "26. Question repeated no price", q: "What is Solana price?", gt: "$145.50", good: "SOL is $145.50.", bad: "What is Solana price? Solana is a cryptocurrency." },
  { cat: "27. Fiat USD vs NGN", q: "What is Bitcoin price in USD?", gt: "$65,400", good: "Bitcoin is $65,400 USD.", bad: "Bitcoin is ₦65,400 NGN." },
  { cat: "28. Fiat USD vs EUR", q: "What is Bitcoin price in USD?", gt: "$65,400", good: "Bitcoin is $65,400 USD.", bad: "Bitcoin is €65,400 EUR." },
  { cat: "29. Fiat USD vs GBP", q: "What is Ethereum price in USD?", gt: "$3,480", good: "ETH is $3,480 USD.", bad: "ETH is £3,480 GBP." },
  { cat: "30. Approximate wording", q: "What is Bitcoin price?", gt: "$65,400", good: "Bitcoin is approximately $65,400.", bad: "Bitcoin is approximately $75,400." },
  { cat: "31. Dynamic Asset Celestia", q: "What is Celestia price?", gt: "$5.20", good: "Celestia (TIA) is $5.20 USD.", bad: "Celestia (TIA) is $0.45 USD." },
  { cat: "32. Dynamic Asset Internet Comp", q: "What is Internet Computer price?", gt: "$7.80", good: "ICP is $7.80.", bad: "ICP is $27.80." },
  { cat: "33. Dynamic Asset Bitcoin Cash", q: "What is Bitcoin Cash price?", gt: "$340.00", good: "BCH is $340.00.", bad: "BCH is $140.00." },
  { cat: "34. Dynamic Asset Ethereum Classic", q: "What is Ethereum Classic price?", gt: "$19.20", good: "ETC is $19.20.", bad: "ETC is $49.20." },
  { cat: "35. Dynamic Asset Monero", q: "What is Monero price?", gt: "$165.00", good: "Monero (XMR) is $165.00.", bad: "Monero (XMR) is $65.00." },
  { cat: "36. Dynamic Asset Dogwifhat", q: "What is Dogwifhat price?", gt: "$1.85", good: "WIF is $1.85 USD.", bad: "WIF is $0.15 USD." },
  { cat: "37. Dynamic Asset Shiba Inu", q: "What is Shiba Inu price?", gt: "$0.000014", good: "SHIB is $0.000014.", bad: "SHIB is $0.001400." },
  { cat: "38. Dynamic Asset Lido DAO", q: "What is Lido DAO price?", gt: "$1.15", good: "LDO is $1.15.", bad: "LDO is $4.15." },
  { cat: "39. Supply as Price Trap", q: "What is Bitcoin price?", gt: "$65,400", good: "Bitcoin is $65,400 with 19.7M circulating supply.", bad: "Bitcoin is $19.7 Million." },
  { cat: "40. Market Cap as Price Trap", q: "What is Ethereum price?", gt: "$3,480", good: "Ethereum is $3,480 (market cap $418B).", bad: "Ethereum is $418 Billion." },
  { cat: "41. Corrected Price", q: "What is Ethereum price?", gt: "$3,480", good: "It was $3,400 earlier, but current price is $3,480.", bad: "It was $3,480 earlier, but current price is $4,000." },
  { cat: "42. 100 Unit Conversion", q: "What is Dogecoin spot price?", gt: "$0.10", good: "100 DOGE is worth $10.00 ($0.10 per DOGE).", bad: "100 DOGE is worth $100.00 ($1.00 per DOGE)." },
  { cat: "43. Price Range", q: "What is Bitcoin price?", gt: "$65,400", good: "Bitcoin is trading between $65,350 and $65,450.", bad: "Bitcoin is trading between $10,000 and $90,000." },
  { cat: "44. Buried Wrong Numbers", q: "What is Bitcoin price?", gt: "$65,400", good: "Bitcoin spot is $65,400. 24h high: $66,100, low: $64,200.", bad: "Bitcoin current is $72,000, although previous was $65,400." },
  { cat: "45. Upper/Lowercase Ticker", q: "What is Solana price?", gt: "$145.50", good: "sol is $145.50.", bad: "sol is $22.00." },
  { cat: "46. Stale Timestamp", q: "What is Bitcoin price?", gt: "$65,400", good: "Bitcoin is $65,400 as of today.", bad: "Bitcoin was $65,400 in year 2021." },
  { cat: "47. Short Concise Answer", q: "What is MakerDAO token value?", gt: "$2,100", good: "$2,100", bad: "$350" },
  { cat: "48. Long Explanatory Answer", q: "What is Chainlink price?", gt: "$11.80", good: "Chainlink (LINK) oracle token is trading at $11.80 across major exchanges.", bad: "Chainlink (LINK) oracle token is trading at $1.50 across major exchanges." },
  { cat: "49. Semantic Overlap False Price", q: "What is Bitcoin price?", gt: "$65,400", good: "Bitcoin is currently trading at $65,400 USD.", bad: "Bitcoin is currently trading at $12,000 USD." },
  { cat: "50. Exact Match vs Unrelated", q: "What is Bitcoin price?", gt: "$65,400", good: "$65,400", bad: "Paris is the capital of France." }
];

console.log('================================================================================');
console.log('   TELEGRAPH SENTINEL CRYPTO_PRICE 50-CATEGORY GENERALIZATION STRESS AUDIT     ');
console.log('================================================================================\n');

let uncachedPasses = 0;
let cachedPasses = 0;
let totalMargin = 0;
let minMargin = 1.0;
let maxBadScore = 0;
let minGoodScore = 1.0;

for (let i = 0; i < stressCases.length; i++) {
  const c = stressCases[i];
  const sGood = rank(c.q, c.gt, c.good);
  const sBad = rank(c.q, c.gt, c.bad);
  const sGoodC = rankCached(c.q, c.gt, c.good);
  const sBadC = rankCached(c.q, c.gt, c.bad);

  const mgn = sGood - sBad;
  totalMargin += mgn;
  if (mgn < minMargin) minMargin = mgn;
  if (sBad > maxBadScore) maxBadScore = sBad;
  if (sGood < minGoodScore) minGoodScore = sGood;

  const isUncachedPass = sGood > sBad;
  const isCachedPass = sGoodC > sBadC;

  if (isUncachedPass) uncachedPasses++;
  if (isCachedPass) cachedPasses++;

  const status = isUncachedPass && isCachedPass ? 'PASS ✓' : 'FAIL ✗';
  console.log(`[#${String(i+1).padStart(2, '0')}] [${c.cat.padEnd(32)}] Good: ${sGood.toFixed(4)} | Bad: ${sBad.toFixed(4)} | Mgn: +${mgn.toFixed(4)} [${status}]`);
}

const avgMargin = totalMargin / stressCases.length;

console.log('\n================================================================================');
console.log('                        STRESS AUDIT METRICS SUMMARY                            ');
console.log('================================================================================');
console.log(`TOTAL CATEGORIES TESTED:     ${stressCases.length}`);
console.log(`UNCACHED ORDERING ACCURACY:  ${uncachedPasses} / ${stressCases.length} (${(uncachedPasses/stressCases.length*100).toFixed(1)}%)`);
console.log(`CACHED ORDERING ACCURACY:    ${cachedPasses} / ${stressCases.length} (${(cachedPasses/stressCases.length*100).toFixed(1)}%)`);
console.log(`AVERAGE SEPARATION MARGIN:   +${avgMargin.toFixed(4)}`);
console.log(`MINIMUM OBSERVED MARGIN:     +${minMargin.toFixed(4)}`);
console.log(`MINIMUM GOOD ANSWER SCORE:   ${minGoodScore.toFixed(4)}`);
console.log(`MAXIMUM BAD ANSWER SCORE:    ${maxBadScore.toFixed(4)}`);
console.log('================================================================================\n');

if (uncachedPasses === stressCases.length && cachedPasses === stressCases.length && avgMargin > 0.90) {
  console.log('✓ GENERALIZATION AUDIT PASSED: Perfect 50/50 ordering on both Uncached and Cached interfaces.');
} else {
  console.error('✗ GENERALIZATION AUDIT FAILED.');
  process.exit(1);
}
