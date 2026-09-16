FROM node:20-alpine

WORKDIR /app

ENV NODE_ENV=development

COPY package*.json ./
COPY prisma.config.ts ./
COPY prisma ./prisma

RUN npm install

COPY . .

EXPOSE 3001

CMD ["sh", "-c", "npx prisma migrate deploy && npx prisma generate && npm run start:dev"]
