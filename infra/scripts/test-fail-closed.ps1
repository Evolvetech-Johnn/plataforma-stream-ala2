# Teste de Homologação Fail-Closed (Laboratório)
# Requisito: Superprompt Seção 8, Item 3 e Item 12
# Verifica se o Caddy e a API barram o tráfego HLS sem bypass mesmo com queda de serviço

param (
    [string]$Domain = "http://localhost"
)

Write-Host "================================================================"
Write-Host "🛡️ TESTE DE HOMOLOGACAO FAIL-CLOSED (CADDY + NESTJS + MEDIAMTX)"
Write-Host "Alvo: $Domain"
Write-Host "================================================================"

function Assert-Status ($name, $url, $expectedCode, $cookie = "") {
    try {
        $headers = @{}
        if ($cookie) { $headers["Cookie"] = $cookie }
        $res = Invoke-WebRequest -Uri $url -Headers $headers -Method GET -SkipHttpErrorCheck -TimeoutSec 5
        $code = $res.StatusCode
    } catch {
        if ($_.Exception.Response) {
            $code = [int]$_.Exception.Response.StatusCode
        } else {
            $code = 500
        }
    }

    if ($code -eq $expectedCode) {
        Write-Host "✅ [PASS] $name - Retornou $code conforme esperado." -ForegroundColor Green
        return $true
    } else {
        Write-Host "❌ [FAIL] $name - Esperado $expectedCode, mas retornou $code!" -ForegroundColor Red
        return $false
    }
}

Write-Host "`n1. Testando acesso a playlist sem sessao (esperado 403):"
Assert-Status "Playlist sem Cookie" "$Domain/hls/ala01/index.m3u8" 403

Write-Host "`n2. Testando acesso a segmento .ts sem sessao (esperado 403):"
Assert-Status "Segmento .ts sem Cookie" "$Domain/hls/ala01/segment0001.ts" 403

Write-Host "`n3. Testando cookie forjado / inexistente (esperado 403):"
Assert-Status "Cookie Forjado" "$Domain/hls/ala01/index.m3u8" 403 "tv_session=token-forjado-inexistente-1234567890abcdef"

Write-Host "`n4. Testando bypass por tentativa de rota direta interna (esperado 404):"
Assert-Status "Rota Interna Bloqueada no Caddy" "$Domain/api/internal/hls-authorize" 404

Write-Host "`n================================================================"
Write-Host "Testes de Fail-Closed concluidos."
Write-Host "================================================================"

