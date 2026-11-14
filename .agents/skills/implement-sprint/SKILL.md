---
name: implement-sprint
description: "Executa um sprint completo de implementação TypeScript da plataforma da ala: analisa, codifica, testa e fornece walkthrough verificável."
---
# Implementar sprint

1. Verificar requisito e aceitação em `SUPERPROMPT_ANTIGRAVITY.md`; ler os arquivos relevantes.
2. Definir diff pequeno com plano de implementação. Preservar o stack e evitar escopo adicional.
3. Implementar código real e alterar OpenAPI/schema/migrações/docs quando aplicável.
4. Rodar lint, typecheck, testes e build reais; para Docker usar Compose local apenas se autorizado e disponível.
5. Inspecionar mudanças e buscar regressões; explicar quaisquer testes não executados.
6. Entregar lista de arquivos, comandos/saídas resumidas, testes PASS/FAIL/NOT RUN, riscos, rollback e próxima tarefa.
7. Não fazer deploy remoto, push ou transmitir reunião real sem aprovação explícita.
