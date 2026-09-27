FROM node:24-alpine AS dependencies
WORKDIR /app
# Prisma's migration schema engine needs OpenSSL on Alpine.
RUN apk add --no-cache openssl
COPY package*.json ./
COPY prisma.config.ts ./
COPY prisma ./prisma
RUN npm ci

FROM dependencies AS build
COPY nest-cli.json tsconfig*.json ./
COPY src ./src
RUN ./node_modules/.bin/prisma generate && npm run build

FROM dependencies AS production-dependencies
# prisma, dotenv and express are explicit runtime dependencies.
RUN npm prune --omit=dev --ignore-scripts --offline --no-audit --no-fund && npm cache clean --force
# Generate the runtime client after pruning, independently of application source.
RUN ./node_modules/.bin/prisma generate

FROM node:24-alpine AS production
WORKDIR /app
RUN apk add --no-cache openssl
ENV NODE_ENV=production
COPY --from=production-dependencies --chown=node:node /app/node_modules ./node_modules
COPY --from=build --chown=node:node /app/dist ./dist
COPY --from=build --chown=node:node /app/prisma ./prisma
COPY --from=build --chown=node:node /app/prisma.config.ts /app/package.json ./
USER node
EXPOSE 3001
CMD ["sh", "-c", "./node_modules/.bin/prisma migrate deploy && exec node dist/src/main.js"]

FROM dependencies AS development
ENV NODE_ENV=development
COPY . .
RUN sha256sum package-lock.json > node_modules/.clouds-package-lock.sha256
EXPOSE 3001
CMD ["sh", "tools/dev-entrypoint.sh", "sh", "-c", "./node_modules/.bin/prisma migrate deploy && ./node_modules/.bin/prisma generate && exec npm run start:dev"]
