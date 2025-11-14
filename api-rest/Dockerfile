FROM node:18-slim

# Instala dependências do sistema
RUN apt-get update && apt-get install -y \
    ffmpeg \
    wget \
    curl \
    python3 \
    make \
    g++ \
    git \
    openssl \
    ca-certificates \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copia arquivos de configuração
COPY package*.json ./
COPY tsconfig.json ./
COPY prisma ./prisma/
COPY src ./src/

# Instala dependências
RUN npm install

# Gera Prisma Client
RUN npx prisma generate

# Cria diretório para sessões
RUN mkdir -p /app/auth_sessions

EXPOSE 3000

# Roda com ts-node
CMD ["npx", "ts-node", "src/server.ts"]
