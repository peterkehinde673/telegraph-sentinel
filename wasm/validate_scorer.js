const fs = require('fs');
const path = require('path');

const wasmPath = path.resolve(__dirname, 'dist/telegraph_sentinel_scorer.wasm');
const wasmBuffer = fs.readFileSync(wasmPath);

// Verify WebAssembly magic header (\0asm)
if (wasmBuffer[0] !== 0x00 || wasmBuffer[1] !== 0x61 || wasmBuffer[2] !== 0x73 || wasmBuffer[3] !== 0x6d) {
  console.error('✗ Invalid WASM binary header');
  process.exit(1);
}

WebAssembly.instantiate(wasmBuffer, {}).then(({ instance }) => {
  const ex = instance.exports;
  const { alloc, rank_answer, memory } = ex;

  console.log('\n======================================================');
  console.log('     TELEGRAPH WASM GENERALIZED BENCHMARK AUDIT       ');
  console.log('======================================================');

  function write(str) {
    if (!str) return { ptr: 0, len: 0 };
    const buf = Buffer.from(str, 'utf8');
    const ptr = alloc(buf.length);
    const view = new Uint8Array(memory.buffer);
    view.set(buf, ptr);
    return { ptr, len: buf.length };
  }

  // 32 Diverse Fixtures testing semantic paraphrases, numerical normalization, entities, and polarity
  const fixtures = [
    { q: "What is the price of ETH?", gt: "$3,450", good: "Ethereum is trading at $3,450 USD.", bad: "Ethereum is trading at $1,200 USD." },
    { q: "What is the TVL of Aave?", gt: "$12.4B", good: "Aave total value locked is $12.4 billion.", bad: "Aave total value locked is $1.2B." },
    { q: "Was the protocol exploited?", gt: "No", good: "No security breach or exploit occurred.", bad: "Yes, the protocol suffered a $50M exploit." },
    { q: "Is the market trend bullish?", gt: "Bullish", good: "Market indicators are strongly bullish.", bad: "Market indicators are bearish." },
    { q: "What is the circulating supply of BTC?", gt: "19.7 million", good: "Circulating supply is 19.7M BTC.", bad: "Circulating supply is 120 million BTC." },
    { q: "What is the capital of France?", gt: "Paris", good: "Paris is France's capital city.", bad: "Tokyo is the capital of Japan." },
    { q: "What is the consensus algorithm of Solana?", gt: "Proof of History", good: "Solana uses Proof of History and PoS.", bad: "Solana uses Proof of Work mining." },
    { q: "What is Uniswap v3 fee tier?", gt: "0.05%", good: "The fee tier is 0.05%.", bad: "The fee tier is 5.0%." },
    { q: "Who founded Ethereum?", gt: "Vitalik Buterin", good: "Ethereum was founded by Vitalik Buterin.", bad: "Ethereum was founded by Satoshi Nakamoto." },
    { q: "What was the inflation rate of USD in 2023?", gt: "3.4%", good: "The USD inflation rate ended at 3.4%.", bad: "The USD inflation rate was 18.5%." },
    { q: "Did the DAO proposal pass?", gt: "Passed", good: "The governance proposal has passed successfully.", bad: "The governance proposal was rejected and failed." },
    { q: "What is the block time of Polygon PoS?", gt: "2 seconds", good: "Polygon PoS block time is approximately 2 seconds.", bad: "Polygon PoS block time is 10 minutes." },
    { q: "What is the native token of Arbitrum?", gt: "ARB", good: "The governance and native token is ARB.", bad: "The governance token is OP." },
    { q: "What is Lido's staked asset?", gt: "stETH", good: "Lido issues stETH for staked Ethereum.", bad: "Lido issues rETH." },
    { q: "What is the maximum supply of Bitcoin?", gt: "21 million", good: "Bitcoin has a hard cap of 21 million.", bad: "Bitcoin has an unlimited maximum supply." },
    { q: "What was the gas price on Ethereum?", gt: "15 Gwei", good: "Gas price is currently 15 Gwei.", bad: "Gas price is 450 Gwei." },
    { q: "What is the collateral ratio on MakerDAO?", gt: "150%", good: "Minimum liquidation collateral ratio is 150%.", bad: "Minimum collateral ratio is 40%." },
    { q: "Which chain does Optimism settle to?", gt: "Ethereum", good: "Optimism is an L2 rollup settling to Ethereum L1.", bad: "Optimism settles to Cosmos Hub." },
    { q: "What is the staking reward yield?", gt: "4.2%", good: "Current staking APY is 4.2%.", bad: "Current staking APY is 250%." },
    { q: "What is Chainlink's primary service?", gt: "Decentralized Oracle", good: "Chainlink provides decentralized oracle price feeds.", bad: "Chainlink is a centralized cloud storage provider." },
    { q: "What is Curve Finance's specialty?", gt: "Stablecoin Swaps", good: "Curve specializes in low-slippage stablecoin swaps.", bad: "Curve is an NFT gaming metaverse." },
    { q: "What is the ticker symbol for Solana?", gt: "SOL", good: "Solana trades under the symbol SOL.", bad: "Solana trades under the symbol ADA." },
    { q: "What is the block reward on Bitcoin post-2024?", gt: "3.125 BTC", good: "The block subsidy is 3.125 BTC.", bad: "The block subsidy is 6.25 BTC." },
    { q: "Is Tornado Cash sanctioned?", gt: "Yes", good: "Tornado Cash was placed under sanctions.", bad: "No, Tornado Cash has never faced regulatory sanctions." },
    { q: "What is the pegged asset for USDT?", gt: "US Dollar", good: "Tether is pegged 1:1 to the US Dollar.", bad: "Tether is pegged to the Japanese Yen." },
    { q: "What is the liquidation penalty on Compound?", gt: "8%", good: "Compound liquidation incentive penalty is 8%.", bad: "Liquidation penalty is 75%." },
    { q: "What language are Solana smart contracts written in?", gt: "Rust", good: "Programs on Solana are primarily written in Rust.", bad: "Programs are written in Solidity." },
    { q: "What is the decimals parameter for USDC?", gt: "6", good: "USDC token contract uses 6 decimals.", bad: "USDC uses 18 decimals." },
    { q: "What is EIP-1559?", gt: "Base fee burn mechanism", good: "EIP-1559 introduced the dynamic base fee burn.", bad: "EIP-1559 changed proof of work to proof of stake." },
    { q: "What is the flash loan fee on Aave v3?", gt: "0.05%", good: "Flash loan fee is 0.05% (5 bps).", bad: "Flash loan fee is 12%." },
    { q: "Who created Bitcoin?", gt: "Satoshi Nakamoto", good: "Bitcoin was created by Satoshi Nakamoto.", bad: "Bitcoin was created by Charlie Lee." },
    { q: "What is the primary token of MakerDAO?", gt: "MKR", good: "MKR is the governance token of MakerDAO.", bad: "COMP is the governance token of MakerDAO." }
  ];

  let correctOrderings = 0;
  let totalGoodScore = 0;
  let totalBadScore = 0;
  let totalMargin = 0;
  let minMargin = 1.0;
  let maxMargin = 0.0;

  fixtures.forEach((f, idx) => {
    const qW = write(f.q);
    const gtW = write(f.gt);
    const gW = write(f.good);
    const bW = write(f.bad);

    const scoreGood = rank_answer(qW.ptr, qW.len, gtW.ptr, gtW.len, gW.ptr, gW.len);
    const scoreBad = rank_answer(qW.ptr, qW.len, gtW.ptr, gtW.len, bW.ptr, bW.len);
    const margin = scoreGood - scoreBad;

    totalGoodScore += scoreGood;
    totalBadScore += scoreBad;
    totalMargin += margin;

    if (margin < minMargin) minMargin = margin;
    if (margin > maxMargin) maxMargin = margin;

    const passed = scoreGood > scoreBad;
    if (passed) correctOrderings++;

    console.log(`Case #${(idx + 1).toString().padStart(2, '0')}: Good: ${scoreGood.toFixed(4)} | Bad: ${scoreBad.toFixed(4)} | Margin: +${margin.toFixed(4)} [${passed ? 'PASS ✓' : 'FAIL ✗'}]`);
  });

  const avgGood = totalGoodScore / fixtures.length;
  const avgBad = totalBadScore / fixtures.length;
  const avgMargin = totalMargin / fixtures.length;

  console.log('\n======================================================');
  console.log('              FINAL BENCHMARK SCORECARD               ');
  console.log('======================================================');
  console.log(`ORDERING ACCURACY:       ${correctOrderings} / ${fixtures.length} (${((correctOrderings / fixtures.length) * 100).toFixed(1)}%)`);
  console.log(`AVERAGE GOOD SCORE:      ${avgGood.toFixed(4)}`);
  console.log(`AVERAGE BAD SCORE:       ${avgBad.toFixed(4)}`);
  console.log(`AVERAGE MARGIN (GAP):    +${avgMargin.toFixed(4)}`);
  console.log(`MINIMUM MARGIN:          +${minMargin.toFixed(4)}`);
  console.log(`MAXIMUM MARGIN:          +${maxMargin.toFixed(4)}`);
  console.log('======================================================\n');

  // Structural sanity tests
  const emptyW = write("");
  const spaceW = write("   \n\t  ");
  const sEmpty = rank_answer(write("Q").ptr, 1, write("GT").ptr, 2, emptyW.ptr, emptyW.len);
  const sSpace = rank_answer(write("Q").ptr, 1, write("GT").ptr, 2, spaceW.ptr, spaceW.len);
  if (sEmpty !== 0.0 || sSpace !== 0.0) {
    throw new Error('Empty or whitespace input must return exactly 0.0');
  }

  // Determinism check (100 runs)
  const f0 = fixtures[0];
  const q0 = write(f0.q);
  const gt0 = write(f0.gt);
  const g0 = write(f0.good);
  const baseScore = rank_answer(q0.ptr, q0.len, gt0.ptr, gt0.len, g0.ptr, g0.len);
  for (let i = 0; i < 100; i++) {
    const s = rank_answer(q0.ptr, q0.len, gt0.ptr, gt0.len, g0.ptr, g0.len);
    if (s !== baseScore) throw new Error('Non-deterministic execution detected');
  }
  console.log('✓ DETERMINISM: 100/100 repeated runs identical');
  console.log('✓ STRUCTURAL: Empty and whitespace return 0.0000\n');
}).catch(err => {
  console.error('Validation error:', err);
  process.exit(1);
});
