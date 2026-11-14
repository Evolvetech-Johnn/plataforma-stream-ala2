---
name: audit-starter
description: "Audita o scaffold da plataforma Transmissão da Ala, seus Dockerfiles, Compose, MediaMTX, Caddy, NestJS, Next.js, Prisma, proteção HLS e testes antes de implementar melhorias."
---
# Auditoria do repositório

1. Ler `AGENTS.md`, `SUPERPROMPT_ANTIGRAVITY.md`, `README.md`, `compose.yaml`, `.env.example` e toda a estrutura `apps`, `infra`, `docs`.
2. Inspecionar alterações já existentes (`git status`, `git diff`) antes de editar, preservando mudanças do usuário.
3. Verificar versões/dependências, build, config MediaMTX/Caddy, autenticação HLS, migrações, estado dos endpoints e UI.
4. Classificar achados por gravidade e anexar evidência arquivo/linha/teste.
5. Criar Implementation Plan com correções mínimas e métricas de aceite. Após revisão quando exigida, implementar e testar.
6. Produzir Walkthrough com PASS/FAIL/NOT RUN, riscos e próximos passos concretos.
