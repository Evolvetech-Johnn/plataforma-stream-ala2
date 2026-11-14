# Checklist de segurança e conformidade ANTES de usar em uma reunião real

- Confirmar autorização dos líderes e regras oficiais para transmissões, ordenanças, música e consentimento.
- Não transmitir a administração do sacramento: procedimento operacional deve interromper a origem antes do início.
- Garantir que nenhum fluxo esteja sendo gravado; sem DVR; guardar apenas dados mínimos.
- Implementar login do operador com MFA, autorização por unidade, CSRF e auditoria. **Não implementado neste pacote.**
- Implementar rate limiting e bloqueio de tentativas no resgate de convite; retry P2034 para transações serializáveis.
- Criar migrações versionadas com `prisma migrate dev` e usar `prisma migrate deploy` em produção.
- Gerar e commitar package-lock.json e substituir `npm install` por `npm ci` nos Dockerfiles.
- Criar procedimento de expiração/revogação, limite de sessões e limpeza diária de dados.
- Limitar retenção dos logs do Caddy e MediaMTX; não imprimir tokens ou cookies em logs.
- Validar se nenhuma playlist/segmento HLS é acessível sem sessão nem com sessão de outra transmissão.
- Testar revogação e pausa incluindo segmentos já pré-carregados pelo navegador.
- Considerar queda do DB como FAIL CLOSED: 500/502 do endpoint de autorização deve negar conteúdo.
- Fazer backup criptografado automático do PostgreSQL + teste de restauração fora do horário de reunião.
- Configurar HTTPS, DNS, atualizações e UFW para apenas TCP 22 restrito, 80, 443 e UDP 8890.
- Testar observabilidade, contingência e documentação de dois operadores.
- Não apresentar produto independente como plataforma oficial da Igreja sem autorização.
- Adicionar WAF/rate-limit/alertas conforme exposição pública e políticas de privacidade.

**STATUS:** POC técnico. Não está aprovado para produção nem completo para reuniões reais.
