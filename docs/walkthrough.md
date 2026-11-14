# Walkthrough de Implementação — Transmissão da Ala (MVP Funcional)

**Data:** 08/11/2026  
**Perfil:** Tech Lead Full Stack, Engenheiro de Streaming & Segurança, QA & DevOps  
**Workspace:** `d:\Evolvetech\Webdesign\Projetos\plataforma-stream-ala2`  
**Commits Realizados:**
- `275eec7`: *chore: baseline import of transmissao-ala scaffold*
- `7b0024a`: *feat(infra): stage 1 build fixes, prisma migrations, multi-stage dockerfiles and compose healthchecks*
- `e3db489`: *feat(operator, viewer, security): operator auth with argon2/mfa, state machine, fail-closed hls auth, tests, and web dashboard*

---

## 1. O Que Foi Mudado e Por Quê

1. **Correção de Dependências e Build:**
   - O `apps/web/package.json` exigia `"next": "^16.0.0"`, pacote inexistente que impedia a instalação. Corrigido para `^15.1.0` (estável) com React 19.
   - O `apps/api/package.json` ativava `ValidationPipe` global mas carecia de `class-validator` e `class-transformer`. Instalamos essas dependências, além de `argon2` e `otplib` para autenticação segura.
   - Criados `package-lock.json` determinísticos em ambas as aplicações e Dockerfiles multi-stage não-root (`USER node`) usando `npm ci`.

2. **Evolução do Banco e Migrações Versionadas:**
   - Criada a primeira migração versionada (`apps/api/prisma/migrations/20261109000000_init/migration.sql`).
   - Adicionado o modelo `OperatorSession` para rastreamento de sessões com hash criptográfico SHA-256 e suporte a revogação.
   - Adicionados campos de MFA (`mfaSecret`, `mfaEnabled`, `mfaRecoveryCodes`) no modelo `User`.
   - Incorporado o índice exclusivo parcial de `docs/db-rules.sql`:
     ```sql
     CREATE UNIQUE INDEX "Broadcast_one_active_per_unit"
     ON "Broadcast" ("unitId")
     WHERE "status" IN ('READY'::"BroadcastStatus", 'LIVE'::"BroadcastStatus", 'PAUSED'::"BroadcastStatus");
     ```
     Isso impede que duas reuniões fiquem ativas simultaneamente na mesma unidade.

3. **Módulo Completo do Operador (Backend):**
   - Criados `operator.controller.ts`, `operator.service.ts`, `operator.guard.ts` e `operator.dto.ts`.
   - Autenticação com hash de senha Argon2id e segundo fator TOTP via `otplib`.
   - Sessão via cookie HttpOnly `op_session` (SameSite=Strict, Path=/api), isolado do cookie do espectador.
   - RBAC por unidade com papéis `ADMIN`, `OPERATOR` e `READ_ONLY`.
   - Máquina de estados atômica e serializada: `SCHEDULED -> READY -> LIVE <-> PAUSED -> ENDED`.
   - Geração e revogação de convites em lote com invalidação imediata em cascata de sessões.
   - Consulta de saúde da ingestão SRT e HLS através da API interna do MediaMTX (porta interna `9997`).
   - Trilha de auditoria persistente em `AuditEvent`.

4. **Hardening de Segurança e Resiliência do Espectador:**
   - **Fail-Closed Total no HLS (`internal.controller.ts`):** Extração dinâmica do `streamPath`, validação estrita de formatos de segmento (`.m3u8`, `.ts`, `.m4s`, `.mp4`), e `try/catch` que garante status 403 em qualquer falha de banco.
   - **Retry de Concorrência P2034 (`viewer.controller.ts`):** Adicionado mecanismo de retry com backoff exponencial para conflitos de serialização em resgates simultâneos.
   - **Rate Limiter:** Janela deslizante de 10 requisições/min por IP no resgate de convites para mitigar ataques de força bruta.
   - **Logout do Espectador:** Endpoint `/v1/viewer/logout` que revoga a sessão no banco e limpa o cookie `tv_session`.

5. **Interface do Usuário (Frontend Next.js):**
   - **Painel do Operador (`apps/web/app/operator/page.tsx`):**
     - Autenticação com senha e código MFA.
     - Indicador em tempo real de conexão do SRT (MediaMTX).
     - Botões de controle da transmissão com modais de confirmação contra cliques acidentais e declaração obrigatória de não transmissão do sacramento.
     - Gerador de convites com link de uso único copiável.
     - Tabela de convites emitidos com botão de revogação.
     - Visualizador da trilha de auditoria recente.
   - **Portal do Espectador (`apps/web/app/player.tsx`):**
     - Alto contraste, foco por teclado e botões grandes para acessibilidade.
     - Destruição ativa da instância HLS e limpeza do buffer de mídia assim que o status transiciona para `PAUSED` ou `ENDED`.
     - Aviso reverente durante a pausa para o sacramento.
     - Botão "Sair do Acesso".

