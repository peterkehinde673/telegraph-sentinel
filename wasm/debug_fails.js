import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const WASM_PATH = path.join(__dirname, 'dist', 'telegraph_sentinel_scorer.wasm');
const wasmBuffer = fs.readFileSync(WASM_PATH);

async function run() {
  const wasmModule = await WebAssembly.instantiate(wasmBuffer, {
    env: { memory: new WebAssembly.Memory({ initial: 256 }) }
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

  // Import the cases from crypto_price_100_diagnostic.js
  const diagFile = fs.readFileSync(path.join(__dirname, 'crypto_price_100_diagnostic.js'), 'utf8');
  // We can just run the test cases from the diagnostic
}
