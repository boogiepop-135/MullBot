# Multi-stage build para optimizar tamaño
FROM node:20-slim AS builder

WORKDIR /app

# Instalar solo dependencias de build necesarias
RUN apt-get update && apt-get install -y --no-install-recommends \
    python3 \
    make \
    g++ \
    && rm -rf /var/lib/apt/lists/*

# Copiar archivos de dependencias
COPY package.json package-lock.json* ./
RUN npm ci

# Copiar archivos fuente
COPY tsconfig.json ./
COPY scripts/ ./scripts/
COPY src/ ./src/
COPY public/ ./public/

# Compilar proyecto
RUN npm run build

# Copiar script de admin compilado
RUN mkdir -p dist/scripts && \
    cp scripts/create-admin-auto.js dist/scripts/ || true

# Stage de producción - imagen final optimizada
FROM node:20-slim

WORKDIR /app

# Instalar solo runtime dependencies para Puppeteer/Chromium
RUN apt-get update && apt-get install -y --no-install-recommends \
    chromium \
    ca-certificates \
    fonts-liberation \
    libasound2 \
    libatk1.0-0 \
    libc6 \
    libcairo2 \
    libdbus-1-3 \
    libexpat1 \
    libfontconfig1 \
    libgbm1 \
    libgcc1 \
    libgconf-2-4 \
    libglib2.0-0 \
    libgtk-3-0 \
    libnspr4 \
    libnss3 \
    libpango-1.0-0 \
    libstdc++6 \
    libx11-6 \
    libxcb1 \
    libxcomposite1 \
    libxdamage1 \
    libxrandr2 \
    && rm -rf /var/lib/apt/lists/* \
    && apt-get clean \
    && apt-get autoremove -y

# Copiar solo archivos necesarios desde builder
COPY --from=builder /app/package.json /app/package-lock.json* ./
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/public ./public
COPY --from=builder /app/src/views ./src/views

# Instalar solo dependencias de producción
RUN npm ci --only=production && \
    npm cache clean --force && \
    rm -rf /tmp/*

EXPOSE 3001

CMD ["npm", "start"]
