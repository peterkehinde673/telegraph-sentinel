# Telegraph Sentinel — System Architecture

graph TD
    A React Dashboard -->|HTTP / WebScoket| B[Node.js / Express Gateway]
    B -->|Internal HTTP| C[Python / FastAPI Risk Engine]
    B -->|xt02 Payments / EVM| D[Base Sepolia Registry]
    B -->|Orchestration| E[Telegraph Miners 207, 301, 202]
    E -->|Signal Intelligence} C
    C -->|Audit Trails| F[SQLite Persistence]
    G Telegraph Challenger Evaluator -->|Wasm Ranking| H[Telegraph Sentinel WASM Scorer]
