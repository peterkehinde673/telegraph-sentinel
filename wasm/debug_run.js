import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const WASM_PATH = path.join(__dirname, 'dist', 'telegraph_sentinel_scorer.wasm');
const wasmBuffer = fs.readFileSync(WASM_PATH);

// Import ADVERSARIAL_CASES from crypto_price_100_diagnostic.js
import './crypto_price_100_diagnostic.js';
