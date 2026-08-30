import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { execSync } from 'child_process';
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

// 1. Verify Magic Header
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

// Get current commit SHA if available
let gitCommit = 'unknown';
try {
  gitCommit = execSync('git rev-parse HEAD', { cwd: rootDir, encoding: 'utf8' }).trim();
} catch (e) {
  // Git commit lookup fallback
}

// 15 Canonical Diagnostic Evaluation Pairs
const canonical15Pairs = [
  {
    num: 1,
    query: "What is the price of Bitcoin?",
    groundTruth: "$65,400",
    goodAnswer: "Bitcoin (BTC) is currently trading at $65,400 USD.",
    badAnswer: "Bitcoin (BTC) is currently trading at $12,000 USD.",
    explanation: "Exact spot price match in USD vs severe ($12,000) factual discrepancy."
  },
  {
    num: 2,
    query: "What is Ethereum price?",
    groundTruth: "$3,480",
    goodAnswer: "Ethereum is trading at $3,480.00 USD (+1.40% 24h).",
    badAnswer: "Ethereum is trading at $850.00 USD (+1.40% 24h).",
    explanation: "Valid spot price with +24h interval delta vs completely false price with same delta format."
  },
  {
    num: 3,
    query: "What is Solana spot price?",
    groundTruth: "$145.50",
    goodAnswer: "1 SOL = $145.50 USD.",
    badAnswer: "1 SOL = $22.00 USD.",
    explanation: "Accurate oracle price with unit prefix (1 SOL) vs incorrect rate with unit prefix."
  },
  {
    num: 4,
    query: "What is Avalanche price?",
    groundTruth: "$28.40",
    goodAnswer: "As of August 30, 2026, AVAX is $28.40 USD.",
    badAnswer: "As of August 30, 2026, AVAX is $4.10 USD.",
    explanation: "Correct spot price contextualized with date timestamp vs false price with same date."
  },
  {
    num: 5,
    query: "What is Chainlink price?",
    groundTruth: "$11.80",
    goodAnswer: "LINK is $11.80 with $2.5B 24h volume, ranked #15.",
    badAnswer: "LINK is $1.50 with $2.5B 24h volume, ranked #15.",
    explanation: "Accurate price alongside supplemental volume/rank metadata vs incorrect price."
  },
  {
    num: 6,
    query: "What is Arbitrum spot price?",
    groundTruth: "$0.55",
    goodAnswer: "ARB is trading at 55 cents.",
    badAnswer: "ARB is trading at 5 cents.",
    explanation: "Properly converted cents notation (55 cents = $0.55) vs incorrect value (5 cents = $0.05)."
  },
  {
    num: 7,
    query: "What is Bitcoin price in USD?",
    groundTruth: "$65,400",
    goodAnswer: "BTC is currently trading at $65.4k.",
    badAnswer: "BTC is currently trading at $25.4k.",
    explanation: "Correct thousands multiplier ($65.4k = $65,400) vs wrong multiplier value ($25.4k)."
  },
  {
    num: 8,
    query: "What is the current price of Celestia?",
    groundTruth: "$5.20",
    goodAnswer: "Celestia (TIA) is currently $5.20 USD.",
    badAnswer: "Celestia (TIA) is currently $0.45 USD.",
    explanation: "Dynamic unlisted cryptocurrency generalization with correct price vs wrong value."
  },
  {
    num: 9,
    query: "What is the price of Solana?",
    groundTruth: "$145.50",
    goodAnswer: "Solana is $145.50.",
    badAnswer: "Cardano is $145.50.",
    explanation: "Valid asset attribution vs competitor/wrong-asset substitution with identical number."
  },
  {
    num: 10,
    query: "What is the price of Ethereum?",
    groundTruth: "$3,480",
    goodAnswer: "Ethereum is currently trading at $3,480.",
    badAnswer: "Ethereum is not trading at $3,480.",
    explanation: "Affirmative factual statement vs direct syntactic negation containing identical numbers."
  },
  {
    num: 11,
    query: "What is the price of Bitcoin?",
    groundTruth: "$65,400",
    goodAnswer: "Bitcoin spot price is $65,400.",
    badAnswer: "Bitcoin all-time high was $65,400 in 2021.",
    explanation: "Current live spot price vs historical / stale ATH claim misrepresenting market state."
  },
  {
    num: 12,
    query: "What is Solana price in USD?",
    groundTruth: "$145.50",
    goodAnswer: "Solana is $145.50 USD.",
    badAnswer: "Solana is 145.50 EUR.",
    explanation: "Correct fiat currency denominated in USD vs currency mismatch (EUR)."
  },
  {
    num: 13,
    query: "What is Bitcoin price?",
    groundTruth: "$65,400",
    goodAnswer: "Bitcoin is trading between $65,300 and $65,500.",
    badAnswer: "Bitcoin is trading between $10,000 and $20,000.",
    explanation: "Accurate tight price band spanning ground truth vs completely disjoint price band."
  },
  {
    num: 14,
    query: "What is Ethereum price?",
    groundTruth: "$3,480",
    goodAnswer: "Ethereum is $3,480.",
    badAnswer: "Ethereum is $2,700.",
    explanation: "Exact spot price vs near-miss price (>22% deviation) penalized via continuous error curve."
  },
  {
    num: 15,
    query: "What is Dogecoin spot price?",
    groundTruth: "$0.10",
    goodAnswer: "DOGE is trading at $0.10.",
    badAnswer: "DOGE is unconfirmed and rumored around $0.10 maybe.",
    explanation: "Definitive authoritative spot price vs speculative/hedged uncertain rumor."
  }
];

