# Transmissão Local — Scaffold técnico para 1 ala

Projeto de referência **não oficial**. Arquitetura: Caddy HTTPS + Web Next.js + API NestJS + PostgreSQL/Prisma + MediaMTX SRT→HLS. Alvo: até 30 espectadores, um vídeo 720p sem transcodificação. NÃO há gravação.

**AVISO IMPORTANTE:** este pacote é um **POC inicial**, e não uma plataforma final. O resgate de convites, a recuperação de sessão e a proteção de segmentos estão implementados como ponto de partida. A autenticação do operador, seus comandos, rate limiting, migrações versionadas, testes e observabilidade permanecem pendentes. Não use em reunião real antes de terminar `docs/security.md`.

## 1. Pré-requisitos

- VPS Linux 2 vCPU / 4 GB RAM / SSD 40 GB, domínio válido, Docker Engine e Compose Plugin.
- Portas 80/tcp, 443/tcp e 8890/udp liberadas; SSH limitado a IPs de administradores.
- DNS A do domínio para o IP público do VPS, sem proxy HTTP para UDP 8890.
- Permissão de líderes e validação das regras de privacidade/uso de músicas.

## 2. Configurar

```bash
cp .env.example .env
# Editar SITE_DOMAIN, ACME_EMAIL e três segredos; não use dados do exemplo.
chmod 600 .env
openssl rand -hex 24   # repetir para senha do DB e passphrases SRT
```

NÃO coloque `.env` no Git. Gere senhas sem `$` e outros caracteres que requerem escaping do Compose, ou faça o escaping corretamente.

## 3. Iniciar POC

```bash
docker compose config  # validar interpolação dos parâmetros
docker compose build
docker compose up -d db mediamtx api web caddy
# Apenas para teste local! Não usar `db push` no pipeline de produção.
docker compose exec api npx prisma db push
# Gerar uma reunião SCHEDULED e convite de teste:
docker compose exec api npm run db:seed
curl -I https://SEU_DOMINIO/api/healthz
```

Se `prisma db push` pedir confirmação de migração destrutiva, interrompa e revise. O seed imprime token em stdout: trate como segredo e evite guardar logs.

## 4. Publicar teste com OBS ou FFmpeg

Entrada SRT MediaMTX (público, UDP 8890), com passphrase `SRT_PUBLISH_PASSPHRASE`:

```text
srt://IP_DO_VPS:8890?streamid=publish:ala01&passphrase=SUA_SRT_PUBLISH_PASSPHRASE&pkt_size=1316
```

Configure H.264 + AAC, 720p30, ~1,5 Mbps, keyframe a cada 2s. Não inclua nenhuma cerimônia privada em testes.

O player público usa `/hls/ala01/index.m3u8`. O servidor **não deve** permitir playback se o estado não for `LIVE`, se o cookie faltar ou se o convite não for válido.

### Exercício de laboratório (NÃO é um controle operacional)

Após criar a transmissão de teste, você pode verificar manualmente o bloqueio e a liberação alterando o estado no banco:

```bash
# Executar apenas no ambiente de laboratório (substituir valores de .env):
docker compose exec db psql -U app_transmissao -d transmissao -c 'UPDATE "Broadcast" SET status = '''LIVE''' WHERE slug LIKE '''reuniao-%''';'
# Após o teste, voltar a SCHEDULED ou ENDED.
```

O operador ainda não possui botões no projeto. Não usar a alteração manual de banco para reuniões reais.

## 5. Segurança do player

- Caddy aplica `forward_auth` a **cada** requisição HLS, inclusive playlists e segmentos.
- NestJS exige cookie HttpOnly Secure com sessão hash no PostgreSQL, convite válido e reunião `LIVE`.
- Porta 8888 não é publicada no host; porta SRT 8890 usa passphrase forte diferente para publicação e leitura.
- O player não permite salvar gravações por padrão, mas isso **não impede captura de tela**.
- A pausa no servidor não descarta instantaneamente mídia já armazenada no buffer do navegador.

## 6. Portas

| Origem | Porta | Acesso |
|---|---:|---|
| Caddy | 80/tcp, 443/tcp | Público |
| MediaMTX SRT | 8890/udp | Origem da capela (ideal filtrar IP quando possível) |
| MediaMTX HLS | 8888/tcp | Só rede Docker |
| API NestJS | 3001/tcp | Só rede Docker |
| Next.js | 3000/tcp | Só rede Docker |
| PostgreSQL | 5432/tcp | Só rede Docker |

## 7. Arquitetura da aplicação

- `apps/web`: portal responsivo de convite e player; não é painel de operador.
- `apps/api`: saúde, estado da transmissão, convite, autorização HLS.
- `apps/api/prisma/schema.prisma`: modelo para unidade, operadores, eventos e convites.
- `docs/openapi.yaml`: contrato atual e endpoints previstos (marcados PLANEJADO).
- `docs/architecture-decisions.md`: fluxos, máquina de estados, integridade e aceitação.
- `docs/db-rules.sql`: índice parcial para converter em migração versionada.
- `infra/`: proxy HTTPS e media server.

## 8. Próximo sprint

1. Implementar autenticação do operador com MFA, RBAC por ala e logs de auditoria.
2. Implementar estados e painel Start/Pause/Resume/End com checagem de segurança.
3. Limites de requisições no endpoint de convites e proteção antifraude; retry de transações.
4. Migrações versionadas, testes automatizados e health checks de ingest SRT/HLS.
5. Procedimento de interrupção antes da administração do sacramento e treinamento de dois operadores.
6. Backups, métricas, alertas e operação validada com os líderes.

## Fontes técnicas

- https://mediamtx.org/docs/publish/srt
- https://mediamtx.org/docs/features/configuration
- https://caddyserver.com/docs/caddyfile/directives/forward_auth
- https://www.prisma.io/docs/guides/v7/frameworks/nestjs
- https://www.churchofjesuschrist.org/study/manual/general-handbook/29-meetings-in-the-church?lang=por
