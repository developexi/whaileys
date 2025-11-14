FROM node:18-alpine

RUN apk add --no-cache ffmpeg wget curl python3 make g++ git

WORKDIR /app

# Copia tudo
COPY package*.json ./
COPY tsconfig.json ./
COPY prisma ./prisma/
COPY src ./src/

# Instala TUDO de uma vez
RUN npm install

# Gera Prisma Client
RUN npx prisma generate

# Cria diretório para sessões
RUN mkdir -p /app/auth_sessions

EXPOSE 3000

# Roda direto com ts-node (sem compilar)
CMD ["npx", "ts-node", "src/server.ts"]
