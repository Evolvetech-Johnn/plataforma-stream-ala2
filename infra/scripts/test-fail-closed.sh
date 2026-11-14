#!/usr/bin/env bash
# Teste de Homologação Fail-Closed (Laboratório)
# Requisito: Superprompt Seção 8, Item 3 e Item 12
set -euo pipefail

DOMAIN="${1:-http://localhost}"

echo "================================================================"
echo "🛡️ TESTE DE HOMOLOGAÇÃO FAIL-CLOSED (CADDY + NESTJS + MEDIAMTX)"
echo "Alvo: ${DOMAIN}"
echo "================================================================"

assert_status() {
    local name="$1"
    local url="$2"
    local expected="$3"
    local cookie="${4:-}"

    local code
    if [ -n "$cookie" ]; then
        code=$(curl -s -o /dev/null -w "%{http_code}" -H "Cookie: ${cookie}" "${url}" || echo "ERR")
    else
        code=$(curl -s -o /dev/null -w "%{http_code}" "${url}" || echo "ERR")
    fi

    if [ "$code" = "$expected" ]; then
        echo -e "✅ [PASS] ${name} - Retornou ${code} conforme esperado."
    else
        echo -e "❌ [FAIL] ${name} - Esperado ${expected}, mas retornou ${code}!"
    fi
}

echo ""
echo "1. Testando acesso a playlist sem sessão (esperado 403):"
assert_status "Playlist sem Cookie" "${DOMAIN}/hls/ala01/index.m3u8" 403

echo ""
echo "2. Testando acesso a segmento .ts sem sessão (esperado 403):"
assert_status "Segmento .ts sem Cookie" "${DOMAIN}/hls/ala01/segment0001.ts" 403

echo ""
echo "3. Testando cookie forjado / inexistente (esperado 403):"
assert_status "Cookie Forjado" "${DOMAIN}/hls/ala01/index.m3u8" 403 "tv_session=token-forjado-inexistente-1234567890abcdef"

echo ""
echo "4. Testando bypass por tentativa de rota direta interna (esperado 404):"
assert_status "Rota Interna Bloqueada no Caddy" "${DOMAIN}/api/internal/hls-authorize" 404

echo ""
echo "================================================================"
echo "Testes de Fail-Closed concluídos."
echo "================================================================"

