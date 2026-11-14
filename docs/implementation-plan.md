# Auditoria Técnica e Plano de Implementação — Plataforma Privada de Transmissão da Ala

**Data:** 08/11/2026  
**Perfil:** Tech Lead Full Stack, Engenheiro de Streaming & Segurança, QA & DevOps  
**Workspace:** `d:\Evolvetech\Webdesign\Projetos\plataforma-stream-ala2`  
**Baseline Git:** Commit `275eec7` (*chore: baseline import of transmissao-ala scaffold*)

---

## 1. Diagnóstico Geral do Repositório (Etapa 0)

O scaffold inicial apresenta a espinha dorsal de uma solução leve e privada (Caddy + NestJS + MediaMTX + PostgreSQL + Next.js), porém possui **falhas críticas de segurança, contratos quebrados, ausência de suíte de testes e pendências impeditivas para execução e build**.

### Tabela de Auditoria e Riscos

| # | Problema | Gravidade | Evidência (Arquivo / Linha) | Correção Necessária | Teste de Verificação |
|---|---|---|---|---|---|
| **1** | **Dependência Next.js 16 inexistente** | **Crítica** | `apps/web/package.json:6` (`"next": "^16.0.0"`) | Ajustar para Next.js 15 LTS (`^15.1.0` ou compatível) com React 19 estável. | `npm install` e `npm run build` em `apps/web` executam sem erro de resolução. |
| **2** | **ValidationPipe do NestJS quebra sem class-validator** | **Alta** | `apps/api/src/main.ts:10`, `apps/api/package.json` | Instalar `class-validator` e `class-transformer` em `apps/api/package.json`. | Inicialização do NestJS sem exceção de dependência ausente. |
| **3** | **Migrações ausentes e índice único parcial não aplicado** | **Crítica** | `apps/api/prisma/migrations` (vazio), `docs/db-rules.sql:4-6` | Gerar migração versionada inicial com o schema Prisma e o índice único parcial `Broadcast_one_active_per_unit` para impedir duas transmissões ativas concorrentes na mesma unidade. | `prisma migrate deploy` roda com sucesso e impede segundo broadcast `READY/LIVE/PAUSED`. |
| **4** | **Módulo do Operador 100% ausente no backend** | **Crítica** | `docs/openapi.yaml:49-88`, `apps/api/src/app.module.ts:9` | Implementar autenticação (Argon2id + MFA TOTP), sessão isolada do operador via cookie `op_session`, RBAC (`ADMIN`, `OPERATOR`, `READ_ONLY`) e endpoints de controle (`start`, `pause`, `resume`, `end`, `invites`, `audit`, `stream-health`). | Testes de integração de login, MFA inválido, RBAC e negação 403 para não autenticado. |
| **5** | **Falta de retry P2034 e rate-limit no resgate de convites** | **Alta** | `apps/api/src/viewer.controller.ts:45, 47-62` | Adicionar retry com backoff exponencial para falhas de serialização PostgreSQL (`P2034`), e rate limiting por IP/sliding window no endpoint `/v1/viewer/redeem`. | Teste de concorrência com 10 requisições simultâneas para convite com `maxUses: 2`. |
| **6** | **Hardcode de `ala01` e validação frágil no `internal/hls-authorize`** | **Alta** | `apps/api/src/internal.controller.ts:15-16, 27` | Extrair dinamicamente o streamPath do header `X-Forwarded-Uri`, validar formato de manifestos/segmentos (`.m3u8`, `.ts`, `.m4s`, `.mp4`), e checar vínculo estrito com a transmissão `LIVE` ativa. Adicionar `try/catch` com retorno 403 (fail-closed) em caso de erro no BD. | Testes de autorização HLS com cookie válido, inválido, expirado, revogado e rota manipulada. |
| **7** | **MediaMTX com API desativada impede monitoramento de sinal** | **Média** | `infra/mediamtx/mediamtx.yml:8` (`api: false`) | Ativar API interna do MediaMTX (`api: true`, porta `9997`) restrita à rede Docker interna, permitindo que a API consulte a saúde da ingestão SRT sem expor ao host. | Endpoint `/v1/operator/stream-health` reporta status da ingestão do encoder. |
| **8** | **Caddy e Compose sem lockfile e sem build multi-stage** | **Média** | `apps/api/Dockerfile`, `apps/web/Dockerfile`, `compose.yaml` | Gerar `package-lock.json`, adotar `npm ci`, criar Dockerfiles multi-stage com usuário não-root e adicionar healthchecks no Compose para `api`, `web` e `mediamtx`. | `docker-compose config` e build reproduzível e auditável. |
| **9** | **Painel do Operador inexistente no frontend** | **Alta** | `apps/web/app/` (apenas player de espectador) | Desenvolver páginas e componentes do operador (`/operator`): login com MFA, botões Start/Pause/Resume/End com confirmação dupla, gerador/revogador de convites e visualizador de saúde do SRT. | Fluxo completo do operador testável no navegador com responsividade mobile. |
| **10** | **Ausência total de suíte de testes automatizados** | **Crítica** | Repositório sem arquivos `*.spec.ts` ou runner | Configurar runner de testes (`vitest` / `supertest`) e implementar testes unitários e de integração cobrindo os 12 requisitos mandatórios da Seção 8 do Superprompt. | Execução de `npm test` gerando relatório PASS/FAIL com evidências. |

