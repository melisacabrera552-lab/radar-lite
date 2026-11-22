#!/usr/bin/env bash
echo ""
echo "============================================================="
echo "  RADAR LITE · BUSCADOR Y AUDITOR DE PROSPECTOS B2B"
echo "============================================================="
echo ""

if ! command -v node &> /dev/null; then
    echo "[AVISO] Node.js no está instalado."
    echo "Descargalo gratis desde: https://nodejs.org/"
    exit 1
fi

if [ ! -f ".env" ]; then
    cp .env.example .env 2>/dev/null || echo "PORT=3000" > .env
fi

if [ ! -d "node_modules" ]; then
    echo "[INFO] Primera ejecución: instalando dependencias..."
    npm install --omit=dev
fi

echo "Iniciando en http://localhost:3000..."
(sleep 2 && {
    if command -v open &> /dev/null; then
        open "http://localhost:3000"
    elif command -v xdg-open &> /dev/null; then
        xdg-open "http://localhost:3000"
    fi
}) &

node server.mjs
