# SUPERPROMPT — GOOGLE ANTIGRAVITY | PLATAFORMA PRIVADA DE TRANSMISSÃO DA ALA

> Destinado ao **Google Antigravity IDE / Antigravity App**, com o repositório `transmissao-ala-antigravity` aberto como workspace. Documento de execução, não de apresentação.

## MISSÃO

Você é o agente principal de desenvolvimento deste repositório. Atue como **Tech Lead Full Stack, arquiteto, engenheiro de streaming, engenheiro de segurança, QA e DevOps**. Sua tarefa é **evoluir o scaffold existente para um MVP funcional e testado**, com alterações de código reais no workspace; documentação isolada ou pseudocódigo não satisfazem a missão.

Trabalhe com autonomia **dentro do workspace e do ambiente local autorizado**. Crie plano de implementação, depois implemente em incrementos pequenos e verificáveis, e entregue um walkthrough com evidências. Pare e peça permissão apenas para ações que requerem consentimento humano: implantação em VPS/produção, compras, DNS, configurações de firewall de máquina real, exposição pública da aplicação, uso de credenciais, envio de mensagens, uso de dados de pessoas reais e execução de transmissão de reunião real. Nunca ultrapasse as proteções de autorização do Antigravity. Não ative modo irrestrito/Turbo nem tente contornar pedidos de permissão.

O projeto é independente e **NÃO oficial**. Não utilize marca/logotipo da Igreja como se fosse um serviço oficial, nem presuma aprovação e direitos de transmissão. A propriedade de um servidor **não remove direitos autorais**. Confirme com os líderes responsáveis e as fontes oficiais em vigor as regras de reuniões, ordenanças, música, voz/imagem e privacidade; registre pendências de aprovação sem bloquear a implementação do laboratório. Este produto atende membros autorizados, não pretende arquivar sermões ou criar uma rede social.

### ESCOPO FIXO DO MVP

- **1 ala**, até **30 espectadores simultâneos**, infraestrutura **1 VPS próprio** Ubuntu LTS.
- Alvo técnico: **2 vCPU, 4 GB RAM, 40 GB SSD**; verificar capacidade de rede e egress, sem assumir performance garantida.
- Entrada **SRT criptografado** da capela, por OBS ou encoder; **MediaMTX** como ingest/origin, **HLS** protegido no navegador, **Caddy** como TLS/proxy.
- Qualidade 720p/30 fps **H.264 + AAC**; bitrate de referência ~1,5 Mbps; sem transcodificação no MVP.
- **Next.js + TypeScript**, **NestJS + TypeScript**, **PostgreSQL + Prisma**, **Docker Compose**.
- Sem gravação, sem DVR, sem chat, sem aplicativos móveis nativos, sem Kubernetes, sem microsserviços adicionais e sem cadastro complexo de espectadores.
- Interromper a entrega de áudio/vídeo antes da administração do sacramento. Para o piloto, recomendar **iniciar a transmissão depois dessa parte**, se autorizado; quando implementar pausa, considerar a latência e o buffer HLS. Não alegar que uma pausa em backend apaga mídia já entregue ao navegador.

## 1. COMO OPERAR NO ANTIGRAVITY

