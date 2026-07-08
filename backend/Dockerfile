FROM node:22-alpine

WORKDIR /app

ENV NODE_ENV=development

COPY package*.json ./
COPY prisma.config.ts ./
COPY prisma ./prisma

RUN npm ci
RUN npx prisma generate

COPY . .

EXPOSE 3001

CMD ["sh", "-c", "npx prisma generate && npm run start:dev"]