async function runDiagnostic() {
  const { instance } = await WebAssembly.instantiate(wasmBuffer, {});
  const { alloc, rank_answer, memory } = instance.exports;

  function write(str) {
    if (!str) return { ptr: 0, len: 0 };
    const buf = Buffer.from(str, 'utf8');
    const ptr = alloc(buf.length);
    new Uint8Array(memory.buffer).set(buf, ptr);
    return { ptr, len: buf.length };
  }

  let totalGood = 0;
  let totalBad = 0;
  let totalMargin = 0;
  let minMargin = 1.0;
  let correctOrderings = 0;
  const goodScores = [];
  const badScores = [];
  const allScores = [];
  const failedPairs = [];
  const evaluatedPairs = [];

  for (const pair of canonical15Pairs) {
    const qW = write(pair.query);
    const gtW = write(pair.groundTruth);
    const gW = write(pair.goodAnswer);
    const bW = write(pair.badAnswer);

    const goodScore = rank_answer(qW.ptr, qW.len, gtW.ptr, gtW.len, gW.ptr, gW.len);
    const badScore = rank_answer(qW.ptr, qW.len, gtW.ptr, gtW.len, bW.ptr, bW.len);
    const margin = goodScore - badScore;
    const passed = goodScore > badScore;

    if (passed) {
      correctOrderings++;
    } else {
      failedPairs.push(pair.num);
    }

    if (margin < minMargin) minMargin = margin;

    totalGood += goodScore;
    totalBad += badScore;
    totalMargin += margin;

    goodScores.push(goodScore);
    badScores.push(badScore);
    allScores.push(goodScore, badScore);

    evaluatedPairs.push({
      ...pair,
      goodScore,
      badScore,
      margin,
      passed
    });
  }

  const numPairs = canonical15Pairs.length;
  const avgGood = totalGood / numPairs;
  const avgBad = totalBad / numPairs;
  const avgMargin = totalMargin / numPairs;

  // Standard deviation of all evaluated scores
  const meanAll = allScores.reduce((a, b) => a + b, 0) / allScores.length;
  const variance = allScores.reduce((a, b) => a + Math.pow(b - meanAll, 2), 0) / allScores.length;
  const stdDev = Math.sqrt(variance);

  // Self-match tests across representative phrases
  const selfMatchPhrases = [
    "$65,400",
    "Bitcoin (BTC) is currently trading at $65,400 USD.",
    "$3,480.00",
    "1 SOL = $145.50 USD.",
    "ARB is trading at 55 cents."
  ];

  let worstSelfMatch = 1.0;
  for (const phrase of selfMatchPhrases) {
    const sW = write(phrase);
    const qW = write("What is the current spot price?");
    const selfScore = rank_answer(qW.ptr, qW.len, sW.ptr, sW.len, sW.ptr, sW.len);
    if (selfScore < worstSelfMatch) worstSelfMatch = selfScore;
  }

  // Print formatted console output
  console.log('\n========================================================================================================');
  console.log('              TELEGRAPH SENTINEL WASM SCORER - CANONICAL 15-PAIR CRYPTO_PRICE DIAGNOSTIC               ');
  console.log('========================================================================================================');
  console.log(`WASM Artifact:    wasm/dist/telegraph_sentinel_scorer.wasm (${byteSize.toLocaleString()} bytes)`);
  console.log(`SHA-256 Checksum: ${sha256}`);
  console.log(`Byte Identical:   ${isByteIdentical ? 'YES (docs/sentinel_scorer.wasm synchronized)' : 'NO'}`);
  console.log(`Git Commit:       ${gitCommit}`);
  console.log('--------------------------------------------------------------------------------------------------------');
  console.log('| #  | Query & Ground Truth           | GOOD Score | BAD Score  | Margin   | Status | Primary Mode');
  console.log('--------------------------------------------------------------------------------------------------------');

  evaluatedPairs.forEach(p => {
    const qSummary = `${p.query.slice(0, 20)}... [${p.groundTruth}]`.padEnd(30);
    const gScoreStr = p.goodScore.toFixed(4).padStart(10);
    const bScoreStr = p.badScore.toFixed(4).padStart(10);
    const marginStr = (p.margin >= 0 ? '+' : '') + p.margin.toFixed(4).padStart(7);
    const statusStr = p.passed ? 'PASS ✓' : 'FAIL ✗';
    console.log(`| ${p.num.toString().padStart(2)} | ${qSummary} | ${gScoreStr} | ${bScoreStr} | ${marginStr} | ${statusStr.padEnd(6)} | ${p.explanation.slice(0, 32)}...`);
  });

  console.log('--------------------------------------------------------------------------------------------------------');
  console.log(`TOTAL PAIRS:              ${numPairs}`);
  console.log(`ORDERING ACCURACY:        ${correctOrderings} / ${numPairs} (${((correctOrderings / numPairs) * 100).toFixed(1)}%)`);
  console.log(`AVERAGE GOOD SCORE:       ${avgGood.toFixed(4)}`);
  console.log(`AVERAGE BAD SCORE:        ${avgBad.toFixed(4)}`);
  console.log(`AVERAGE SEPARATION MARGIN: +${avgMargin.toFixed(4)}`);
  console.log(`MINIMUM MARGIN:           +${minMargin.toFixed(4)}`);
  console.log(`WORST SELF-MATCH:         ${worstSelfMatch.toFixed(4)}`);
  console.log(`SCORE STANDARD DEVIATION: ${stdDev.toFixed(4)}`);
  console.log(`FAILED PAIRS:             ${failedPairs.length === 0 ? 'None (0 failures)' : failedPairs.join(', ')}`);
  console.log('========================================================================================================\n');

  const nowIso = new Date().toISOString();

  // Generate docs/CRYPTO_PRICE_15_PAIR_DIAGNOSTIC.md
  let mdContent = `# Telegraph Sentinel WASM Scorer - Canonical 15-Pair CRYPTO_PRICE Diagnostic

This diagnostic report is generated automatically by \`wasm/crypto_price_15_diagnostic.js\` evaluating the current release WebAssembly binary \`wasm/dist/telegraph_sentinel_scorer.wasm\`.

## 1. Executive Summary & Diagnostic Metrics

| Metric | Measured Value |
| :--- | :--- |
| **Intent Target** | \`CRYPTO_PRICE\` |
| **Evaluation Timestamp** | \`${nowIso}\` |
| **Git Commit SHA** | \`${gitCommit}\` |
| **WASM Binary Size** | \`${byteSize.toLocaleString()} bytes\` (~${(byteSize / 1024).toFixed(1)} KB) |
| **WASM SHA-256 Checksum** | \`${sha256}\` |
| **Mirror Synchronization** | \`${isByteIdentical ? 'Byte-for-byte identical with docs/sentinel_scorer.wasm' : 'Mismatch'}\` |
| **Total Comparison Pairs** | \`${numPairs}\` |
| **Ordering Accuracy** | **\`${correctOrderings} / ${numPairs}\` (${((correctOrderings / numPairs) * 100).toFixed(1)}%)** |
| **Average GOOD Score** | **\`${avgGood.toFixed(4)}\`** |
| **Average BAD Score** | **\`${avgBad.toFixed(4)}\`** |
| **Average Separation Margin** | **\`+${avgMargin.toFixed(4)}\`** (Threshold: > \`0.800\`) |
| **Minimum Separation Margin** | **\`+${minMargin.toFixed(4)}\`** |
| **Worst Self-Match Score** | **\`${worstSelfMatch.toFixed(4)}\`** |
| **Score Standard Deviation** | **\`${stdDev.toFixed(4)}\`** |
| **Failed Pairs** | \`${failedPairs.length === 0 ? 'None (0 failed pairs)' : failedPairs.join(', ')}\` |

---

## 2. Canonical 15-Pair Detailed Evaluation Table

| # | Query | Ground Truth | GOOD Answer | BAD Answer | GOOD Score | BAD Score | Margin | Result | Failure Mode / Verification |
| :- | :--- | :--- | :--- | :--- | :---: | :---: | :---: | :---: | :--- |
`;

  evaluatedPairs.forEach(p => {
    mdContent += `| **${p.num}** | \`${p.query}\` | \`${p.groundTruth}\` | "${p.goodAnswer}" | "${p.badAnswer}" | \`${p.goodScore.toFixed(4)}\` | \`${p.badScore.toFixed(4)}\` | \`+${p.margin.toFixed(4)}\` | **${p.passed ? 'PASS ✓' : 'FAIL ✗'}** | ${p.explanation} |\n`;
  });

  mdContent += `
---

## 3. Analysis of CRYPTO_PRICE Generalization Mechanisms

1. **Non-Price Token Context Isolation**:
   - Timeframe intervals (\`24h\`, \`7d\`, \`30d\`, \`1y\`, \`15m\`), timestamps (\`14:00:00 UTC\`), calendar dates (\`August 30, 2026\`), ordinal rankings (\`#15\`, \`ranked top 10\`), and unit counters (\`1 SOL =\`, \`1 BTC =\`) are isolated from spot price matching.

2. **Continuous Multiplier & Unit Normalization**:
   - Suffix multipliers (\`k\`, \`m\`, \`b\`, \`thousand\`, \`million\`, \`billion\`) and fractional units (\`cents\`, \`¢\`, \`bps\`) are normalized to base decimal units.

3. **Strict Zero-Credit Factual Penalties**:
   - Wrong currency tokens (\`EUR\` for a \`USD\` ground truth), syntactic negations (\`"is not trading at"\`), historical claims (\`"all-time high in 2021 was"\`), wrong asset substitution (\`"Cardano is $145.50"\`), and speculative hedging markers (\`"unconfirmed and rumored around"\`) trigger definitive zero-credit multiplier penalties.

4. **Steep Power-Law Separation Curve**:
   - The calibrated monotonic transform $f(x) = \\frac{x^{2.5}}{x^{2.5} + (1-x)^{2.5}}$ amplifies valid signals ($x > 0.90 \\rightarrow 0.998$) and collapses conflicting signals ($x < 0.05 \\rightarrow 0.000$).

---

## 4. Reproduction Instructions

To reproduce these exact results directly from the repository's WASM binary:

\`\`\`bash
node wasm/crypto_price_15_diagnostic.js
\`\`\`
`;

  const mdPath = path.resolve(rootDir, 'docs/CRYPTO_PRICE_15_PAIR_DIAGNOSTIC.md');
  fs.writeFileSync(mdPath, mdContent, 'utf8');
  console.log(`✓ Written diagnostic report to: docs/CRYPTO_PRICE_15_PAIR_DIAGNOSTIC.md`);

  // Generate docs/CRYPTO_PRICE_VERIFICATION.json
  const verificationJson = {
    intent: "CRYPTO_PRICE",
    wasm_path: "wasm/dist/telegraph_sentinel_scorer.wasm",
    mirror_path: "docs/sentinel_scorer.wasm",
    byte_size: byteSize,
    sha256: sha256,
    byte_identical: isByteIdentical,
    diagnostic_pairs: numPairs,
    ordering_accuracy: Number((correctOrderings / numPairs).toFixed(4)),
    average_good_score: Number(avgGood.toFixed(4)),
    average_bad_score: Number(avgBad.toFixed(4)),
    average_margin: Number(avgMargin.toFixed(4)),
    minimum_margin: Number(minMargin.toFixed(4)),
    worst_self_match: Number(worstSelfMatch.toFixed(4)),
    score_standard_deviation: Number(stdDev.toFixed(4)),
    validation_passed: correctOrderings === numPairs && avgMargin >= 0.800 && isByteIdentical,
    timestamp: nowIso,
    git_commit: gitCommit
  };

  const jsonPath = path.resolve(rootDir, 'docs/CRYPTO_PRICE_VERIFICATION.json');
  fs.writeFileSync(jsonPath, JSON.stringify(verificationJson, null, 2), 'utf8');
  console.log(`✓ Written machine-readable verification to: docs/CRYPTO_PRICE_VERIFICATION.json\n`);
}

runDiagnostic().catch(err => {
  console.error('Diagnostic error:', err);
  process.exit(1);
});
