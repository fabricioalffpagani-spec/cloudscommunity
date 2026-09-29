FROM node:24-alpine AS dependencies
WORKDIR /app
COPY package*.json ./
RUN npm ci

FROM dependencies AS build
ENV NEXT_TELEMETRY_DISABLED=1
COPY . .
RUN npm run build

FROM node:24-alpine AS production
WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
COPY package*.json ./
RUN npm ci --omit=dev --ignore-scripts
COPY --from=build /app/.next ./.next
COPY --from=build /app/public ./public
USER node
EXPOSE 3000
CMD ["sh", "-c", "exec node_modules/.bin/next start --hostname 0.0.0.0 --port ${UI_HTTP_PORT:-3000}"]

FROM dependencies AS development
ENV NODE_ENV=development
COPY . .
RUN sha256sum package-lock.json > node_modules/.clouds-package-lock.sha256
RUN test -f public/empty-clouds-available.png \
  && test -f app/components/AccessibilityProvider.tsx \
  && test -f app/globals.css
EXPOSE 3000
CMD ["sh", "tools/dev-entrypoint.sh", "sh", "-c", "node_modules/.bin/next dev --webpack --hostname 0.0.0.0 --port ${UI_HTTP_PORT:-3000}"]