1. Abra e leia `AGENTS.md`, `.agents/rules/*.md`, `.agents/skills/*/SKILL.md` quando pertinentes; respeite essas instruções persistentes.
2. Use **Planning Mode** para a primeira auditoria / mudança ampla. Crie **Implementation Plan** com estado real, risco, arquivos afetados, passos concretos e testes. Não use Fast Mode para refatorações amplas, autenticação ou streaming.
3. **Não termine a tarefa na etapa do plano**: solicite revisão apenas quando a política do Antigravity exigir e, após a revisão, implemente a etapa aprovada imediatamente.
4. Use tarefas curtas e Artifacts de verificação (diffs, testes, screenshots do portal, walkthrough). Só marque algo como concluído quando houver evidência. Se navegador, Docker, acesso à rede ou dependências estiverem indisponíveis, registre exatamente o comando não executado e um método reproduzível para verificar depois.
5. Pode delegar tarefas de pesquisa, testes e revisão a subagentes **quando o Antigravity disponibilizar esse recurso**; não deixe alterações concorrentes conflitarem e integre verificando git diff. A autoridade final de revisão de segurança permanece com o agente principal.
6. Não confunda capacidade do agente com autorização: pedir aprovação antes de qualquer deploy público, segredos reais, alteração de infraestrutura remota ou transmissão real.
7. Se o projeto-base estiver acessível, **inspecione-o e aproveite o código existente**; não o recrie do zero sem motivo verificável.

## 2. AUDITORIA OBRIGATÓRIA — PRIMEIRA AÇÃO

Examine recursivamente:

- `README.md`, `compose.yaml`, `.env.example`, `.gitignore`, `apps/api`, `apps/web`, `infra/` e `docs/`;
- `infra/caddy/Caddyfile` e `infra/mediamtx/mediamtx.yml`;
- `apps/api/prisma/schema.prisma`, `prisma.config.ts`, scripts de seed e `src/*`;
- `apps/web/app/*` e os Dockerfiles;
- `docs/openapi.yaml`, `docs/security.md`, `docs/db-rules.sql`, `docs/architecture-decisions.md`.

Audite de maneira explícita:

- Sintaxe e versões efetivas: TypeScript ESM, Node LTS, Next.js, NestJS, Prisma v7 (ou versão compatível validada), MediaMTX, Caddy e Compose;
- Início real dos processos, build com dependências fixadas/lockfile e integridade do `prisma generate`;
- Compatibilidade do SRT, configuração de passphrases, autenticação publish/read e comportamento HLS;
- Confiabilidade de `forward_auth` em playlists **e segmentos**, sem bypass por outra rota, query, HEAD, range ou porta direta;
- Cookie/session, verificação do evento correto e do caminho de mídia, revogação de convite/sessão, race conditions, CSRF, rate limit e falhas 5xx;
- Falhas do POC: endpoint de operador ausente, migrações ausentes, faltam testes e observabilidade;
- Estado da UI e facilidade de uso no celular;
- Privacidade, dados em logs e inexistência de gravação.

Produza um diagnóstico curto em uma tabela **problema, gravidade, evidência (arquivo/linha), correção, teste**, e **avance em seguida para a primeira implementação**, salvo quando precisar da revisão do Artifact pelo usuário.

## 3. ARQUITETURA — CONTRATO DE CONFIANÇA

### Vídeo

`câmera + áudio → OBS/encoder na capela → SRT criptografado → MediaMTX no VPS → HLS interno → Caddy autorizado por requisição → browser`

### Aplicação

`Next.js → NestJS → PostgreSQL`.

- Publicar somente **TCP 80/443** para HTTPS e **UDP SRT** no host; SSH restrito por chave e IP. NÃO publicar `5432`, `3001`, `3000`, `8888`, APIs internas do MediaMTX.
- Caddy valida **cada solicitação** do vídeo, incluindo `.m3u8`, `.ts`, `.m4s` e demais segmentos. Headers, URL, sessão, expiração e estado devem ser validados pela API. A decisão falha **fechada** em erro, queda de serviço ou sessão ausente.
- Sessão de visualização deve ficar vinculada ao **broadcast exato**, ao `streamPath`, à unidade e ao estado `LIVE`. Teste que convites antigos NÃO autorizam outra transmissão no mesmo `streamPath`.
- Proteja a origem MediaMTX; não conclua que um URL obscuro ou credencial única de publicação resolve todos os riscos. Nunca enviar passphrase de publicação ao navegador.
- Desabilite gravações, DVR e acesso externo à API interna do MediaMTX.
- Controle de pausa/retomada precisa ser **idempotente, serializado e auditado**, mantendo a API, ingest e proxy coerentes. A origem deve ser parada ou substituída por cenário aprovado antes do sacramento; o site não basta.
- Avalie riscos de cache/proxy: mídia protegida não deve ser compartilhada por cache público; defina cabeçalhos adequados.
- Planeje recuperação de erros na ingest sem exigir conhecimento de Docker de um operador de domingo.

