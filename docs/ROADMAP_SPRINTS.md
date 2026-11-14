# Roadmap e Divisão de Sprints (Splits de Desenvolvimento) — Plataforma Transmissão da Ala

**Escopo:** 1 ala / até 30 espectadores simultâneos / 1 VPS Ubuntu LTS  
**Stack:** Next.js + NestJS + PostgreSQL (Prisma) + MediaMTX (SRT→HLS) + Caddy (TLS/Forward Auth) + Docker Compose  
**Invariantes:** Sem gravação/DVR, interrupção total antes do sacramento, fail-closed no HLS, privacidade LGPD e governança não-oficial.

---

## Visão Geral da Reorganização dos Splits

Para transformar o projeto em uma plataforma pronta para piloto assistido sem deixar pontas soltas de segurança e observabilidade, o trabalho foi reorganizado em **7 Sprints lógicos**:

```
┌────────────────────────────────────────────────────────────────────────┐
│ CONCLUÍDOS NO WORKSPACE (Fases 1 e 2 - Código, Segurança e QA)         │
├────────────────────────────────────────────────────────────────────────┤
│  Split 0: Auditoria Técnica e Baseline Git                   [100% OK] │
│  Split 1: Build, Dependências e Infraestrutura Base          [100% OK] │
│  Split 2: Autenticação, Máquina de Estados e Proteção HLS    [100% OK] │
│  Split 3: Segurança Operacional & Refinamento de UX          [100% OK] │
│  Split 4: Hardening, CI/CD e Teste de Carga (30 Viewers)     [100% OK] │
└────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌────────────────────────────────────────────────────────────────────────┐
│ HOMOLOGAÇÃO E GOVERNANÇA (Fase 3 - Validação Real e Piloto)            │
├────────────────────────────────────────────────────────────────────────┤
│  Split 5: Testes de Laboratório com Mídia Sintética e Docker [A SEGUIR]│
│  Split 6: Protocolo GO/NO-GO e Piloto Supervisionado         [PENDENTE]│
└────────────────────────────────────────────────────────────────────────┘
```

---

## Detalhamento de Cada Split

### ✅ Split 0 — Auditoria Técnica e Baseline
- **Objetivo:** Mapear todas as inconsistências do scaffold original e estabelecer baseline versionado.
- **Entregas Realizadas:**
  - Diagnóstico completo de vulnerabilidades e pacotes.
  - Repositório Git local inicializado e plano de implementação estruturado.
  - Documentação inicial consolidada.

---

### ✅ Split 1 — Build, Dependências e Infraestrutura Base
- **Objetivo:** Estabilizar o build e a infraestrutura de containers de forma reproduzível.
- **Entregas Realizadas:**
  - Correção de pacotes: Next.js 15 estável com React 19; `class-validator`, `argon2` e `otplib` no NestJS.
  - Dockerfiles multi-stage não-root (`USER node`) com `npm ci`.
  - Migração versionada inicial do Prisma com o índice único parcial `Broadcast_one_active_per_unit`.
  - Healthchecks configurados no `compose.yaml` e isolamento de rede Docker.
  - Script determinístico de seed com hash Argon2id (`apps/api/scripts/seed.ts`).

---

### ✅ Split 2 — Autenticação, Estados e Proteção HLS
- **Objetivo:** Implementar as regras de negócio de segurança, controle e reprodução controlada.
- **Entregas Realizadas:**
  - Login do operador com hash Argon2id, MFA (TOTP) e sessões via cookie `op_session` (SameSite=Strict, HttpOnly).
  - RBAC com escopo de unidade (`ADMIN`, `OPERATOR`, `READ_ONLY`).
  - Máquina de estados atômica: `SCHEDULED → READY → LIVE ↔ PAUSED → ENDED`.
  - Autorização HLS fail-closed por segmento/manifesto (`internal.controller.ts`).
  - Retry de concorrência PostgreSQL `P2034` e rate-limiting no resgate de convites.
  - Painel do Operador (`/operator`) e Portal do Espectador (`/`) responsivos e acessíveis.
  - Suíte de 17 testes automatizados passando com 100% de sucesso.

---

