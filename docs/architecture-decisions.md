# Decisões de arquitetura — ADR 0001

## Escopo

Uma ala, até 30 espectadores simultâneos, um VPS (2 vCPU, 4 GB RAM), sem transcodificação e sem gravação. Público limitado a pessoas convidadas por líder autorizado. Não é sistema oficial da Igreja.

## Caminho de mídia

1. OBS/encoder na capela envia H.264/AAC para `srt://IP:8890?streamid=publish:ala01` usando passphrase longa; 720p30 a ~1,5 Mbps, keyframe 2 segundos.
2. MediaMTX, isolado em Docker, aceita uma origem e gera HLS (`/ala01/index.m3u8` e segmentos).
3. Browser pede `https://SITE_DOMAIN/hls/ala01/index.m3u8`. Caddy encaminha cada solicitação para autorização `/internal/hls-authorize` no NestJS, inclusive segmentos.
4. NestJS busca no PostgreSQL a sessão cujo segredo apresentado pelo cookie foi armazenado apenas como hash. Rejeita se reunião não estiver LIVE, convite revogado, sessão expirada ou streamPath divergente.
5. Caddy só retorna HLS após sucesso. A saída do MediaMTX 8888 não possui porta publicada no host.

## Fluxo de convites

- Operador autenticado com MFA (futuro) gera token randômico de 256 bits e o distribui privadamente.
- Banco salva somente SHA-256 do token; sem sobrenome, dados clínicos ou diagnóstico do espectador.
- O membro resgata o token uma vez e recebe cookie `HttpOnly`, `Secure`, `SameSite=Lax`; a sessão expira em até 3 horas, limitada ao convite.
- `GET /api/v1/viewer/session` recupera a sessão após atualização da página.
- Cookie não evita screenshot, transmissão da tela ou compartilhamento consciente do dispositivo.

## Máquina de estados (planejada para painel)

| Atual | Ação | Próximo estado | Condições |
|---|---|---|---|
| SCHEDULED | prepare | READY | Operador autorizado e horário válido |
| READY | start | LIVE | Origem SRT estável e confirmação expressa de não transmitir a ordenança |
| LIVE | pause | PAUSED | Bloqueio HLS imediato para novas solicitações + OBS interrompido |
| PAUSED | resume | LIVE | Confirmação de que a parte restrita terminou |
| READY, LIVE, PAUSED | end | ENDED | Irreversível na mesma reunião |
| READY, LIVE, PAUSED | fail | FAILED | Erro operativo; exige revisão |

**Segurança:** HLS tem buffer e atraso. Mudar o banco para PAUSED não apaga segundos já entregues. Primária: interromper o sinal na origem **antes** do sacramento. Para o piloto, preferir iniciar somente após sua administração.

## Índices e integridade

- Índices Prisma definidos no schema.
- No sistema final, aplicar o índice parcial em `docs/db-rules.sql` com migração versionada: impede duas transmissões simultâneas em estado READY/LIVE/PAUSED por unidade.
- Atualizações de estado e registros de auditoria devem ocorrer na mesma transação, preferencialmente com verificação atômica do estado esperado (`updateMany ... WHERE status = anterior`).
- Não permitir que uma nova reunião com a mesma `streamPath` seja aberta enquanto houver outra em estado ativo.

## API planejada do operador

- Autenticação: OIDC/MFA preferencialmente, ou Argon2id + MFA; sessão segura + controle CSRF; RBAC por unidade.
- `POST /v1/operator/broadcasts` com `{ title, scheduledAt }`, retorno `{ id, status: "SCHEDULED" }`.
- `POST /v1/operator/broadcasts/:id/start|pause|resume|end` sem corpo, idempotência por Idempotency-Key, com auditoria e checagem de estados.
- `POST /v1/operator/broadcasts/:id/invites` com `{ expiresAt, maxUses }`; responde token em claro **uma única vez**, nunca retorna o hash.
- `POST /v1/operator/invites/:id/revoke` revoga convite e sessões vinculadas.
- `GET /v1/operator/health` agrega status de ingest e atraso do HLS, com acesso restrito.

## Critérios de aceitação

1. `curl https://SITE_DOMAIN/hls/ala01/index.m3u8` sem cookie retorna 403.
2. Sessão de convite expirado, revogado ou de outra transmissão retorna 403.
3. Reunião PAUSED bloqueia segmentos novos; OBS para a origem.
4. Porta 5432/tcp e 8888/tcp não estão expostas no host.
5. O sistema não registra vídeo/áudio em disco.
6. Dois operadores independentes conseguem testar o processo sob supervisão dos líderes.
7. Simulação 30 clientes durante 60 min sem perda relevante e alerta em caso de falha.

## Operação

- Backup PostgreSQL cifrado com retenção curta e recuperação testada.
- Restauração do VPS a partir de IaC e compose, com duas pessoas autorizadas.
- Logs operacionais sem tokens ou nomes de espectadores, com retenção limitada.
- Observabilidade: disponibilidade de VPS/API, estado de origem SRT, erros HLS 5xx e taxa egress.
- Aferir política musical e privacidade antes da transmissão; não confundir hospedagem própria com licença de execução/transmissão.
