#!/bin/bash
# Script para hacer push de los cambios al repositorio

echo "📦 Verificando commits pendientes..."
git log origin/main..HEAD --oneline

echo ""
echo "🚀 Haciendo push a GitHub..."
git push origin main

echo ""
echo "✅ ¡Push completado!"
echo ""
echo "Ahora Easypanel detectará los cambios y reconstruirá automáticamente."
echo "Esto puede tomar 2-3 minutos."
