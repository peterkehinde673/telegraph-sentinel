#!/usr/bin/env bash
set -eo pipefail

echo "================================================================="
echo "       TELEGRAPH SENTINEL — FULL REGRESSION TEST HARNESS         "
echo "================================================================="

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

echo "1. Building Node Gateway (TypeScript compiler)..."
cd "$ROOT_DIR/backend/node"
npm run build
echo "   ✓ Gateway build succeeded."

echo "2. Running Node Intent & Oracle Test Suites..."
npm run test:all
echo "   ✓ All Node oracle and YAML tests succeeded."

echo "3. Running Python Risk Engine Test Suite..."
cd "$ROOT_DIR/backend/python"
if [ -f ".venv/bin/python" ]; then
  .venv/bin/python tests/run_tests.py
else
  python3 tests/run_tests.py
fi
echo "   ✓ Python Risk Engine tests succeeded."

echo "4. Running WASM Scorer Audit Suite..."
cd "$ROOT_DIR"
node wasm/validate_scorer.js
echo "   ✓ WASM Scorer audit succeeded."

echo "================================================================="
echo "       ALL TELEGRAPH SENTINEL REGRESSION CHECKS PASSED           "
echo "================================================================="
