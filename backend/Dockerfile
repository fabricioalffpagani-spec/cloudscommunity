FROM node:24-alpine AS dependencies

WORKDIR /app

COPY package*.json ./
COPY prisma.config.ts ./
COPY prisma ./prisma

RUN npm ci

FROM dependencies AS build

COPY . .
RUN npx prisma generate && npm run build

# Keep the Prisma CLI available to apply migrations before serving requests.
FROM dependencies AS production
ENV NODE_ENV=production
COPY --from=build /app/dist ./dist
COPY --from=build /app/node_modules/.prisma ./node_modules/.prisma
EXPOSE 3001
CMD ["sh", "-c", "npx prisma migrate deploy && exec node dist/src/main.js"]

FROM dependencies AS development
ENV NODE_ENV=development

COPY . .

EXPOSE 3001

CMD ["sh", "-c", "npx prisma migrate deploy && npx prisma generate && npm run start:dev"]
