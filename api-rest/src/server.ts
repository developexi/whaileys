import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import routes from './routes';
import prisma from './database';
import { connectRedis } from './redis';
import { initializeSession } from './whatsapp';
import { authMiddleware } from './auth';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Middleware de autenticação (protege todas as rotas /api/*)
app.use(authMiddleware);

app.use('/api', routes);

app.get('/', (req, res) => {
  res.json({
    name: 'Whaileys API',
    version: '1.0.0',
    status: 'online',
    docs: 'https://whaileysapi.exisistemas.com.br/api/docs',
    endpoints: {
      sessions: {
        create: 'POST /api/sessions',
        list: 'GET /api/sessions',
        status: 'GET /api/sessions/:sessionId/status',
        qr: 'GET /api/sessions/:sessionId/qr',
        disconnect: 'POST /api/sessions/:sessionId/disconnect',
        delete: 'DELETE /api/sessions/:sessionId',
      },
      messages: {
        send: 'POST /api/sessions/:sessionId/send-message',
        sendMedia: 'POST /api/sessions/:sessionId/send-media',
        list: 'GET /api/sessions/:sessionId/messages',
      },
      contacts: {
        checkNumber: 'GET /api/sessions/:sessionId/check-number/:number',
        profile: 'GET /api/sessions/:sessionId/profile/:number',
      },
    },
  });
});

app.get('/health', (req, res) => {
  res.json({ status: 'healthy', timestamp: new Date().toISOString() });
});

app.listen(PORT, async () => {
  console.log(`🚀 Servidor rodando na porta ${PORT}`);
  console.log(`📱 Whaileys API iniciada`);
  console.log(`🌐 URL: https://whaileysapi.exisistemas.com.br`);

  try {
    await prisma.$connect();
    console.log('✅ Conectado ao PostgreSQL');

    await connectRedis();

    const activeSessions = await prisma.session.findMany({
      where: {
        status: { in: ['connected', 'qr_ready'] },
      },
    });

    console.log(`📲 Restaurando ${activeSessions.length} sessões ativas...`);

    for (const session of activeSessions) {
      try {
        await initializeSession(session.sessionId);
        console.log(`✅ Sessão ${session.sessionId} restaurada`);
      } catch (error) {
        console.error(`❌ Erro ao restaurar sessão ${session.sessionId}:`, error);
      }
    }

    console.log('✅ API Whaileys pronta para uso!');
  } catch (error) {
    console.error('❌ Erro ao inicializar:', error);
  }
});

process.on('SIGTERM', async () => {
  console.log('🛑 SIGTERM recebido, encerrando...');
  await prisma.$disconnect();
  process.exit(0);
});

process.on('SIGINT', async () => {
  console.log('🛑 SIGINT recebido, encerrando...');
  await prisma.$disconnect();
  process.exit(0);
});

process.on('unhandledRejection', (error) => {
  console.error('❌ Unhandled Rejection:', error);
});

process.on('uncaughtException', (error) => {
  console.error('❌ Uncaught Exception:', error);
});
