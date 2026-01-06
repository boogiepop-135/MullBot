# Actualizar package-lock.json

El `package-lock.json` necesita actualizarse después de añadir Prisma. 

## Opción 1: Actualizar en el servidor (RECOMENDADO)

```bash
cd ~/MullBot
npm install
git add package-lock.json
git commit -m "chore: Actualizar package-lock.json con dependencias de Prisma"
git push
```

Luego cambiar el Dockerfile de vuelta a usar `npm ci`:
- Línea 15: `RUN npm ci`
- Línea 72: `RUN npm ci --only=production`

## Opción 2: Actualizar localmente

Si tienes Node.js instalado localmente:

```bash
npm install
git add package-lock.json
git commit -m "chore: Actualizar package-lock.json con dependencias de Prisma"
git push
```

## Solución Temporal

El Dockerfile ha sido modificado para usar `npm install` en lugar de `npm ci` temporalmente. 
Esto permitirá que el build funcione, pero es menos eficiente.

Después de actualizar el package-lock.json, cambia el Dockerfile de vuelta a `npm ci`.

