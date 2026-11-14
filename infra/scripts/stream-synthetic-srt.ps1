# Ingestão de Mídia Sintética SRT (Laboratório)
# Requisito: Superprompt Seção 8, Item 9
# Gera sinal de teste de barras SMPTE 720p30 + áudio de tom de 1kHz (sem envolver reuniões reais)

param (
    [string]$HostIp = "127.0.0.1",
    [string]$Port = "8890",
    [string]$StreamPath = "ala01",
    [string]$Passphrase = ""
)

if (-not $Passphrase) {
    if (Test-Path ".env") {
        Get-Content .env | ForEach-Object {
            if ($_ -match "^SRT_PUBLISH_PASSPHRASE=(.*)") {
                $Passphrase = $matches[1].Trim()
            }
        }
    }
}

if (-not $Passphrase -or $Passphrase -eq "SUBSTITUIR_32_CARACTERES_HEX_PUBLICACAO") {
    $Passphrase = "SUBSTITUIR_32_CARACTERES_HEX_PUBLICACAO"
    Write-Warning "Utilizando passphrase padrao de teste. Configure SRT_PUBLISH_PASSPHRASE no .env."
}

Write-Host "================================================================"
Write-Host "📡 INICIANDO TRANSMISSAO DE MIDIA SINTETICA SRT (LABORATORIO)"
Write-Host "Destino: srt://${HostIp}:${Port}?streamid=publish:${StreamPath}"
Write-Host "Perfil: 720p @ 30fps (H.264) + Tom 1kHz (AAC) ~1.5 Mbps"
Write-Host "================================================================"

$srtUrl = "srt://${HostIp}:${Port}?streamid=publish:${StreamPath}&passphrase=${Passphrase}"

if (Get-Command ffmpeg -ErrorAction SilentlyContinue) {
    Write-Host "Executando via FFmpeg local..."
    ffmpeg -re -f lavfi -i "testsrc=size=1280x720:rate=30" `
      -f lavfi -i "sine=frequency=1000:sample_rate=48000" `
      -c:v libx264 -preset veryfast -tune zerolatency -b:v 1500k -g 60 `
      -c:a aac -b:a 128k `
      -f mpegts "$srtUrl"
}
else {
    Write-Host "FFmpeg local nao encontrado. Tentando executar via container Docker..."
    docker run --rm -it --network host jrottenberg/ffmpeg:6.1-alpine `
      -re -f lavfi -i "testsrc=size=1280x720:rate=30" `
      -f lavfi -i "sine=frequency=1000:sample_rate=48000" `
      -c:v libx264 -preset veryfast -tune zerolatency -b:v 1500k -g 60 `
      -c:a aac -b:a 128k `
      -f mpegts "$srtUrl"
}

