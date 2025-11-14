import { Router, Request, Response } from 'express';
import {
  initializeSession,
  getSession,
  getAllSessions,
  disconnectSession,
  deleteSession,
} from './whatsapp';
import prisma from './database';

const router = Router();

// ============ SESSÕES ============

router.post('/sessions', async (req: Request, res: Response) => {
  try {
    const { sessionId, name } = req.body;

    if (!sessionId) {
      return res.status(400).json({
        error: 'sessionId é obrigatório',
      });
    }

    await initializeSession(sessionId);

    if (name) {
      await prisma.session.update({
        where: { sessionId },
        data: { name },
      });
    }

    res.json({
      success: true,
      message: 'Sessão criada com sucesso',
      sessionId,
    });
  } catch (error: any) {
    res.status(500).json({
      error: 'Erro ao criar sessão',
      message: error.message,
    });
  }
});

router.get('/sessions', async (req: Request, res: Response) => {
  try {
    const dbSessions = await prisma.session.findMany({
      orderBy: { createdAt: 'desc' },
    });

    const activeSessions = getAllSessions();

    const sessions = dbSessions.map((db) => {
      const active = activeSessions.get(db.sessionId);
      return {
        ...db,
        isActive: !!active,
        currentStatus: active?.status || db.status,
      };
    });

    res.json({ sessions });
  } catch (error: any) {
    res.status(500).json({
      error: 'Erro ao listar sessões',
      message: error.message,
    });
  }
});

router.get('/sessions/:sessionId/status', async (req: Request, res: Response) => {
  try {
    const { sessionId } = req.params;

    const session = getSession(sessionId);
    const dbSession = await prisma.session.findUnique({
      where: { sessionId },
    });

    if (!dbSession) {
      return res.status(404).json({
        error: 'Sessão não encontrada',
      });
    }

    res.json({
      sessionId,
      isConnected: session?.isConnected || false,
      status: session?.status || dbSession.status,
      hasQR: !!session?.qrCode,
      number: dbSession.number,
      lastConnected: dbSession.lastConnected,
    });
  } catch (error: any) {
    res.status(500).json({
      error: 'Erro ao obter status',
      message: error.message,
    });
  }
});

router.get('/sessions/:sessionId/qr', async (req: Request, res: Response) => {
  try {
    const { sessionId } = req.params;

    const session = getSession(sessionId);

    if (!session?.qrCode) {
      return res.status(404).json({
        error: 'QR Code não disponível',
        message: 'Aguarde a geração do QR Code ou a conexão já está estabelecida',
      });
    }

    res.json({
      qrCode: session.qrCode,
      message: 'Escaneie este QR Code com seu WhatsApp',
    });
  } catch (error: any) {
    res.status(500).json({
      error: 'Erro ao obter QR Code',
      message: error.message,
    });
  }
});

router.post('/sessions/:sessionId/disconnect', async (req: Request, res: Response) => {
  try {
    const { sessionId } = req.params;

    await disconnectSession(sessionId);

    res.json({
      success: true,
      message: 'Sessão desconectada com sucesso',
    });
  } catch (error: any) {
    res.status(500).json({
      error: 'Erro ao desconectar sessão',
      message: error.message,
    });
  }
});

router.delete('/sessions/:sessionId', async (req: Request, res: Response) => {
  try {
    const { sessionId } = req.params;

    await deleteSession(sessionId);

    res.json({
      success: true,
      message: 'Sessão deletada com sucesso',
    });
  } catch (error: any) {
    res.status(500).json({
      error: 'Erro ao deletar sessão',
      message: error.message,
    });
  }
});

// ============ MENSAGENS ============

router.post('/sessions/:sessionId/send-message', async (req: Request, res: Response) => {
  try {
    const { sessionId } = req.params;
    const { number, message } = req.body;

    if (!number || !message) {
      return res.status(400).json({
        error: 'Parâmetros inválidos',
        message: 'number e message são obrigatórios',
      });
    }

    const session = getSession(sessionId);
    if (!session?.sock || !session.isConnected) {
      return res.status(503).json({
        error: 'Sessão não conectada',
        message: 'Conecte a sessão ao WhatsApp primeiro',
      });
    }

    const formattedNumber = number.includes('@s.whatsapp.net')
      ? number
      : `${number}@s.whatsapp.net`;

    const sentMsg = await session.sock.sendMessage(formattedNumber, {
      text: message,
    });

    if (sentMsg && sentMsg.key && sentMsg.key.id) {
      await prisma.message.create({
        data: {
          sessionId,
          messageId: sentMsg.key.id,
          remoteJid: formattedNumber,
          fromMe: true,
          messageType: 'text',
          content: message,
          timestamp: new Date(),
          status: 'sent',
        },
      });
    }

    res.json({
      success: true,
      message: 'Mensagem enviada com sucesso',
      messageId: sentMsg?.key?.id || 'unknown',
    });
  } catch (error: any) {
    res.status(500).json({
      error: 'Erro ao enviar mensagem',
      message: error.message,
    });
  }
});

