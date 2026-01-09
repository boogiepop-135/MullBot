const fs = require('fs');
const path = require('path');

// Archivos y directorios a copiar
const assetsToCopy = [
  { src: 'src/views', dest: 'dist/views' },
  { src: 'public', dest: 'dist/public' },
  { src: 'prisma', dest: 'dist/prisma' }
];

function copyRecursiveSync(src, dest) {
  const exists = fs.existsSync(src);
  const stats = exists && fs.statSync(src);
  const isDirectory = exists && stats.isDirectory();

  if (isDirectory) {
    if (!fs.existsSync(dest)) {
      fs.mkdirSync(dest, { recursive: true });
    }
    fs.readdirSync(src).forEach(childItemName => {
      copyRecursiveSync(
        path.join(src, childItemName),
        path.join(dest, childItemName)
      );
    });
  } else {
    if (!fs.existsSync(path.dirname(dest))) {
      fs.mkdirSync(path.dirname(dest), { recursive: true });
    }
    fs.copyFileSync(src, dest);
  }
}

assetsToCopy.forEach(({ src, dest }) => {
  const srcPath = path.join(__dirname, '..', src);
  const destPath = path.join(__dirname, '..', dest);

  if (fs.existsSync(srcPath)) {
    console.log(`Copiando ${src} -> ${dest}`);
    copyRecursiveSync(srcPath, destPath);
  } else {
    console.warn(`⚠️  ${src} no existe, saltando...`);
  }
});

console.log('✅ Assets copiados correctamente');
