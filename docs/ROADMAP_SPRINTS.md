# Roadmap e Divisão de Sprints (Splits de Desenvolvimento) — Plataforma Transmissão da Ala

**Escopo:** 1 ala / até 30 espectadores simultâneos / 1 VPS Ubuntu LTS  
**Stack:** Next.js + NestJS + PostgreSQL (Prisma) + MediaMTX (SRT→HLS) + Caddy (TLS/Forward Auth) + Docker Compose  
**Invariantes:** Sem gravação/DVR, interrupção total antes do sacramento, fail-closed no HLS, privacidade LGPD e governança não-oficial.

---

## Visão Geral da Reorganização dos Splits

Para transformar o projeto em uma plataforma pronta para piloto assistido sem deixar pontas soltas de segurança e observabilidade, o trabalho foi reorganizado em **7 Sprints lógicos**:

```
┌────────────────────────────────────────────────────────────────────────┐
│ ENTREGUES (Fase 1 - Fundação e MVP Funcional)                          │
├────────────────────────────────────────────────────────────────────────┤
│  Split 0: Auditoria Técnica e Baseline Git                   [100% OK] │
│  Split 1: Build, Dependências e Infraestrutura Base          [100% OK] │
│  Split 2: Autenticação, Máquina de Estados e Proteção HLS    [100% OK] │
└────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌────────────────────────────────────────────────────────────────────────┐
│ PRÓXIMAS ETAPAS DE CÓDIGO (Fase 2 - Fechamento Técnico no Workspace)   │
├────────────────────────────────────────────────────────────────────────┤
│  Split 3: Segurança Operacional & Refinamento de UX          [A SEGUIR]│
│  Split 4: Hardening, CI/CD e Teste de Carga (30 Viewers)     [PENDENTE]│
└────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌────────────────────────────────────────────────────────────────────────┐
│ HOMOLOGAÇÃO E GOVERNANÇA (Fase 3 - Validação Real e Piloto)            │
├────────────────────────────────────────────────────────────────────────┤
│  Split 5: Testes de Laboratório com Mídia Sintética e Docker [PENDENTE]│
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

### 🟡 Split 3 — Segurança Operacional & Refinamentos de UX (Próximo Sprint de Código)
- **Objetivo:** Fechar as vulnerabilidades operacionais restantes e garantir autonomia completa pela interface web.
- **Tarefas a Implementar:**
  1. **Proteção Anti-CSRF Reforçada:** Guard NestJS exigindo cabeçalho customizado (`X-Requested-With` ou token CSRF) em mutações (`POST`, `DELETE`).
  2. **Rate Limiting no Login do Operador:** Bloqueio temporário (5 tentativas / 5 min) por IP no `/v1/operator/login` contra força bruta.
  3. **Auto-Configuração de MFA pelo Operador:** Endpoints `/v1/operator/mfa/setup` e `/v1/operator/mfa/enable` para geração de QR Code/URI e validação do primeiro token.
  4. **Formulário de Agendamento na Web:** Modal no painel do operador para criar transmissões (`POST /v1/operator/broadcasts`) sem depender do terminal.
  5. **Feedback Visual de Buffer/Reconexão:** Indicador animado no player para internet lenta ou oscilação de rede do espectador.
  6. **Rotina de Limpeza de Sessões:** Endpoint administrativo e script de expurgo de tokens/sessões com mais de 7 dias (privacidade LGPD).
- **Critério de Pronto (DoD):** Operador cria nova reunião pela web, ativa MFA sem tocar no banco, e ataques de força bruta/CSRF são barrados.

---

### 🟡 Split 4 — Hardening, CI/CD e Testes de Carga
- **Objetivo:** Garantir estabilidade com 30 clientes simultâneos e esteira automatizada de testes.
- **Tarefas a Implementar:**
  1. **Pipeline de CI (GitHub Actions):** `.github/workflows/ci.yml` executando lint, typecheck, prisma generate, testes unitários e build de API e Web a cada push.
  2. **Simulador de Carga (30 Viewers):** Script automatizado (TypeScript / Node.js) que abre 30 conexões concorrentes requisitando manifestos e segmentos HLS em loop de 60 segundos, gerando relatório de latência, throughput e erros.
  3. **Padronização de Logs e Sanitização:** Interceptor global no NestJS para formatar logs em JSON, mascarando tokens, cookies e IPs.
- **Critério de Pronto (DoD):** CI verde no GitHub e relatório de benchmark com 30 clientes simulados mantendo taxa de erro 0%.

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