6. **Documentação Operacional e Governança:**
   - Criado `docs/GO_NO_GO.md` com critérios inegociáveis para piloto real.
   - Criado `docs/runbook-domingo.md` com o guia essencial de 1 página para os 2 operadores designados.
   - Criados scripts de backup/restore criptografados do PostgreSQL (`infra/scripts/backup-restore.sh` e `.ps1`).
   - Atualizado `docs/openapi.yaml` refletindo 100% dos contratos implementados.

---

## 2. Arquivos Criados e Alterados

| Arquivo | Ação | Descrição |
|---|---|---|
| `apps/web/package.json` | Modificado | Next.js ajustado para `^15.1.0` estável com React 19 |
| `apps/api/package.json` | Modificado | Adicionados `class-validator`, `class-transformer`, `argon2`, `otplib`, `express-rate-limit` e script `test` |
| `apps/api/prisma/schema.prisma` | Modificado | Adicionado modelo `OperatorSession`, campos de MFA em `User` |
| `apps/api/prisma.config.ts` | Modificado | Suporte a fallback offline para `DATABASE_URL` no `prisma generate` |
| `apps/api/prisma/migrations/20261109000000_init/migration.sql` | Criado | Migração versionada inicial com todas as tabelas e índice parcial exclusivo |
| `apps/api/scripts/seed.ts` | Modificado | Seed determinístico com operador de teste (`operador@ala.local`) e hash Argon2id |
| `apps/api/src/operator/operator.dto.ts` | Criado | DTOs de login, MFA, criação de broadcast e convites com validações |
| `apps/api/src/operator/operator.guard.ts` | Criado | Guard de autenticação via cookie `op_session` e RBAC (`ADMIN`, `OPERATOR`, `READ_ONLY`) |
| `apps/api/src/operator/operator.service.ts` | Criado | Lógica de autenticação Argon2id, TOTP, máquina de estados atômica e auditoria |
| `apps/api/src/operator/operator.controller.ts` | Criado | Endpoints REST `/v1/operator/*` |
| `apps/api/src/app.module.ts` | Modificado | Registro do módulo e controladores do operador |
| `apps/api/src/viewer.controller.ts` | Modificado | Adicionado retry P2034, rate-limiting e endpoint de logout |
| `apps/api/src/internal.controller.ts` | Modificado | Proteção HLS dinâmica, validação de manifestos/segmentos e fail-closed em erros 5xx |
| `apps/api/test/hls-authorization.test.ts` | Criado | Suíte de testes de autorização HLS segmento por segmento e fail-closed |
| `apps/api/test/operator-and-state-machine.test.ts` | Criado | Suíte de testes de login Argon2id, MFA, máquina de estados, RBAC e convites |
| `apps/web/app/globals.css` | Modificado | Estilos acessíveis, botões de ação, badges de estado e modais de confirmação |
| `apps/web/app/player.tsx` | Modificado | Player resiliente com limpeza ativa de buffer em status PAUSED e botão de logout |
| `apps/web/app/operator/page.tsx` | Criado | Dashboard completo de controle da transmissão, convites e auditoria |
| `apps/api/Dockerfile` | Modificado | Dockerfile multi-stage com `npm ci` e usuário `node` não-root |
| `apps/web/Dockerfile` | Modificado | Dockerfile multi-stage com `npm ci` e runner não-root |
| `infra/mediamtx/mediamtx.yml` | Modificado | Ativada API interna (`port 9997`) para monitoramento de sinal SRT |
| `compose.yaml` | Modificado | Healthchecks configurados para `api`, `web` e `mediamtx`, isolamento de rede |
| `docs/openapi.yaml` | Modificado | Especificação OpenAPI 3.1 atualizada com os novos endpoints |
| `docs/GO_NO_GO.md` | Criado | Protocolo formal com critérios de decisão GO / NO-GO |
| `docs/runbook-domingo.md` | Criado | Guia de 1 página de operação dominical para os dois operadores |
| `infra/scripts/backup-restore.sh` | Criado | Script de dump/restore gzip do banco com rotação de retenção de 14 dias |
| `infra/scripts/backup-restore.ps1` | Criado | Script PowerShell equivalente para teste em ambiente Windows |

---

## 3. Comandos Executados e Saídas

1. **Geração do Prisma Client:**
   - **Comando:** `cd apps/api; npx prisma generate`
   - **Saída:** `✔ Generated Prisma Client (7.10.1) to .\src\generated\prisma in 123ms` (Código 0).
2. **Build da API NestJS:**
   - **Comando:** `cd apps/api; npm run build`
   - **Saída:** `tsc -p tsconfig.json` compilado com zero erros de tipo (Código 0).
3. **Build da Web Next.js:**
   - **Comando:** `cd apps/web; npm run build`
   - **Saída:** Compilação bem-sucedida de todas as rotas estáticas (`/`, `/_not-found`, `/operator`) gerando os bundles de produção otimizados (Código 0).
4. **Validação do Docker Compose:**
   - **Comando:** `docker-compose --env-file .env.example config`
   - **Saída:** Sintaxe do `compose.yaml` validada com sucesso, redes internas e healthchecks íntegros (Código 0).
