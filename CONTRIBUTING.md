# Contributing to Telegraph Sentinel

## Before making a change

1. Identify the affected component and its production entry point.
2. Preserve the three registered intents: `CRYPTO_PRICE`, `TVL_LOOKUP`, and `WEB_SEARCH`.
3. Avoid changing the WASM scorer or checked-in protocol artifacts unless the change explicitly requires it.
4. Keep secrets, local databases, dependency directories, and build caches out of Git.

## Development workflow

```bash
cd backend/node
npm install
npm run build
npm run test:tvl
npm run test:web-search
```

For changes to the Python risk engine:

```bash
cd backend/python
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
python tests/run_tests.py
```

For scorer work:

```bash
node wasm/validate_scorer.js
```

## Pull requests

A good pull request should:

- explain the problem and intended change;
- identify production/runtime impact;
- include relevant test results;
- avoid unrelated refactors;
- document changes to protocol-facing behavior; and
- avoid exposing credentials or sensitive operational data.

Prefer small, reviewable commits when changing scoring-sensitive code.
