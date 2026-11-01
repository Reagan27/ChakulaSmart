#!/usr/bin/env bash
# Starts the React app on :5173 (proxies /api to :8080).
cd "$(dirname "$0")/frontend" && npm install && npm run dev
