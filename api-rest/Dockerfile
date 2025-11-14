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

# Cria script de entrypoint inline
RUN echo '#!/bin/sh' > /app/docker-entrypoint.sh && \
    echo 'set -e' >> /app/docker-entrypoint.sh && \
    echo '' >> /app/docker-entrypoint.sh && \
    echo 'echo "🚀 Executando migrations do Prisma..."' >> /app/docker-entrypoint.sh && \
    echo 'npx prisma migrate deploy' >> /app/docker-entrypoint.sh && \
    echo 'echo "✅ Migrations aplicadas com sucesso"' >> /app/docker-entrypoint.sh && \
    echo '' >> /app/docker-entrypoint.sh && \
    echo 'echo "🚀 Iniciando servidor..."' >> /app/docker-entrypoint.sh && \
    echo 'exec npx ts-node src/server.ts' >> /app/docker-entrypoint.sh && \
    chmod +x /app/docker-entrypoint.sh

EXPOSE 3000

# Roda com ts-node via entrypoint
ENTRYPOINT ["/app/docker-entrypoint.sh"]
