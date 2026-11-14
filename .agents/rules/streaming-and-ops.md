---
trigger: model_decision
description: "Orientações para MediaMTX, SRT, HLS, Caddy, Docker, ingest e operação de domingo."
---
# Streaming e operação

- MediaMTX: SRT com passphrase forte, HLS só interno, nenhuma gravação e sem API interna pública.
- Caddy: `forward_auth` em TODAS as requisições HLS; erro significa bloqueio; não cachear mídia privada em cache compartilhado.
- Primeiro piloto sem transcodificação, 720p/H.264/AAC e até 30 espectadores. Testar carga e egress, não inferir capacidade apenas pela CPU.
- Administração do sacramento: proteger origem e servidor ANTES do momento restrito; considerar buffer HLS. Preferir transmitir apenas após essa parte durante o MVP aprovado.
- Builds reproduzíveis, monitoramento da origem, backup do DB, restore testado, runbook operável por 2 pessoas.
