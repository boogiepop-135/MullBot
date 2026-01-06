#!/bin/bash

# Script para iniciar la app de escritorio de MullBot
# Asegura que el servidor esté corriendo antes de iniciar la app

echo "🖥️  Iniciando MullBot Desktop App..."
echo ""

# Verificar que estamos en el directorio correcto
if [ ! -f "package.json" ]; then
    echo "❌ Error: Ejecuta este script desde el directorio desktop/"
    exit 1
fi

# Verificar que el servidor esté corriendo
echo "🔍 Verificando servidor..."
if curl -s http://localhost:3000/admin/login > /dev/null 2>&1; then
    echo "✅ Servidor detectado en http://localhost:3000"
else
    echo "⚠️  Servidor no detectado. Iniciando Docker..."
    cd ..
    docker compose up -d
    echo "⏳ Esperando a que el servidor esté listo..."
    sleep 10
    cd desktop
fi

# Verificar dependencias
if [ ! -d "node_modules" ]; then
    echo "📦 Instalando dependencias..."
    npm install
fi

# Iniciar la app
echo ""
echo "🚀 Iniciando aplicación de escritorio..."
echo ""
npm start