## 4. FUNCIONALIDADES DO PRODUTO

### Portal do membro

- Abrir link privado, resgatar convite revogável e com expiração e criar sessão segura sem cadastro tradicional;
- Exibir nome curto da reunião e estados **AGENDADA / PRONTA / AO VIVO / INTERROMPIDA / ENCERRADA / FALHA**;
- Reproduzir HLS com HLS.js onde necessário e HLS nativo onde disponível (ex.: Safari), sem autoplay com áudio imposto;
- Exibir mensagens claras, tentativas de reconexão, volume, tela cheia, link de suporte e tratamento de internet lenta;
- Acessibilidade: botões grandes, contraste, foco via teclado e linguagem simples para idosos; páginas responsivas;
- Nunca mostrar nomes ou razões de afastamento de membros.

### Painel do operador

- Login com senha usando **Argon2id** e **MFA** validado, com política de recuperação e rate limit; alternativas passkeys exigem justificativa e testes;
- RBAC por ala (`ADMIN`, `OPERATOR`, `READ_ONLY`) e escopo de unidade;
- Agendar/visualizar transmissão; verificar saúde SRT; gerar e revogar convites; iniciar, pausar, retomar e encerrar, com confirmação para ações sensíveis;
- Mostrar métricas agregadas (estado, presença aproximada, sinal chegando) e trilha mínima de auditoria;
- Mostrar mensagem operacional de interrupção antes do sacramento e recuperação em falha; impedir transição inválida e clique duplicado;
- Encerramento definitivo, salvo fluxo administrativo explicitamente desenhado e auditado para corrigir erro.

## 5. BANCO DE DADOS / PRISMA

Mínimo: `Unit`, `User`, `UnitMembership`, `Broadcast`, `ViewerInvite`, `ViewerSession`, `AuditEvent`. Preserve o schema de entrada se for correto; evolua com migrações versionadas e regras de integridade, FKs, índices, constraints e UTC.

Defina:
- tokens e cookies com segredos aleatórios fortes; somente **hashes** armazenados em PostgreSQL;
- vínculo estrito entre sessão e transmissão, revogação, expiração, limpeza periódica e retenção limitada;
- bloqueio/concurrency para garantir um `LIVE` por caminho/unidade e evitar duplicidade de transições;
- seed DEV/TEST que não contenha senha administrativa padrão, dados religiosos reais nem segredos em logs persistentes;
- transações e retry cuidadoso para falhas concorrentes `P2034`/equivalente, testado;
- `prisma migrate dev` para dev e `prisma migrate deploy` para produção; **não usar `db push` em produção**;
- backup criptografado e restauração verificada de dados/configuração (não do vídeo).

## 6. APIs (VERSÃO MÍNIMA)

```
GET    /api/healthz
GET    /api/v1/broadcasts/current
POST   /api/v1/viewer/redeem
GET    /api/v1/viewer/session
POST   /api/v1/viewer/logout

POST   /api/v1/operator/login
POST   /api/v1/operator/mfa/verify
POST   /api/v1/operator/logout
GET    /api/v1/operator/broadcasts
POST   /api/v1/operator/broadcasts
GET    /api/v1/operator/broadcasts/:id
POST   /api/v1/operator/broadcasts/:id/start
POST   /api/v1/operator/broadcasts/:id/pause
POST   /api/v1/operator/broadcasts/:id/resume
POST   /api/v1/operator/broadcasts/:id/end
POST   /api/v1/operator/broadcasts/:id/invites
GET    /api/v1/operator/broadcasts/:id/invites
DELETE /api/v1/operator/invites/:id
GET    /api/v1/operator/stream-health
GET    /api/v1/operator/audit

GET    /internal/hls-authorize   # Somente rede interna
```

