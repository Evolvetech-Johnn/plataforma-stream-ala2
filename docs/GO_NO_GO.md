# Critérios Objetivos de GO / NO-GO para Piloto Operacional

Este documento estabelece o protocolo mandatório de decisão antes de realizar qualquer transmissão em ambiente real. **A aprovação técnica em laboratório NÃO autoriza automaticamente uma transmissão real.**

---

## 1. Condições Inegociáveis para "GO" (Autorização Completa)

Todos os itens abaixo devem estar rigorosamente cumpridos. A ausência de um único item configura status **NO-GO imediato**.

### A. Conformidade Institucional e Legal
- [ ] **Autorização Expressa dos Líderes:** Confirmação por escrito do Bispo da Ala e do Presidente da Estaca para a realização do piloto fechado.
- [ ] **Direitos Autorais e Músicas:** Verificação de que hinos e prelúdios estão em conformidade com o Manual Geral (direitos de transmissão de áudio protegidos por copyright não são contornados por hospedagem privada).
- [ ] **Privacidade e Consentimento:** Confirmação de que oradores e participantes estão cientes e consentiram com a transmissão restrita para membros autorizados.
- [ ] **Ordenança do Sacramento Protegida:** Procedimento operacional validado por 2 operadores treinados para desligar a origem e pausar o sinal antes do início da ordenança sagrada.

### B. Segurança e Infraestrutura Técnica
- [ ] **VPS com Firewall Rígido:** Apenas portas `80/tcp`, `443/tcp` e `8890/udp` (SRT) expostas. SSH restrito por chave pública a IPs administrativos específicos. Nenhuma porta de banco (`5432`) ou HLS direto (`8888`) aberta no host.
- [ ] **Segredos de Produção Únicos:** Variáveis `.env` geradas via `openssl rand -hex 24` para banco de dados e passphrases SRT (`SRT_PUBLISH_PASSPHRASE`). Nenhum valor padrão ou de teste mantido.
- [ ] **TLS Automático Ativo:** Certificado HTTPS emitido pelo Caddy via Let's Encrypt para o domínio homologado.
- [ ] **Sem Gravações em Disco:** Verificação de que `record: false` permanece ativo no MediaMTX e nenhuma gravação ou DVR está habilitado.
- [ ] **Autenticação do Operador com MFA:** Conta do operador configurada com senha forte Argon2id e autenticação em dois fatores (TOTP) ativada.
- [ ] **Rotinas de Backup Testadas:** Script de dump criptografado do PostgreSQL e restauração validada em ambiente de teste.

---

## 2. Critérios de "NO-GO" Imediato (Cancelamento da Transmissão)

Se qualquer uma das condições abaixo for detectada antes ou durante a reunião, a transmissão deve ser cancelada:
1. **Falta de confirmação formal dos líderes da unidade.**
2. **Instabilidade severa da conexão SRT na capela** (perda de pacotes > 5% ou bitrate oscilando abaixo de 800 kbps).
3. **Ausência de segundo operador treinado** presente para controlar a pausa antes do sacramento.
4. **Vazamento público do link ou token de acesso.**
5. **Falha de certificado SSL/TLS no domínio.**

---

## 3. Protocolo de Rollback Imediato
Em caso de anomalia durante a reunião:
1. **No Painel do Operador:** Pressionar imediatamente o botão **"Pausar para o Sacramento"** ou **"Finalizar Transmissão"**.
2. **No OBS / Encoder da Capela:** Clicar imediatamente em "Interromper Transmissão" (Stop Streaming).
3. **Pela Linha de Comando no VPS (Contingência Extrema):**
   ```bash
   docker compose stop mediamtx
   ```

