# Development Guide

## Environment
* Node.js v26.3.0 / npm 11.17.0
* Python 3.14.4 (Virtualenv)
* SQLite (Zero-configuration persistent database)

## Running Locally
1. Python: python3 -m uvicorn app.main:app --host 127.0.0.1 --port 8000
2. Gateway: cd backend/node && npx tsx src/server.ts
3. Frontend: cd frontend && npm install && npm run dev
