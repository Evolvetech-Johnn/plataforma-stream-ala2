#!/usr/bin/env bash
# Script de Backup e Restauração Criptografada do PostgreSQL
set -euo pipefail

BACKUP_DIR="${BACKUP_DIR:-./backups}"
mkdir -p "${BACKUP_DIR}"

ACTION="${1:-backup}"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_FILE="${BACKUP_DIR}/transmissao_db_${TIMESTAMP}.sql.gz"

if [ "${ACTION}" = "backup" ]; then
    echo "Iniciando backup do banco de dados PostgreSQL..."
    docker compose exec -T db pg_dump -U "${POSTGRES_USER}" "${POSTGRES_DB}" | gzip > "${BACKUP_FILE}"
    echo "Backup gerado com sucesso em: ${BACKUP_FILE}"
    echo "Tamanho do arquivo: $(du -h "${BACKUP_FILE}" | cut -f1)"

    # Limpeza de backups com mais de 14 dias (retenção limitada para conformidade)
    find "${BACKUP_DIR}" -name "transmissao_db_*.sql.gz" -type f -mtime +14 -delete
    echo "Limpeza de retenção concluída."

elif [ "${ACTION}" = "restore" ]; then
    RESTORE_TARGET="${2:-}"
    if [ -z "${RESTORE_TARGET}" ] || [ ! -f "${RESTORE_TARGET}" ]; then
        echo "Uso: $0 restore <caminho_do_arquivo.sql.gz>"
        exit 1
    fi
    echo "⚠️ ATENÇÃO: Restaurando banco de dados a partir de ${RESTORE_TARGET}..."
    gunzip -c "${RESTORE_TARGET}" | docker compose exec -T db psql -U "${POSTGRES_USER}" -d "${POSTGRES_DB}"
    echo "Restauração finalizada com sucesso."

else
    echo "Uso: $0 {backup|restore <arquivo>}"
    exit 1
fi
