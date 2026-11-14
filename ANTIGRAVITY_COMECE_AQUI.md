# Comece aqui — Google Antigravity

## Qual pacote usar

Este ZIP já contém o projeto-base e a configuração de agentes para Antigravity. **Não misture com a pasta de produção nem sobrescreva um repositório que já possua mudanças próprias.** Faça backup ou commit do projeto existente antes de extrair arquivos sobre ele.

## Instalação de uso (sem deploy)

1. Descompacte o ZIP e abra **a pasta raiz `transmissao-ala-antigravity/`** como workspace/projeto no Google Antigravity IDE ou Antigravity App.
2. Verifique que `AGENTS.md` e `.agents/skills` estão presentes; arquivos ocultos `.agents` precisam permanecer na pasta raiz.
3. Selecione **Planning Mode** para o primeiro trabalho; mantenha a política de permissões **Default/Request Review**, não Turbo.
4. Abra `SUPERPROMPT_ANTIGRAVITY.md` e envie ao agente a mensagem abaixo. O documento de instrução e as regras do workspace são complementares.
5. Revise o Artifact **Implementation Plan** quando apresentado. Clique em Proceed apenas se concordar com as alterações. A partir daí o agente deve implementar código e entregar um **Walkthrough** com evidências.
6. Depois da primeira fase, execute tarefas com referência a `implement-sprint` e `verify-hls-access` (skills reconhecidas em `.agents/skills`).
7. Não forneça senhas reais da capela, listas sensíveis de membros nem acesso ao VPS antes do fechamento da auditoria e da autorização de deploy.

## Mensagem inicial para colar no Antigravity

> Você será o agente principal deste projeto. Leia `AGENTS.md`, `SUPERPROMPT_ANTIGRAVITY.md`, `README.md`, `docs/security.md` e as skills pertinentes. Execute a skill `audit-starter`: audite integralmente o scaffold, apresente um Implementation Plan com riscos e correções prioritárias e, após a revisão exigida pelo Antigravity, **implemente a Etapa 1 no código real**, execute os testes possíveis e apresente um Walkthrough verificável. Não pare no planejamento, não ignore arquivos já existentes e não implante ou transmita nada publicamente sem autorização explícita.

## Como acompanhar

- **Plano**: o que será alterado e por quê.
- **Diff**: alterações reais no workspace.
- **Testes**: PASS/FAIL/NOT RUN com comandos e saídas.
- **Walkthrough**: resultado final e pendências.
- **GO/NO-GO**: uso em reunião real apenas após testes, autorização dos líderes e validação de direitos/privacidade.

## Referências oficiais do Antigravity

- https://antigravity.google/docs/rules/
- https://antigravity.google/docs/skills/
- https://antigravity.google/docs/ide-implementation-plan
- https://antigravity.google/docs/permissions/
