FROM node:18-alpine

RUN apk add --no-cache ffmpeg wget curl python3 make g++

WORKDIR /app

COPY package*.json ./
COPY tsconfig.json ./
COPY prisma ./prisma/

RUN npm install
RUN npx prisma generate

COPY src ./src

RUN npm run build

RUN mkdir -p /app/auth_sessions

EXPOSE 3000

CMD ["npm", "start"]
