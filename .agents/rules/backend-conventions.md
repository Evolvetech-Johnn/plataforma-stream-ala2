---
trigger: model_decision
description: "Convenções de NestJS, Prisma, PostgreSQL, autenticação e contratos REST ao alterar apps/api ou esquema do banco."
---
# Backend e banco

- Respeitar controller/service/repository quando fizer sentido, DTOs com validação, resposta padronizada e testes de autorização.
- Use Prisma com migrações versionadas; `db push` apenas no laboratório. Timestamps em UTC, índices e FKs adequados.
- Tokens em hash, controle por ala, sessões vinculadas a broadcast específico e testes de concorrência / estados.
- Exigir RBAC no backend (não apenas interface) e auditar mudanças administrativas sem vazar segredos.
- OpenAPI deve refletir apenas endpoints reais ou marcar explicitamente planejados.
