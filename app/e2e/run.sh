#!/usr/bin/env bash
# Roda os testes e2e (navegador headless) contra o app em modo web.
#
# Pré-requisitos: backend no ar (`docker compose up -d` na raiz) e dados simulados criados
# (`python3 docs/scripts/simulador.py provisionar`). Se o dev server do Expo ainda não estiver
# em APP_URL, sobe um e derruba ao final.
#
#   ./e2e/run.sh                 # todos os testes
#   ./e2e/run.sh e2e/login.e2e.mjs
set -euo pipefail

cd "$(dirname "$0")/.."
# shellcheck disable=SC1090
source "${NVM_DIR:-$HOME/.nvm}/nvm.sh" >/dev/null 2>&1 && nvm use >/dev/null   # usa o .nvmrc (Node 22)

APP_URL="${APP_URL:-http://localhost:8081}"
export APP_URL

SERVER_PID=""
if curl -s -o /dev/null "$APP_URL"; then
  # Um dev server já no ar pode estar rodando código ANTIGO (em CI mode ele não recarrega arquivos).
  # Só reaproveita se você pedir explicitamente (ex.: seu `npm run web`, que tem watch).
  if [ "${E2E_REUSE_SERVER:-0}" != "1" ]; then
    echo "ERRO: já existe um servidor em $APP_URL e ele pode estar servindo código desatualizado." >&2
    echo "      Encerre-o, ou use E2E_REUSE_SERVER=1 se for o seu 'npm run web' (com watch)." >&2
    exit 1
  fi
  echo "reaproveitando o servidor existente em $APP_URL (E2E_REUSE_SERVER=1)"
else
  echo "subindo o dev server do Expo (web) em $APP_URL ..."
  # CI=1: sem modo watch (não depende do limite de inotify e não recarrega no meio do teste)
  CI=1 EXPO_NO_TELEMETRY=1 setsid npx expo start --web --clear --port "${APP_URL##*:}" >/tmp/expo-e2e.log 2>&1 &
  SERVER_PID=$!
  # derruba o grupo de processos inteiro (npx -> expo -> metro), não só o pai
  trap 'kill -- -"$SERVER_PID" 2>/dev/null || true' EXIT
  for _ in $(seq 1 90); do
    curl -s -o /dev/null "$APP_URL" && break
    sleep 1
  done
  curl -s -o /dev/null "$APP_URL" || { echo "dev server não subiu; veja /tmp/expo-e2e.log"; exit 1; }
fi

if [ "$#" -gt 0 ]; then
  node --test --test-concurrency=1 --test-timeout=180000 "$@"
else
  node --test --test-concurrency=1 --test-timeout=180000 e2e/*.e2e.mjs
fi
