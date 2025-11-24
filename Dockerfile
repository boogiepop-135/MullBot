FROM node:20-bullseye-slim AS builder
WORKDIR /app

# Copiar archivos de definición e instalar dependencias (incluye dev deps para build)
COPY package.json package-lock.json* ./
RUN npm ci

# Copiar el resto del código y construir
COPY . .
RUN npm run build

FROM node:20-bullseye-slim AS runner
WORKDIR /app
ENV NODE_ENV=production

# Instalar Chromium (necesario para Puppeteer). Dependiendo de la imagen base, el paquete puede variar.
RUN apt-get update \
  && apt-get install -y --no-install-recommends chromium \
  && rm -rf /var/lib/apt/lists/*

# Copiar artefactos de build y dependencias
COPY --from=builder /app/package.json /app/package-lock.json* /app/
COPY --from=builder /app/node_modules /app/node_modules
COPY --from=builder /app/dist /app/dist
COPY --from=builder /app/public /app/public
COPY --from=builder /app/src/views /app/dist/views

# Ajustes de Puppeteer/Chrome
ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium

EXPOSE 3000

CMD ["node", "dist/index.js"]
