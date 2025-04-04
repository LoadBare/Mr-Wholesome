FROM node:lts AS build

WORKDIR /home/mr-wholesome/

COPY package*.json ./
COPY tsconfig.json ./
COPY prisma ./prisma/

RUN npm ci

COPY src ./src

RUN npx tsc


FROM node:lts AS final

WORKDIR /home/mr-wholesome/

COPY package*.json ./
COPY tsconfig.json ./
COPY prisma ./prisma/
COPY assets ./assets/

RUN npm install --omit=dev

COPY --from=build /home/mr-wholesome/dist ./dist

CMD ["node", "./dist/index.js"]
