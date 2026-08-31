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

function getEmbed(str) {
  const w = write(str);
  const p = ex.embed(w.ptr, w.len);
  const vec = new Float32Array(new Float32Array(ex.memory.buffer, p, 384));
  ex.dealloc(w.ptr, w.len);
  return vec;
}

function dot(vA, vB) {
  const pA = writeFloats(vA);
  const pB = writeFloats(vB);
  const sim = ex.cosine_sim(pA, pB, 384);
  ex.dealloc(pA, 384 * 4);
  ex.dealloc(pB, 384 * 4);
  return sim;
}

const dynamicTests = [
  { q: "What is the spot price of Astar ASTR token?", targetWords: ["astar", "astr"], wrongWords: ["solana", "sol", "bitcoin", "btc"] },
  { q: "How much is Celestia TIA trading for?", targetWords: ["celestia", "tia"], wrongWords: ["ethereum", "eth", "cardano", "ada"] },
  { q: "What is the price of Kaspa KAS right now?", targetWords: ["kaspa", "kas"], wrongWords: ["avalanche", "avax", "ripple", "xrp"] },
  { q: "What is Injective INJ spot rate in USD?", targetWords: ["injective", "inj"], wrongWords: ["polkadot", "dot", "dogecoin", "doge"] },
  { q: "Can you check Bittensor TAO price today?", targetWords: ["bittensor", "tao"], wrongWords: ["bitcoin", "btc", "solana", "sol"] }
];

console.log('=== UNIVERSAL DYNAMIC ASSET PROJECTION AUDIT ===\n');

for (const t of dynamicTests) {
  const qVec = getEmbed(t.q);
  console.log(`Query: "${t.q}"`);

  for (const tw of t.targetWords) {
    const wVec = getEmbed(tw);
    const d = dot(qVec, wVec);
    console.log(`  [TARGET] Word "${tw}": Dot = ${d.toFixed(4)} (Expected >= 0.35: ${d >= 0.35 ? 'PASS ✓' : 'FAIL ✗'})`);
  }

  for (const ww of t.wrongWords) {
    const wVec = getEmbed(ww);
    const d = dot(qVec, wVec);
    console.log(`  [WRONG ] Word "${ww}": Dot = ${d.toFixed(4)} (Expected < 0.20: ${d < 0.20 ? 'PASS ✓' : 'FAIL ✗'})`);
  }
  console.log('');
}
