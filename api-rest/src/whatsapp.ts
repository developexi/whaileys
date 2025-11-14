import makeWASocket, {
  DisconnectReason,
  useMultiFileAuthState,
  WASocket,
  fetchLatestBaileysVersion,
  makeCacheableSignalKeyStore,
} from 'whaileys';
import { Boom } from '@hapi/boom';
import pino from 'pino';
import QRCode from 'qrcode';
import prisma from './database';
import redisClient from './redis';
import path from 'path';
import fs from 'fs';

const logger = pino({ level: 'info' });

interface WhatsAppSession {
  sock: WASocket | null;
  qrCode: string | null;
  isConnected: boolean;
  status: string;
}

const sessions = new Map<string, WhatsAppSession>();

export async function initializeSession(sessionId: string): Promise<void> {
  if (sessions.has(sessionId)) {
    logger.info(`Sessão ${sessionId} já existe`);
    return;
  }

  const authPath = path.join(process.cwd(), 'auth_sessions', sessionId);
  if (!fs.existsSync(authPath)) {
    fs.mkdirSync(authPath, { recursive: true });
  }

  let dbSession = await prisma.session.findUnique({
    where: { sessionId },
  });

  if (!dbSession) {
    dbSession = await prisma.session.create({
      data: {
        sessionId,
        status: 'connecting',
      },
    });
  }

  const session: WhatsAppSession = {
    sock: null,
    qrCode: null,
    isConnected: false,
    status: 'connecting',
  };

  sessions.set(sessionId, session);

  await connectToWhatsApp(sessionId);
}

async function connectToWhatsApp(sessionId: string): Promise<void> {
  const session = sessions.get(sessionId);
  if (!session) return;

  const authPath = path.join(process.cwd(), 'auth_sessions', sessionId);
  const { state, saveCreds } = await useMultiFileAuthState(authPath);
  const { version } = await fetchLatestBaileysVersion();

  logger.info(`Conectando sessão ${sessionId} com WA v${version.join('.')}`);

  const sock = makeWASocket({
    version,
    printQRInTerminal: false,
    auth: {
      creds: state.creds,
      keys: makeCacheableSignalKeyStore(state.keys, pino({ level: 'silent' }) as any),
    },
    generateHighQualityLinkPreview: true,
    markOnlineOnConnect: false,
  });

  session.sock = sock;

  sock.ev.on('connection.update', async (update) => {
    const { connection, lastDisconnect, qr } = update;

    if (qr) {
      try {
        const qrDataUrl = await QRCode.toDataURL(qr);
        session.qrCode = qrDataUrl;
        session.status = 'qr_ready';

        await prisma.session.update({
          where: { sessionId },
          data: {
            qrCode: qrDataUrl,
            status: 'qr_ready',
          },
        });

        // Salvar QR no Redis com TTL de 60 segundos
        await redisClient.setEx(`qr:${sessionId}`, 60, qrDataUrl);

        logger.info(`QR Code gerado para sessão ${sessionId}`);
      } catch (error) {
        logger.error(`Erro ao gerar QR Code: ${error}`);
      }
    }

    if (connection === 'close') {
      const shouldReconnect =
        (lastDisconnect?.error as Boom)?.output?.statusCode !==
        DisconnectReason.loggedOut;

      logger.info(
        `Conexão ${sessionId} fechada devido a ${lastDisconnect?.error}`
      );

      session.isConnected = false;
      session.status = 'disconnected';
      session.qrCode = null;

      await prisma.session.update({
        where: { sessionId },
        data: {
          status: 'disconnected',
          isConnected: false,
          qrCode: null,
        },
      });

      await redisClient.del(`qr:${sessionId}`);

      if (shouldReconnect) {
        logger.info(`Reconectando sessão ${sessionId}...`);
        setTimeout(() => connectToWhatsApp(sessionId), 3000);
      } else {
        sessions.delete(sessionId);
      }
    } else if (connection === 'open') {
      logger.info(`Conexão ${sessionId} aberta com sucesso`);

      session.isConnected = true;
      session.status = 'connected';
      session.qrCode = null;

      const phoneNumber = sock.user?.id?.split(':')[0];

      await prisma.session.update({
        where: { sessionId },
        data: {
          status: 'connected',
          isConnected: true,
          qrCode: null,
          number: phoneNumber,
          lastConnected: new Date(),
        },
      });

      await redisClient.del(`qr:${sessionId}`);
      await redisClient.set(`session:${sessionId}:status`, 'connected');
    }
  });

  sock.ev.on('creds.update', saveCreds);

  sock.ev.on('messages.upsert', async ({ messages }) => {
    const msg = messages[0];
    if (!msg.key.fromMe && msg.message) {
      logger.info(`Mensagem recebida na sessão ${sessionId}:`, msg.key.remoteJid);

      try {
        await prisma.message.create({
          data: {
            sessionId,
            messageId: msg.key.id!,
            remoteJid: msg.key.remoteJid!,
            fromMe: msg.key.fromMe || false,
            messageType: Object.keys(msg.message)[0],
            content: JSON.stringify(msg.message),
            timestamp: new Date((msg.messageTimestamp as number) * 1000),
            status: 'received',
          },
        });
      } catch (error) {
        logger.error(`Erro ao salvar mensagem: ${error}`);
      }
    }
  });
}

export function getSession(sessionId: string): WhatsAppSession | undefined {
  return sessions.get(sessionId);
}

export function getAllSessions(): Map<string, WhatsAppSession> {
  return sessions;
}

export async function disconnectSession(sessionId: string): Promise<void> {
  const session = sessions.get(sessionId);
  if (session?.sock) {
    await session.sock.logout();
    sessions.delete(sessionId);

    await prisma.session.update({
      where: { sessionId },
      data: {
        status: 'disconnected',
        isConnected: false,
        qrCode: null,
      },
    });

    await redisClient.del(`qr:${sessionId}`);
    await redisClient.del(`session:${sessionId}:status`);

    logger.info(`Sessão ${sessionId} desconectada`);
  }
}

export async function deleteSession(sessionId: string): Promise<void> {
  await disconnectSession(sessionId);

  const authPath = path.join(process.cwd(), 'auth_sessions', sessionId);
  if (fs.existsSync(authPath)) {
    fs.rmSync(authPath, { recursive: true, force: true });
  }

  await prisma.session.delete({
    where: { sessionId },
  });

  logger.info(`Sessão ${sessionId} deletada`);
}
