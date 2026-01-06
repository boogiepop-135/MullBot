#!/bin/bash
# Script de limpieza para optimizar el proyecto antes de subir a Digital Ocean

echo "🧹 Limpiando proyecto para producción..."

# Eliminar node_modules locales (se instalan en Docker)
echo "📦 Eliminando node_modules locales..."
find . -name "node_modules" -type d -prune -exec rm -rf {} \; 2>/dev/null

# Eliminar archivos de build
echo "🗑️  Eliminando archivos de build..."
rm -rf dist/
rm -rf build/
rm -rf .cache/
rm -rf coverage/
rm -rf .nyc_output/

# Eliminar logs
echo "📝 Eliminando logs..."
rm -rf logs/
find . -name "*.log" -type f -delete 2>/dev/null

# Eliminar archivos temporales
echo "🗂️  Eliminando archivos temporales..."
find . -name "*.tmp" -type f -delete 2>/dev/null
find . -name "*.temp" -type f -delete 2>/dev/null
rm -rf tmp/ temp/

# Limpiar cache de npm
echo "💾 Limpiando cache de npm..."
npm cache clean --force 2>/dev/null || true

# Limpiar cache de TypeScript
echo "🔧 Limpiando cache de TypeScript..."
rm -rf *.tsbuildinfo
find . -name "*.tsbuildinfo" -type f -delete 2>/dev/null

# Limpiar cache de ESLint
echo "✨ Limpiando cache de ESLint..."
rm -rf .eslintcache

# Limpiar archivos de IDE
echo "💻 Limpiando archivos de IDE..."
rm -rf .vscode/
rm -rf .idea/
find . -name "*.swp" -type f -delete 2>/dev/null
find . -name "*.swo" -type f -delete 2>/dev/null
find . -name "*~" -type f -delete 2>/dev/null

# Limpiar archivos OS
echo "🖥️  Limpiando archivos del sistema..."
find . -name ".DS_Store" -type f -delete 2>/dev/null
find . -name "Thumbs.db" -type f -delete 2>/dev/null

# Limpiar cache de WhatsApp
echo "📱 Limpiando cache de WhatsApp..."
rm -rf .wwebjs_auth/
rm -rf .wwebjs_cache/

# Mostrar tamaño final
echo ""
echo "✅ Limpieza completada!"
echo ""
echo "📊 Tamaño del proyecto:"
du -sh . 2>/dev/null | awk '{print $1}'
echo ""
echo "💡 Para optimizar más, considera:"
echo "   - Comprimir el video onboarding.mp4 (actualmente 9.5M)"
echo "   - Eliminar documentación innecesaria si no la necesitas"
echo "   - Usar .dockerignore para excluir archivos del build"