### ✅ Split 3 — Segurança Operacional & Refinamentos de UX
- **Objetivo:** Fechar as vulnerabilidades operacionais restantes e garantir autonomia completa pela interface web.
- **Entregas Realizadas:**
  - **Proteção Anti-CSRF:** Guard NestJS exigindo cabeçalho customizado (`X-Requested-With`) em todas as mutações (`POST`, `DELETE`).
  - **Rate Limiting no Login:** Limitador em janela deslizante (5 tentativas / 5 min) por IP no `/v1/operator/login` contra força bruta.
  - **Auto-Configuração de MFA:** Endpoints `/v1/operator/mfa/setup` e `/v1/operator/mfa/enable` e modal web completo no painel do operador.
  - **Formulário de Agendamento na Web:** Modal no painel do operador para criar novas transmissões (`POST /v1/operator/broadcasts`) com streamPath e agendamento.
  - **Feedback Visual de Buffer/Reconexão:** Indicador animado no player para reconexão e internet lenta.
  - **Rotina de Limpeza de Sessões:** Endpoint administrativo `/v1/operator/purge-expired` para expurgo de tokens/sessões com mais de 7 dias (LGPD).

---

### ✅ Split 4 — Hardening, CI/CD e Testes de Carga
- **Objetivo:** Garantir estabilidade com 30 clientes simultâneos e esteira automatizada de testes.
- **Entregas Realizadas:**
  - **Pipeline de CI (GitHub Actions):** `.github/workflows/ci.yml` configurado com Node.js 24 LTS executando lint, prisma generate, suíte de 21 testes, build de API e Web e validação do Compose.
  - **Simulador de Carga (30 Viewers):** Script automatizado `infra/scripts/load-test-30-viewers.ts` simulando 30 conexões concorrentes, medindo latência (mín, média, p95, p99), throughput e dimensionamento de egress VPS (45 Mbps).
  - **Logging Sanitizado Centralizado:** `LoggingInterceptor` global mascarando credenciais, tokens e cookies em todas as requisições HTTP.
  - **Script npm:** `"test:load"` integrado ao `apps/api/package.json`.

---

### ⚪ Split 5 — Homologação em Laboratório com Mídia Sintética
- **Objetivo:** Validar o pipeline completo em containers Docker com ingestão de vídeo/áudio sintéticos.
- **Tarefas a Implementar:**
  1. **Subida do Ambiente Compose:** Execução local de `docker-compose up -d` com banco Postgres e MediaMTX ativos.
  2. **Ingestão SRT Sintética:** Script com `ffmpeg` gerando stream teste de barras coloridas 720p30 + tom 1kHz para `srt://127.0.0.1:8890?streamid=publish:ala01`.
  3. **Verificação Ponta a Ponta:** Player reproduzindo vídeo ao vivo; verificação de bloqueio instantâneo ao pausar e fail-closed ao derrubar containers.
  4. **Validação de Backup/Restore:** Execução real do `backup-restore.sh` com inserção de dados, dump, drop do banco e restauração completa.
- **Critério de Pronto (DoD):** Vídeo sintético reproduzido no navegador via Caddy HTTPS/proxy com autorização restrita.

---

### ⚪ Split 6 — Governança Institucional e Piloto Supervisionado
- **Objetivo:** Alinhamento eclesiástico e condução do primeiro teste assistido com membros autorizados.
- **Tarefas a Implementar:**
  1. **Checklist GO/NO-GO:** Assinatura/validação dos critérios de [docs/GO_NO_GO.md](docs/GO_NO_GO.md) com os líderes da ala/estaca.
  2. **Conformidade Musical e de Privacidade:** Confirmação de regras de hinos e termo de consentimento dos oradores.
  3. **Ensaio Operacional com 2 Operadores:** Treinamento prático utilizando o [docs/runbook-domingo.md](docs/runbook-domingo.md) com ênfase na pausa pré-sacramento.
  4. **Emissão de Convites Nominais Restritos:** Distribuição de links de uso único apenas para membros com impossibilidade de comparecimento presencial.
- **Critério de Pronto (DoD):** Primeira transmissão autorizada realizada sem transmissão do sacramento e com encerramento auditado.

