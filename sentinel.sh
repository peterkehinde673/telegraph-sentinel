#!/usr/bin/env bash
set -e

PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
LOG_DIR="$PROJECT_ROOT/logs"
mkdir -p "$LOG_DIR"

start_services() {
    echo "▶ Stopping any running instances..."
    pkill -f uvicorn 2>/dev/null || true
    pkill -f "tsx src/server.ts" 2>/dev/null || true
    sleep 1

    echo "▶ 1/2 Starting Python Risk Engine (Port 8000)..."
    cd "$PROJECT_ROOT/backend/python"
    nohup python3 -m uvicorn app.main:app --host 0.0.0.0 --port 8000 > "$LOG_DIR/python.log" 2>&1 &
    
    echo "▶ 2/2 Starting Node.js Gateway & UI (Port 4000)..."
    cd "$PROJECT_ROOT/backend/node"
    nohup node dist/server.js > "$LOG_DIR/node.log" 2>&1 &

    echo "⏳ Initializing (5 seconds)..."
    sleep 5

    echo ""
    echo "========================================="
    echo "   TELEGRAPH SENTINEL STATUS CHECK       "
    echo "========================================="
    check_status
}

stop_services() {
    echo "⏹ Stopping Sentinel services..."
    pkill -f uvicorn 2>/dev/null || true
    pkill -f "tsx src/server.ts" 2>/dev/null || true
    echo "✓ Stopped."
}

check_status() {
    echo -n "• Python Risk Engine (:8000): "
    if curl -s -f http://127.0.0.1:8000/health > /dev/null 2>&1; then
        echo -e "\e[32mONLINE\e[0m (healthy)"
    else
        echo -e "\e[31mOFFLINE\e[0m"
    fi

    echo -n "• Node Gateway & UI  (:4000): "
    if curl -s -f http://127.0.0.1:4000/health > /dev/null 2>&1; then
        echo -e "\e[32mONLINE\e[0m (http://localhost:4000)"
    else
        echo -e "\e[31mOFFLINE\e[0m"
    fi
}

run_tests() {
    cd "$PROJECT_ROOT/backend/python"
    python3 tests/run_tests.py

    cd "$PROJECT_ROOT/backend/node"
    npx tsx tests/gateway.test.ts
}

case "$1" in
    start) start_services ;;
    stop) stop_services ;;
    status) check_status ;;
    test) run_tests ;;
    logs) tail -n 20 "$LOG_DIR"/*.log ;;
    *) echo "Usage: ./sentinel.sh {start|stop|status|test|logs}"; exit 1 ;;
esac
