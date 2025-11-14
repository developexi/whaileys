FROM node:18-alpine

RUN apk add --no-cache ffmpeg wget curl python3 make g++ git

WORKDIR /app

# Instala a biblioteca Whaileys diretamente do GitHub
RUN npm install github:canove/whaileys

# Copia os arquivos da API
COPY package*.json ./
COPY tsconfig.json ./
COPY prisma ./prisma/

# Remove a dependência whaileys do package.json temporariamente
RUN npm pkg delete dependencies.whaileys

# Instala as outras dependências
RUN npm install

# Gera o Prisma Client
RUN npx prisma generate

# Copia o código fonte
COPY src ./src

# Compila o TypeScript
RUN npm run build

# Cria diretório para sessões
RUN mkdir -p /app/auth_sessions

EXPOSE 3000

CMD ["npm", "start"]