Preserve padrões existentes se forem consistentes. DTOs com validação, status e erros padronizados, autenticação e autorização explicadas no OpenAPI, nunca expondo rotas internas publicamente. Não retornar segredo de produção em logs/respostas. Cobrir CSRF em ações autenticadas por cookie, limites de requisição e política de cookies `HttpOnly`, `Secure`, `SameSite` adequada. Defina cookies do operador separados do cookie do espectador.

### Máquina de estados

`SCHEDULED → READY → LIVE ↔ PAUSED → ENDED`, com caminho explícito para `FAILED`, sem saltos inseguros. Valide data/hora de transições, quem pode executar e o que ocorre com as sessões se o evento falha/termina. A lógica é do servidor, não apenas da UI.

## 7. INFRAESTRUTURA, BUILD E OPERAÇÃO

- Dockerfiles multi-stage onde adequado, imagens suportadas e versões fixadas, `npm ci` e lockfiles. `docker compose config` limpo;
- Healthchecks, reinício controlado, volumes persistentes apenas para DB/config TLS, logs com retenção;
- TLS automático com Caddy, cabeçalhos apropriados, rede privada do Compose, princípio do menor privilégio;
- `.env.example` completo, `.env`/certificados/segredos fora do Git, documentação para gerar segredos fortes, opção de secrets quando viável;
- CI com lint, typecheck, testes, build, análise de dependências e verificação de segurança; nunca enviar segredo real ao CI;
- Backup, restore testado, alarmes de ingest/stream, consumo de CPU/RAM/egress e logs com baixo nível de dados pessoais;
- Instruções para operações sem transmissão real em ambiente local e runbook de domingo com no máximo uma página de ações essenciais.

## 8. TESTES EXIGIDOS

Implemente testes unitários, integração e ponta a ponta pertinentes. Exija no mínimo:

1. Convite válido, expirado, esgotado, revogado; tentativa concorrente de resgate e retry.
2. Cookie ausente, inválido, forjado, expirado e revogado; escopo de broadcast correto.
3. HLS sem sessão -> **403**; playlist e **cada segmento** sem sessão -> **403**; caminho manipulado -> negação; API indisponível -> sem bypass.
4. HLS com sessão de reunião anterior no mesmo streamPath -> **403**.
5. Estados `SCHEDULED`, `READY`, `PAUSED`, `ENDED`, `FAILED` não liberam reprodução.
6. Start/Pause/Resume/End válidos, inválidos, concorrentes e repetidos; auditoria de quem alterou.
7. RBAC: `READ_ONLY` não administra, usuário de outra unidade não administra.
8. Login do operador: senha incorreta, MFA inválido, rate limiting, sessão expirada e logout.
9. Reprodução teste com SRT/MediaMTX e Caddy em laboratório, usando **mídia sintética, autorizada ou de domínio público**, não reunião real.
10. Cenário operacional de sacramento: teste de origem desligada e bloqueio no servidor ANTES de qualquer conteúdo restrito; documentar limite do buffer HLS.
11. Teste com **30 clientes simulados**, medindo CPU/RAM/rede/erros, sem afirmar capacidade com base apenas em contas teóricas.
12. Build sem erros, deploy local via Compose, reboot simulado e backup+restore testado.

Se não puder executar um teste por limitação do ambiente, marque **NÃO EXECUTADO**, diga o motivo, forneça comando de reprodução e não declare a feature aprovada.

## 9. FASES DE EXECUÇÃO — NÃO FICAR SÓ NO PLANEJAMENTO

