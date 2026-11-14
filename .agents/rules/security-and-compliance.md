---
trigger: always_on
description: "Invariantes de privacidade, direitos de transmissão e segurança da plataforma de reuniões da ala."
---
# Segurança, privacidade e conformidade

- Respeitar Manual Geral vigente, aprovação dos líderes, LGPD e direitos de músicas/imagem. Hospedagem própria não contorna direitos autorais.
- Sem gravações/DVR; sem dados de saúde ou justificativas de ausência. Não incluir nomes de espectadores em métricas.
- Nunca entregar HLS sem validação por segmento/playlist, sessão, reunião exata em LIVE e streamPath. Erros 5xx de autorização devem negar acesso. Sem cache público de mídia privada.
- Tokens aleatórios fortes e hashes em banco. Cookies HttpOnly+Secure e política SameSite apropriada; CSRF no painel; MFA e rate limit no operador.
- Segredos e logs: nunca printar token, cookie, senha, convite ou chave SRT. Não comitar `.env`; sanitizar logs.
- Nenhum deploy externo, transmissão real, compra, mudança de DNS/firewall de VPS ou uso de dados reais sem aprovação explícita do usuário.
