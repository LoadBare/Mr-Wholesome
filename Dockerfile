FROM node:lts-alpine

ENV NODE_ENV=production

WORKDIR /app

COPY package*.json ./
COPY tsconfig.json ./
COPY prisma ./prisma/
COPY src ./src
COPY assets ./assets/

RUN npm ci && \
    npx prisma generate

CMD ["npx", "tsx", "./src/index.ts"]