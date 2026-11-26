const path = require('path');
const fs = require('fs');
const qrcode = require('qrcode');
const { default: makeWASocket, useMultiFileAuthState, DisconnectReason, fetchLatestBaileysVersion } = require('@whiskeysockets/baileys');
const pino = require('pino');

let sock = null;
let currentQrDataUrl = null;
let connectionStatus = 'disconnected'; // 'disconnected' | 'connecting' | 'scan_qr' | 'connected'
let connectedUser = null;
let onIncomingMessageCallback = null;

const sessionDir = path.join(__dirname, '../../whatsapp_session');
if (!fs.existsSync(sessionDir)) {
  fs.mkdirSync(sessionDir, { recursive: true });
}

function setIncomingMessageCallback(cb) {
  onIncomingMessageCallback = cb;
}

function getStatus() {
  return {
    status: connectionStatus,
    qrCode: currentQrDataUrl,
    user: connectedUser
  };
}

async function startWhatsAppWeb() {
  if (connectionStatus === 'connected' && sock) {
    return getStatus();
  }

  connectionStatus = 'connecting';
  currentQrDataUrl = null;

  try {
    const { state, saveCreds } = await useMultiFileAuthState(sessionDir);
    const { version } = await fetchLatestBaileysVersion().catch(() => ({ version: [2, 3000, 1015901307] }));

    sock = makeWASocket({
      version,
      auth: state,
      printQRInTerminal: false,
      logger: pino({ level: 'silent' }),
      browser: ['SocialManager', 'Chrome', '1.0.0']
    });

    sock.ev.on('creds.update', saveCreds);

    sock.ev.on('connection.update', async (update) => {
      const { connection, lastDisconnect, qr } = update;

      if (qr) {
        connectionStatus = 'scan_qr';
        try {
          currentQrDataUrl = await qrcode.toDataURL(qr, { scale: 6, margin: 2 });
          console.log('[WhatsApp Web] New QR Code generated, ready to scan');
        } catch (err) {
          console.error('[WhatsApp QR Generation Error]:', err);
        }
      }

      if (connection === 'close') {
        const statusCode = lastDisconnect?.error?.output?.statusCode;
        const shouldReconnect = statusCode !== DisconnectReason.loggedOut;
        console.log(`[WhatsApp Web] Connection closed (code: ${statusCode}). Reconnect: ${shouldReconnect}`);

        connectionStatus = 'disconnected';
        currentQrDataUrl = null;
        connectedUser = null;

        if (shouldReconnect) {
          setTimeout(startWhatsAppWeb, 3000);
        } else {
          // Logged out: remove session files
          try {
            fs.rmSync(sessionDir, { recursive: true, force: true });
            fs.mkdirSync(sessionDir, { recursive: true });
          } catch {}
        }
      } else if (connection === 'open') {
        connectionStatus = 'connected';
        currentQrDataUrl = null;
        const phone = sock.user?.id?.split(':')[0] || sock.user?.id?.split('@')[0] || '';
        connectedUser = {
          id: sock.user?.id,
          name: sock.user?.name || 'Connected Device',
          phone
        };
        console.log(`[WhatsApp Web] Connected successfully! Phone: +${phone}`);
      }
    });

    // Listen for incoming messages
    sock.ev.on('messages.upsert', async ({ messages, type }) => {
      if (type !== 'notify') return;

      for (const msg of messages) {
        if (msg.key.fromMe) continue; // ignore our own outgoing messages
        if (!msg.message) continue;

        const remoteJid = msg.key.remoteJid || '';
        if (remoteJid.endsWith('@g.us')) continue; // skip group chats for now, handle 1-on-1 leads

        const from = remoteJid.replace('@s.whatsapp.net', '');
        const senderName = msg.pushName || '';
        const text = msg.message.conversation || 
                     msg.message.extendedTextMessage?.text || 
                     msg.message.imageMessage?.caption || 
                     '';

        if (!text.trim()) continue;

        console.log(`[WhatsApp Web Inbound] From +${from} (${senderName}): "${text}"`);

        if (onIncomingMessageCallback) {
          try {
            await onIncomingMessageCallback({
              from,
              senderName,
              text,
              messageId: msg.key.id
            });
          } catch (err) {
            console.error('[WhatsApp Web Inbound Processing Error]:', err);
          }
        }
      }
    });

    return getStatus();
  } catch (err) {
    console.error('[WhatsApp Web Init Error]:', err);
    connectionStatus = 'disconnected';
    currentQrDataUrl = null;
    return getStatus();
  }
}

async function sendBaileysMessage(phone, text) {
  if (!sock || connectionStatus !== 'connected') {
    throw new Error('WhatsApp Web is not connected. Please scan the QR code first.');
  }

  const jid = `${phone}@s.whatsapp.net`;
  await sock.sendMessage(jid, { text });
  return true;
}

async function disconnectWhatsAppWeb() {
  try {
    if (sock) {
      await sock.logout().catch(() => {});
      sock.end();
      sock = null;
    }
    fs.rmSync(sessionDir, { recursive: true, force: true });
    fs.mkdirSync(sessionDir, { recursive: true });
    connectionStatus = 'disconnected';
    currentQrDataUrl = null;
    connectedUser = null;
    return true;
  } catch (err) {
    console.error('[WhatsApp Web Disconnect Error]:', err);
    return false;
  }
}

module.exports = {
  startWhatsAppWeb,
  getStatus,
  setIncomingMessageCallback,
  sendBaileysMessage,
  disconnectWhatsAppWeb
};
