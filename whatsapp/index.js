// whatsapp/index.js

require('dotenv').config();
const { webcrypto } = require('node:crypto');
if (!global.crypto) global.crypto = webcrypto;

const fs = require('fs-extra');
const path = require('path');
const qrcode = require('qrcode-terminal');
const mime = require('mime-types');
const { default: makeWASocket, useMultiFileAuthState, DisconnectReason } = require('@whiskeysockets/baileys');
const { Boom } = require('@hapi/boom');

// Importar o novo processador de mensagens (substitui o agent antigo)
const { processMessage } = require('../agent/messageProcessor');
const { getUserContext, updateUserContext } = require('../agent/userContextManager');

async function startSock() {
  const { state, saveCreds } = await useMultiFileAuthState('./auth');

  const sock = makeWASocket({
    auth: state,
    printQRInTerminal: false,
    markOnlineOnConnect: true,
    defaultQueryTimeoutMs: 30000,
    keepAliveIntervalMs: 30000,
    connectTimeoutMs: 60000,
    browser: ['AutoWork Finance', 'Chrome', '10.0']
  });

  sock.ev.on('creds.update', saveCreds);

  sock.ev.on('connection.update', ({ connection, lastDisconnect, qr }) => {
    if (qr) {
      qrcode.generate(qr, { small: true });
      console.log("📲 Escaneie o QR Code acima para conectar ao WhatsApp");
    }

    if (connection === 'close') {
      const shouldReconnect = new Boom(lastDisconnect?.error)?.output?.statusCode !== DisconnectReason.loggedOut;
      console.log('🔁 Reconectando...', lastDisconnect?.error);
      if (shouldReconnect) startSock();
    } else if (connection === 'open') {
      console.log('✅ Conectado com sucesso ao WhatsApp!');
    }
  });

  sock.ev.on('messages.upsert', async ({ messages, type }) => {
    if (type !== 'notify') return;

    const msg = messages[0];
    if (!msg.message || msg.key.fromMe) return;

    const sender = msg.key.remoteJid;

    // Verifica número autorizado (opcional - você pode remover esta verificação para permitir qualquer usuário)
    const numeroAutorizado = '553299642181@s.whatsapp.net'; // <- seu número com DDI e DDD
    if (sender !== numeroAutorizado) {
      console.log(`❌ Número não autorizado: ${sender}`);
      return;
    }

    // Extração do texto da mensagem (mantida do código original)
    let texto = '';
    if (msg.message.conversation) {
      texto = msg.message.conversation;
    } else if (msg.message.extendedTextMessage?.text) {
      texto = msg.message.extendedTextMessage.text;
    } else if (msg.message.imageMessage?.caption) {
      texto = msg.message.imageMessage.caption;
    }

    if (!texto.trim()) {
      console.log(`📭 Mensagem sem texto de ${sender}`);
      return;
    }

    console.log(`🤖 Mensagem recebida de ${sender}: ${texto}`);
    await sock.sendPresenceUpdate('composing', sender);

    try {
      // Nova implementação usando o processador de mensagens
      const userContext = await getUserContext(sender);
      
      // Processar a mensagem com o novo sistema
      const result = await processMessage({
        text: texto,
        userId: sender,
        timestamp: new Date().toISOString()
      }, userContext, sock);
      
      // Registrar a interação no contexto do usuário
      await updateUserContext(sender, {
        text: texto,
        timestamp: new Date().toISOString(),
        intent: result.intent || 'unknown',
        success: result.success
      });

      // Se o processador não enviou resposta diretamente (compatibilidade com código anterior)
      if (result && !result.responseSent) {
        if (typeof result.response === 'string') {
          await sock.sendMessage(sender, { text: result.response });
        } else if (result.response?.tipo === 'texto') {
          await sock.sendMessage(sender, { text: result.response.conteudo });
        } else if (result.response?.tipo === 'imagem') {
          for (let imagem of result.response.imagens) {
            const buffer = fs.readFileSync(imagem.caminho);
            const mimeType = mime.lookup(imagem.caminho);
            await sock.sendMessage(sender, {
              image: buffer,
              mimetype: mimeType,
              caption: imagem.legenda
            });
          }
        }
      }

    } catch (error) {
      console.error('Erro no processamento:', error);
      await sock.sendMessage(sender, { text: '⚠️ Ocorreu um erro interno ao processar sua mensagem.' });
    }
  });

  return sock;
}

// Exportar a função para poder ser usada em outros lugares
module.exports = {
  startSock
};

// Iniciar o socket se este arquivo for executado diretamente
if (require.main === module) {
  startSock();
}
