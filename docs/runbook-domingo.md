# Runbook de Domingo — Operação de Transmissão da Ala

Guia de 1 página para os 2 operadores designados para a transmissão dominical.

---

## 1. Preparação (30 Minutos Antes da Reunião)
1. **Conexão dos Equipamentos na Capela:**
   - Ligar câmera e mesa de áudio ao computador de transmissão.
   - Abrir o OBS Studio e carregar o perfil da Ala (720p / 30 fps / 1.500 kbps / Keyframe 2s).
2. **Acesso ao Painel do VPS:**
   - Acessar `https://SEU_DOMINIO/operator` pelo navegador do operador.
   - Efetuar login com e-mail, senha e código MFA do aplicativo autenticador.
3. **Verificação do Sinal:**
   - Iniciar transmissão no OBS Studio (SRT criptografado).
   - Confirmar no painel que o badge exibe **"Sinal SRT Conectado (Encoder Ativo)"**.
4. **Distribuição dos Convites:**
   - No painel, gerar os convites individuais necessários e encaminhar privadamente para os membros autorizados.

---

## 2. Início da Reunião Sacramental
- Ao soar o prelúdio e início dos anúncios, clicar no botão **"▶ Iniciar Transmissão (AO VIVO)"**.
- Confirmar no modal a declaração de não transmissão da ordenança.
- O portal público liberará a reprodução para os espectadores autorizados.

---

## 3. ⚠️ PROCEDIMENTO OBRIGATÓRIO: ADMINISTRAÇÃO DO SACRAMENTO
> **A administração do sacramento NÃO pode ser transmitida sob nenhuma hipótese.**

1. **Antes da Ordenança (durante o hino sacramental):**
   - **Passo 1 (Painel Web):** Clicar no botão amarelo **"⏸ Pausar para o Sacramento"**.
   - **Passo 2 (OBS na Capela):** Clicar em **"Interromper Transmissão"** (Stop Streaming) ou alternar para tela estática de espera sem áudio.
   - *Nota:* O bloqueio no servidor é instantâneo para todas as novas solicitações HLS. Os espectadores verão a mensagem de pausa por reverência à ordenança.
2. **Após a Conclusão do Sacramento:**
   - **Passo 1 (OBS na Capela):** Reiniciar a transmissão do sinal de vídeo e áudio.
   - **Passo 2 (Painel Web):** Clicar em **"▶ Retomar Transmissão (Pós-Sacramento)"**.
   - O player dos membros reconectará automaticamente ao sinal ao vivo.

---

## 4. Encerramento da Reunião
1. Após a última oração, clicar no botão vermelho **"⏹ Finalizar Transmissão"**.
2. Confirmar o encerramento. Todas as sessões dos membros serão imediatamente revogadas.
3. No OBS Studio, clicar em **"Interromper Transmissão"** e desligar os equipamentos.

---

## 5. Contingência e Emergência
- **Queda de Internet na Capela:** O OBS tentará reconectar automaticamente. Aguarde 30 segundos. Se não voltar, atualize o painel.
- **Vazamento do Link:** Clique em **"Revogar"** ao lado do convite comprometido no painel para desconectar imediatamente o espectador.
- **Interrupção de Emergência:** Feche o OBS e execute no terminal do VPS: `docker compose stop mediamtx`.
