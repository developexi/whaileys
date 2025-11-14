import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient({
  log: ['error', 'warn'],
});

export default prisma;

process.on('beforeExit', async () => {
  await prisma.$disconnect();
});
