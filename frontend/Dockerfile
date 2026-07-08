FROM node:22-alpine

WORKDIR /app

ENV NODE_ENV=development

COPY package*.json ./
RUN npm ci

COPY . .

EXPOSE 3000

CMD ["sh", "-c", "npm run dev -- --hostname 0.0.0.0 --port ${UI_HTTP_PORT:-3000}"]
