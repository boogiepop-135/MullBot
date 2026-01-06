#!/bin/bash

# Script de verificación para MullBot MVP
# Verifica que todos los servicios estén funcionando correctamente

echo "🔍 Verificando estado de MullBot MVP..."
echo ""

cd "$(dirname "$0")"

# Verificar Docker
if ! command -v docker &> /dev/null; then
    echo "❌ Docker no está instalado"
    exit 1
fi

# Verificar servicios
echo "📊 Estado de los servicios:"
docker compose ps

echo ""
echo "🔍 Verificando conectividad..."

# Verificar App
if curl -s http://localhost:3000/admin/login > /dev/null 2>&1; then
    echo "✅ App respondiendo en http://localhost:3000"
else
    echo "❌ App no responde en http://localhost:3000"
fi

# Verificar MongoDB
if docker compose exec -T mongo mongosh -u root -p example --quiet --eval "db.adminCommand('ping')" > /dev/null 2>&1; then
    echo "✅ MongoDB funcionando correctamente"
else
    echo "⚠️  MongoDB no responde (puede estar iniciando)"
fi

# Verificar Ngrok
if curl -s http://localhost:4040 > /dev/null 2>&1; then
    echo "✅ Ngrok dashboard accesible en http://localhost:4040"
else
    echo "⚠️  Ngrok dashboard no accesible"
fi

echo ""
echo "📝 Logs recientes de la app:"
docker compose logs app --tail 5

echo ""
echo "✅ Verificación completada"
