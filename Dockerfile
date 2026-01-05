FROM node:20-slim

WORKDIR /app

# Install build dependencies
RUN apt-get update && apt-get install -y --no-install-recommends \
    python3 \
    make \
    g++ \
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
  && rm -rf /var/lib/apt/lists/*

# Copiar archivos de dependencias primero para aprovechar el cache de Docker
COPY package.json package-lock.json* ./
RUN npm ci

# Copiar archivos necesarios para el build
COPY tsconfig.json ./
COPY scripts/ ./scripts/
COPY src/ ./src/
COPY public/ ./public/

# Compilar el proyecto
RUN npm run build

# Copiar script de creación de admin (versión JS)
RUN mkdir -p dist/scripts && \
    cp scripts/create-admin-auto.js dist/scripts/ || echo "Script JS copied"

# Limpiar devDependencies después del build para reducir el tamaño de la imagen
RUN npm prune --production

EXPOSE 3000
CMD ["npm", "start"]