---

## 2. Escopo Técnico e Invariantes do MVP

- **Capacidade Alvo:** 1 ala, até 30 espectadores simultâneos, 1 VPS Ubuntu LTS (2 vCPU, 4 GB RAM, 40 GB SSD).
- **Sem Gravação / Sem DVR:** `record: false` no MediaMTX; nenhuma mídia retida em disco.
- **Fail-Closed Total:** Toda requisição HLS passa por validação do Caddy via NestJS. Queda de banco ou erro 5xx resulta em negação (403).
- **Interrupção para o Sacramento:** Procedimento operacional e técnico desliga a entrega antes da ordenança. Alerta claro de latência/buffer HLS.
- **Privacidade e LGPD:** Zero armazenamento de dados de saúde, justificativas de ausência ou identificação desnecessária de membros. Apenas hashes criptográficos em banco.

---

## 3. Plano de Implementação em Fases

### Etapa 1: Build, Dependências e Infraestrutura (Execução Imediata)
1. **Correção de Pacotes & Dependências:**
   - Corrigir `apps/web/package.json` para Next.js estável (`^15.1.0`).
   - Adicionar `class-validator`, `class-transformer`, `argon2`, `otplib` (ou HMAC TOTP seguro), `vitest` e tipos em `apps/api/package.json`.
   - Adicionar `vitest` e ferramentas de teste.
2. **Evolução do Schema Prisma e Migrações Versionadas:**
   - Adicionar campos de MFA ao `User` (`mfaSecret`, `mfaEnabled`, `mfaRecoveryCodes`).
   - Criar modelo `OperatorSession` (`sessionHash`, `userId`, `expiresAt`, `revokedAt`, `ipAddress`, `userAgent`).
   - Criar migração versionada inicial (`prisma/migrations/20261109000000_init/migration.sql`) contendo as tabelas e o índice exclusivo parcial `Broadcast_one_active_per_unit`.
   - Implementar seed determinístico de desenvolvimento/teste com operador piloto e senha segura documentada (sem expor credencial real).
3. **Hardening de Docker e Compose:**
   - Adicionar Dockerfiles multi-stage limpos para `apps/api` e `apps/web`.
   - Atualizar `compose.yaml` com healthchecks para todos os serviços e rede interna estrita.
   - Atualizar `infra/mediamtx/mediamtx.yml` habilitando `api: true` na porta `9997` interna.

### Etapa 2: Módulo de Segurança e Autenticação
1. **Autenticação do Operador:**
   - Endpoints `/api/v1/operator/login`, `/api/v1/operator/mfa/verify`, `/api/v1/operator/logout`.
   - Hashing com Argon2id, proteção contra timing attacks, rate limiting agressivo (máx 5 tentativas/min).
   - Sessão via cookie `op_session` (HttpOnly, Secure, SameSite=Strict).
2. **RBAC por Unidade:**
   - Guard de autorização validando `ADMIN`, `OPERATOR`, `READ_ONLY` no escopo da `unitId`.
3. **Robustez do Viewer:**
   - Retry automático para conflitos de concorrência PostgreSQL `P2034` no resgate de convites.
   - Rate limit no resgate de convites `/v1/viewer/redeem`.
   - Endpoint de encerramento de sessão `/v1/viewer/logout`.

### Etapa 3: Streaming, Máquina de Estados e MediaMTX
1. **Máquina de Estados de Transmissão:**
   - Endpoints `/api/v1/operator/broadcasts/:id/(start|pause|resume|end)`.
   - Validações atômicas e idempotentes impedindo saltos ilegais de estado.
   - Registro detalhado em `AuditEvent` com `actorId`, `occurredAt`, `action`, `details`.
2. **Controle HLS Fail-Closed:**
   - Refatoração do `internal.controller.ts` para validação dinâmica de streamPath, fail-closed explícito em exceções e verificação de integridade do cookie.
3. **Integração de Saúde MediaMTX:**
   - Consulta interna à API do MediaMTX para verificar se o encoder SRT está conectado e transmitindo.

### Etapa 4: Interfaces (Portal do Espectador & Painel do Operador)
1. **Portal do Espectador (`apps/web/app/player.tsx`):**
   - Melhorias de acessibilidade (botões grandes, alto contraste, legendas descritivas, foco por teclado).
   - Limpeza ativa do buffer de vídeo e destruição imediata da instância HLS quando o status muda de `LIVE` para `PAUSED` ou `ENDED`.
2. **Painel do Operador (`apps/web/app/operator/`):**
   - Tela de login com suporte a código MFA (TOTP).
   - Dashboard com visualização do status SRT, estado da reunião, botões de ação com modais de confirmação contra cliques acidentais.
   - Gerador de convites com link copiável de uso único e botão de revogação imediata.

### Etapa 5: Suíte de Testes Automatizados e Hardening
1. Implementação dos 12 testes mandatórios da Seção 8 do Superprompt.
2. Scripts de backup e restore do PostgreSQL testados.
3. Documento de critérios GO / NO-GO (`docs/GO_NO_GO.md`) e Runbook de Domingo.

---

## 4. Próxima Ação Imediata
Após aprovação do plano, iniciaremos a **Etapa 1**, realizando as correções de código reais em `apps/api`, `apps/web`, `infra/` e `compose.yaml`, rodando os testes possíveis e entregando o Walkthrough completo com evidências.
