FROM node:24-alpine

WORKDIR /app

ENV NODE_ENV=development

COPY package*.json ./
RUN npm install

COPY . .

EXPOSE 3000

CMD ["sh", "-c", "node_modules/.bin/next dev --turbopack --hostname 0.0.0.0 --port ${UI_HTTP_PORT:-3000}"]