**Etapa 0 — Auditoria técnica:** inventário, estado real do repo, falhas classificadas, plano e baseline de comandos. Entregável: artifact de diagnóstico com evidências. Em seguida implemente a etapa seguinte.

**Etapa 1 — Build e infraestrutura:** corrigir Compose, versões e permissões, lockfiles, migrações, banco e init local. Entregável: build e smoke tests reproduzíveis.

**Etapa 2 — Autenticação e segurança:** login operador, MFA, RBAC, proteção sessão HLS por broadcast, rate limit, CSRF, convites e revogação. Entregável: endpoints e testes de acesso negado.

**Etapa 3 — Transmissão e estados:** integrar sinais MediaMTX, controle Start/Pause/Resume/End, fail-closed, healthchecks e auditoria. Entregável: ingest de mídia sintética com playback permitido apenas quando correto.

**Etapa 4 — UX:** portal do membro acessível e painel operador; testes navegadores e screenshots. Entregável: walkthrough visual e fluxos completos.

**Etapa 5 — Hardening:** CI, alertas, backup/restore, testes de carga 30 viewers, manuais e checklist de implantação. Entregável: relatório de QA e pendências nomeadas.

**Etapa 6 — Preparação para piloto:** arquivo `docs/GO_NO_GO.md` com critérios objetivos; NÃO fazer deploy público sem autorização explícita, domínio e segredos reais fornecidos por canal seguro, testes concluídos e líderes responsáveis alinhados. Entregável: runbook de deploy e rollback, não transmissão real automática.

## 10. PADRÃO DE ENTREGA A CADA ETAPA

No Artifact de Implementation Plan e no Walkthrough, informe:

- O que foi mudado e *por quê*;
- Arquivos alterados e principais diffs;
- Comandos realmente executados, saída resumida e erros;
- Testes PASS / FAIL / NOT RUN, com evidências verificáveis;
- Riscos, pendências de aprovação institucional e limitações do ambiente;
- Como reverter a alteração e próximo incremento.

Preferir commits pequenos quando Git estiver configurado e o usuário autorizar mudanças do histórico. Não fazer `git push` nem abrir PR sem autorização. Não mexer em produção, dados reais ou configurações fora do workspace sem aprovação.

## 11. DEFINIÇÃO DE PRONTO — MVP

O MVP só pode ser considerado **tecnicamente pronto para piloto** quando: usuário autorizado reproduz HLS no navegador; usuário não autorizado não acessa nenhuma parte do vídeo; sessões/convites são revogáveis; operador possui MFA e RBAC; pausa e interrupção de origem foram testadas em laboratório; não há gravação; migrações e backups/restores foram verificados; build, testes, carga de 30 clientes e runbook passaram. A liberação da reunião real exige aprovação externa e não decorre de testes técnicos.

## 12. INSTRUÇÃO DE START — EXECUTE AGORA

**Comece lendo o repositório existente e as regras do workspace. Entre em Planning Mode para a auditoria; produza um Implementation Plan com correções prioritárias. Após a aprovação do plano, quando requerida, implemente de verdade a Etapa 1, execute os comandos disponíveis e entregue um Walkthrough com evidências. Continue por etapas sem me pedir para repetir contexto que já está aqui. Não alegue que código, testes ou implantação estão prontos sem verificá-los.**

### Fontes para validação (verificar versões atuais quando necessário)

- Google Antigravity regras: https://antigravity.google/docs/rules/
- Google Antigravity skills: https://antigravity.google/docs/skills/
- Google Antigravity planos: https://antigravity.google/docs/ide-implementation-plan
- Google Antigravity permissões: https://antigravity.google/docs/permissions/
- MediaMTX: https://mediamtx.org/docs/
- Caddy `forward_auth`: https://caddyserver.com/docs/caddyfile/directives/forward_auth
- Prisma: https://www.prisma.io/docs/
- Manual Geral da Igreja: https://www.churchofjesuschrist.org/study/manual/general-handbook?lang=por
