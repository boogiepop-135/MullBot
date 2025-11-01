// Script para copiar vistas y archivos estáticos durante el build
const fs = require('fs');
const path = require('path');

function copyRecursive(src, dest) {
    const exists = fs.existsSync(src);
    const stats = exists && fs.statSync(src);
    const isDirectory = exists && stats.isDirectory();
    
    if (isDirectory) {
        if (!fs.existsSync(dest)) {
            fs.mkdirSync(dest, { recursive: true });
        }
        fs.readdirSync(src).forEach(childItemName => {
            copyRecursive(
                path.join(src, childItemName),
                path.join(dest, childItemName)
            );
        });
    } else {
        const destDir = path.dirname(dest);
        if (!fs.existsSync(destDir)) {
            fs.mkdirSync(destDir, { recursive: true });
        }
        fs.copyFileSync(src, dest);
    }
}

try {
    // Copiar vistas
    const viewsSrc = path.join(__dirname, '../src/views');
    const viewsDest = path.join(__dirname, '../dist/views');
    
    if (fs.existsSync(viewsSrc)) {
        console.log(`Copying views from ${viewsSrc} to ${viewsDest}`);
        copyRecursive(viewsSrc, viewsDest);
        console.log('Views copied successfully');
    } else {
        console.warn(`Views source not found: ${viewsSrc}`);
    }
    
    // Copiar archivos estáticos
    const publicSrc = path.join(__dirname, '../public');
    const publicDest = path.join(__dirname, '../dist/public');
    
    if (fs.existsSync(publicSrc)) {
        console.log(`Copying public files from ${publicSrc} to ${publicDest}`);
        copyRecursive(publicSrc, publicDest);
        console.log('Public files copied successfully');
    } else {
        console.warn(`Public source not found: ${publicSrc}`);
    }
} catch (error) {
    console.error('Error copying assets:', error);
    process.exit(1);
}

