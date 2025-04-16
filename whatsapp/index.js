require('dotenv').config();
const { webcrypto } = require('node:crypto');
if (!global.crypto) global.crypto = webcrypto;

const fs = require('fs-extra');
const path = require('path');
const qrcode = require('qrcode-terminal');
const mime = require('mime-types');
const { default: makeWASocket, useMultiFileAuthState, DisconnectReason } = require('@whiskeysockets/baileys');
const { Boom } = require('@hapi/boom');
const agent = require('../agent/agent'); // << CÉREBRO IA

async function startSock() {
  const { state, saveCreds } = await useMultiFileAuthState('./auth');

  const sock = makeWASocket({
    auth: state,
    printQRInTerminal: false,
    markOnlineOnConnect: true,
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

    const numeroAutorizado = '553299642181@s.whatsapp.net'; // <- seu número com DDI e DDD
    if (sender !== numeroAutorizado) {
      console.log(`❌ Número não autorizado: ${sender}`);
      return;
    }

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
      const resposta = await agent(texto);

      if (typeof resposta === 'string') {
        await sock.sendMessage(sender, { text: resposta });
      } else if (resposta?.tipo === 'texto') {
        await sock.sendMessage(sender, { text: resposta.conteudo });
      } else if (resposta?.tipo === 'imagem') {
        for (let imagem of resposta.imagens) {
          const buffer = fs.readFileSync(imagem.caminho);
          const mimeType = mime.lookup(imagem.caminho);
          await sock.sendMessage(sender, {
            image: buffer,
            mimetype: mimeType,
            caption: imagem.legenda
          });
        }
      }

    } catch (error) {
      console.error('Erro no agente:', error.message);
      await sock.sendMessage(sender, { text: '⚠️ Ocorreu um erro interno ao processar sua mensagem.' });
    }
  });
}

startSock();
