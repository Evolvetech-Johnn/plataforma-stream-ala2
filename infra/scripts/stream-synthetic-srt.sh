#!/usr/bin/env bash
# Ingestão de Mídia Sintética SRT (Laboratório)
# Requisito: Superprompt Seção 8, Item 9
# Gera sinal de teste de barras SMPTE 720p30 + áudio de tom de 1kHz (sem envolver reuniões reais)

set -euo pipefail

HOST_IP="${1:-127.0.0.1}"
PORT="${2:-8890}"
STREAM_PATH="${3:-ala01}"

if [ -f .env ]; then
    # shellcheck disable=SC1091
    source .env || true
fi

PASSPHRASE="${SRT_PUBLISH_PASSPHRASE:-SUBSTITUIR_32_CARACTERES_HEX_PUBLICACAO}"

echo "================================================================"
echo "📡 INICIANDO TRANSMISSÃO DE MÍDIA SINTÉTICA SRT (LABORATÓRIO)"
echo "Destino: srt://${HOST_IP}:${PORT}?streamid=publish:${STREAM_PATH}"
echo "Perfil: 720p @ 30fps (H.264) + Tom 1kHz (AAC) ~1.5 Mbps"
echo "================================================================"

SRT_URL="srt://${HOST_IP}:${PORT}?streamid=publish:${STREAM_PATH}&passphrase=${PASSPHRASE}"

if command -v ffmpeg &> /dev/null; then
    echo "Executando via FFmpeg local..."
    ffmpeg -re -f lavfi -i "testsrc=size=1280x720:rate=30" \
      -f lavfi -i "sine=frequency=1000:sample_rate=48000" \
      -c:v libx264 -preset veryfast -tune zerolatency -b:v 1500k -g 60 \
      -c:a aac -b:a 128k \
      -f mpegts "${SRT_URL}"
else
    echo "FFmpeg local não encontrado. Executando via container Docker..."
    docker run --rm -it --network host jrottenberg/ffmpeg:6.1-alpine \
      -re -f lavfi -i "testsrc=size=1280x720:rate=30" \
      -f lavfi -i "sine=frequency=1000:sample_rate=48000" \
      -c:v libx264 -preset veryfast -tune zerolatency -b:v 1500k -g 60 \
      -c:a aac -b:a 128k \
      -f mpegts "${SRT_URL}"
fi

