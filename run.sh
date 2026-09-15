#!/usr/bin/env bash
# Start htmldiary.   ./run.sh [port]      PORT / HOST / HTMLDIARY_DATA env vars also work.
cd "$(dirname "$0")"
PORT=${1:-${PORT:-8120}}
HOST=${HOST:-127.0.0.1}
DATA=${HTMLDIARY_DATA:-$(pwd)/data}
echo "htmldiary -> http://${HOST}:${PORT}/   (data: ${DATA})"
exec python3 server.py --host "$HOST" --port "$PORT" --data "$DATA"
