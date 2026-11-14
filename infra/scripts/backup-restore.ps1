param (
    [string]$Action = "backup",
    [string]$FilePath = ""
)

$BackupDir = "./backups"
if (-not (Test-Path $BackupDir)) {
    New-Item -ItemType Directory -Path $BackupDir | Out-Null
}

$Timestamp = (Get-Date).ToString("yyyyMMdd_HHmmss")
$DefaultBackup = "$BackupDir/transmissao_db_$Timestamp.sql"

if ($Action -eq "backup") {
    Write-Host "Iniciando backup do PostgreSQL no Docker..."
    docker-compose exec -T db pg_dump -U app_transmissao transmissao > $DefaultBackup
    Write-Host "Backup concluído com sucesso em: $DefaultBackup"
}
elseif ($Action -eq "restore") {
    if (-not $FilePath -or -not (Test-Path $FilePath)) {
        Write-Error "Informe um arquivo de backup válido para restauração."
        exit 1
    }
    Write-Host "Restaurando banco de dados a partir de $FilePath..."
    Get-Content $FilePath | docker-compose exec -T db psql -U app_transmissao -d transmissao
    Write-Host "Restauração concluída."
}
else {
    Write-Host "Uso: .\backup-restore.ps1 -Action backup|restore -FilePath <caminho>"
}

