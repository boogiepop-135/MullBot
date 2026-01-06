#!/bin/bash

# Script de inicio rápido para MullBot MVP
# Uso: ./start.sh

set -e

echo "🚀 Iniciando MullBot MVP..."
echo ""

# Verificar Docker
if ! command -v docker &> /dev/null; then
    echo "❌ Docker no está instalado. Por favor instala Docker primero."
    exit 1
fi

if ! command -v docker compose &> /dev/null && ! command -v docker-compose &> /dev/null; then
    echo "❌ Docker Compose no está instalado. Por favor instala Docker Compose primero."
    exit 1
fi

echo "✅ Docker encontrado"
echo ""

# Ir al directorio del proyecto
cd "$(dirname "$0")"

# Construir y levantar servicios
echo "📦 Construyendo y levantando servicios..."
docker compose up -d --build

echo ""
echo "⏳ Esperando a que los servicios estén listos..."
sleep 10

# Verificar estado
echo ""
echo "📊 Estado de los servicios:"
docker compose ps

echo ""
echo "✅ MullBot está iniciando..."
echo ""
echo "🌐 URLs de acceso:"
echo "   - Panel Admin: http://localhost:3000/admin"
echo "   - Login: http://localhost:3000/admin/login"
echo "   - Dashboard Ngrok: http://localhost:4040"
echo ""
echo "🔐 Credenciales:"
echo "   - Usuario: admin"
echo "   - Contraseña: admin123"
echo ""
echo "📝 Para ver los logs:"
echo "   docker compose logs -f app"
echo ""
echo "🎉 ¡Listo! El proyecto está corriendo."