router.post('/sessions/:sessionId/send-media', async (req: Request, res: Response) => {
  try {
    const { sessionId } = req.params;
    const { number, mediaUrl, caption, mediaType } = req.body;

    if (!number || !mediaUrl) {
      return res.status(400).json({
        error: 'Parâmetros inválidos',
        message: 'number e mediaUrl são obrigatórios',
      });
    }

    const session = getSession(sessionId);
    if (!session?.sock || !session.isConnected) {
      return res.status(503).json({
        error: 'Sessão não conectada',
        message: 'Conecte a sessão ao WhatsApp primeiro',
      });
    }

    const formattedNumber = number.includes('@s.whatsapp.net')
      ? number
      : `${number}@s.whatsapp.net`;

    let messageContent: any = {};

    switch (mediaType) {
      case 'image':
        messageContent = {
          image: { url: mediaUrl },
          caption: caption || '',
        };
        break;
      case 'video':
        messageContent = {
          video: { url: mediaUrl },
          caption: caption || '',
        };
        break;
      case 'audio':
        messageContent = {
          audio: { url: mediaUrl },
          mimetype: 'audio/mp4',
        };
        break;
      case 'document':
        messageContent = {
          document: { url: mediaUrl },
          caption: caption || '',
          fileName: caption || 'document',
        };
        break;
      default:
        return res.status(400).json({
          error: 'Tipo de mídia inválido',
          message: 'Use: image, video, audio ou document',
        });
    }

    const sentMsg = await session.sock.sendMessage(formattedNumber, messageContent);

    if (sentMsg && sentMsg.key && sentMsg.key.id) {
      await prisma.message.create({
        data: {
          sessionId,
          messageId: sentMsg.key.id,
          remoteJid: formattedNumber,
          fromMe: true,
          messageType: mediaType,
          content: JSON.stringify({ mediaUrl, caption }),
          timestamp: new Date(),
          status: 'sent',
        },
      });
    }

    res.json({
      success: true,
      message: 'Mídia enviada com sucesso',
      messageId: sentMsg?.key?.id || 'unknown',
    });
  } catch (error: any) {
    res.status(500).json({
      error: 'Erro ao enviar mídia',
      message: error.message,
    });
  }
});

// ============ CONTATOS ============

router.get('/sessions/:sessionId/check-number/:number', async (req: Request, res: Response) => {
  try {
    const { sessionId, number } = req.params;

    const session = getSession(sessionId);
    if (!session?.sock || !session.isConnected) {
      return res.status(503).json({
        error: 'Sessão não conectada',
      });
    }

    const [result] = await session.sock.onWhatsApp(number);

    res.json({
      exists: result?.exists || false,
      jid: result?.jid || null,
    });
  } catch (error: any) {
    res.status(500).json({
      error: 'Erro ao verificar número',
      message: error.message,
    });
  }
});

router.get('/sessions/:sessionId/profile/:number', async (req: Request, res: Response) => {
  try {
    const { sessionId, number } = req.params;

    const session = getSession(sessionId);
    if (!session?.sock || !session.isConnected) {
      return res.status(503).json({
        error: 'Sessão não conectada',
      });
    }

    const formattedNumber = number.includes('@s.whatsapp.net')
      ? number
      : `${number}@s.whatsapp.net`;

    const status = await session.sock.fetchStatus(formattedNumber).catch(() => null);
    const ppUrl = await session.sock.profilePictureUrl(formattedNumber).catch(() => null);

    res.json({
      number: formattedNumber,
      status: status || null,
      profilePicture: ppUrl,
    });
  } catch (error: any) {
    res.status(500).json({
      error: 'Erro ao obter perfil',
      message: error.message,
    });
  }
});

router.get('/sessions/:sessionId/messages', async (req: Request, res: Response) => {
  try {
    const { sessionId } = req.params;
    const { limit = '50', offset = '0' } = req.query;

    const messages = await prisma.message.findMany({
      where: { sessionId },
      orderBy: { timestamp: 'desc' },
      take: parseInt(limit as string),
      skip: parseInt(offset as string),
    });

    res.json({ messages });
  } catch (error: any) {
    res.status(500).json({
      error: 'Erro ao listar mensagens',
      message: error.message,
    });
  }
});

export default router;
