---
name: verify-hls-access
description: "Verifica acesso HLS segment-by-segment, sessão revogada/expirada, isolamento por broadcast e comportamento fail-closed do Caddy e NestJS."
---
# Testes de autorização HLS

1. Usar mídia **sintética**, autorizada ou de domínio público; nunca reunião real.
2. Verificar playlist e segmentos sem cookie: 403; cookie inválido/expirado/revogado: 403.
3. Verificar todas as fases não LIVE: nenhum segmento novo entregue.
4. Verificar convite de outro evento no mesmo `streamPath`: 403; revogação imediata (ressalvado buffer já entregue).
5. Verificar caminhos alternativos, query strings, HEAD/range, redirects, conexão direta à porta 8888, 5xx da API de auth: sem bypass.
6. Produzir tabela de testes e limites operacionais; nunca afirmar que DRM impede captura de tela.