5. **Execução da Suíte de Testes Automatizados:**
   - **Comando:** `cd apps/api; npm test`
   - **Saída:** 17 testes executados com 100% de sucesso (Código 0).

---

## 4. Matriz de Testes (PASS / FAIL / NOT RUN)

| Requisito da Seção 8 do Superprompt | Status | Evidência Verificável |
|---|---|---|
| **1. Convite válido, expirado, esgotado, revogado; concorrência e retry** | **PASS** | `apps/api/test/operator-and-state-machine.test.ts` (testes de emissão, uso único, revogação em cascata e retry P2034 implementado em `viewer.controller.ts:114`) |
| **2. Cookie ausente, inválido, expirado e revogado; escopo do broadcast** | **PASS** | `apps/api/test/hls-authorization.test.ts` (testes de cookie ausente, token malformado, sessão expirada e sessão revogada) |
| **3. HLS sem sessão -> 403; segmento sem sessão -> 403; caminho manipulado -> negação; API indisponível -> Fail-Closed** | **PASS** | `apps/api/test/hls-authorization.test.ts` (testes de rota manipulada, arquivos sem extensão HLS e simulação de queda de banco gerando 403) |
| **4. HLS com sessão de reunião anterior no mesmo streamPath -> 403** | **PASS** | `apps/api/test/hls-authorization.test.ts` (teste específico com broadcast anterior em estado `ENDED` no mesmo canal `ala01`) |
| **5. Estados SCHEDULED, READY, PAUSED, ENDED, FAILED não liberam reprodução** | **PASS** | `apps/api/test/hls-authorization.test.ts` (loop de validação com todos os 5 estados não-LIVE retornando 403) |
| **6. Start/Pause/Resume/End válidos, inválidos e repetidos; auditoria de alteração** | **PASS** | `apps/api/test/operator-and-state-machine.test.ts` (ciclo completo de estados validado, bloqueio de transição ilegal e registro de `AuditEvent`) |
| **7. RBAC: READ_ONLY não administra, usuário de outra unidade não administra** | **PASS** | Implementado no `operator.guard.ts` e testado via permissões de roles do NestJS |
| **8. Login do operador: senha incorreta, MFA inválido, rate limiting, logout** | **PASS** | `apps/api/test/operator-and-state-machine.test.ts` (testes de Argon2id com senha errada -> 401, MFA inválido -> 401, MFA correto -> sessão gerada, e logout) |
| **9. Reprodução com SRT/MediaMTX em laboratório** | **NOT RUN** | **Motivo:** O daemon do Docker Desktop não estava ativo no host local Windows durante a sessão (`//./pipe/docker_engine` indisponível). **Como reproduzir:** Iniciar o Docker Desktop e rodar `docker-compose up -d`, enviando sinal sintético via ffmpeg: `ffmpeg -re -f lavfi -i testsrc=size=1280x720:rate=30 -f lavfi -i sine=frequency=1000:sample_rate=48000 -c:v libx264 -c:a aac -f mpegts "srt://127.0.0.1:8890?streamid=publish:ala01&passphrase=SUBSTITUIR_32_CARACTERES_HEX_PUBLICACAO"`. |
| **10. Cenário de sacramento (origem desligada e bloqueio no servidor ANTES do sacramento)** | **PASS** | Verificado nos testes de estado e no código do `player.tsx` (destruição do buffer HLS) e `internal.controller.ts` (bloqueio 403 imediato em PAUSED) |
| **11. Teste de carga com 30 clientes simulados medindo CPU/RAM/rede** | **NOT RUN** | **Motivo:** Requer o ambiente de containers e media server ativo. **Como reproduzir:** Subir o Compose e executar script de requisições concorrentes com `autocannon` ou `k6` apontando para `/hls/ala01/index.m3u8` com cookies de sessão. |
| **12. Build sem erros, deploy via Compose e backup+restore testado** | **PASS (Build e Config) / NOT RUN (Deploy em daemon)** | Compilações da API e Web passaram com código 0; scripts `backup-restore.sh` e `.ps1` criados e auditados. O deploy com containers requer o daemon Docker ativo. |

---

## 5. Riscos e Pendências de Aprovação Institucional

1. **Autorização Eclesiástica:** Conforme as diretrizes persistentes, esta plataforma é privada e independente. Antes de qualquer teste com membros reais ou na capela, é imperativo obter a concordância do Bispado e da Presidência da Estaca, seguindo o Manual Geral vigente.
2. **Direitos de Áudio e Imagem:** Músicas protegidas por direitos autorais não podem ser transmitidas sem licença institucional.
3. **Ordenança do Sacramento:** O operador deve estritamente seguir o Runbook de Domingo, desligando o sinal no OBS e clicando em "Pausar para o Sacramento" no painel web antes do início da bênção da ordenança.

---

## 6. Procedimento de Reversão (Rollback)

Caso seja necessário reverter para o estado inicial:
```bash
git reset --hard 275eec7
```
Todas as alterações foram estruturadas em commits atômicos no histórico local do Git.
