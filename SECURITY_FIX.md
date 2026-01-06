# 🔒 Corrección de Seguridad - Información Sensible Expuesta

## ⚠️ PROBLEMA DETECTADO

Se encontró información sensible en el repositorio público:

1. **Token de Ngrok** en `ngrok.yml` - Expuesto en el historial de git
2. **JWT_SECRET de ejemplo** en `README.md` - Podría confundirse con uno real

## ✅ CAMBIOS REALIZADOS

### 1. Archivos Corregidos
- ✅ `ngrok.yml` - Token reemplazado con placeholder
- ✅ `README.md` - JWT_SECRET de ejemplo actualizado
- ✅ `.gitignore` - Agregado `ngrok.yml` para evitar futuros commits
- ✅ `ngrok.yml.example` - Creado archivo de ejemplo seguro
- ✅ `docker-compose.yml` - Actualizado para usar token desde variable de entorno

### 2. Acciones Inmediatas Requeridas

#### A. Regenerar Token de Ngrok (CRÍTICO)
El token de Ngrok que estaba expuesto debe ser **regenerado inmediatamente**:

1. Ve a: https://dashboard.ngrok.com/get-started/your-authtoken
2. Haz clic en "Revoke" en el token expuesto
3. Genera un nuevo token
4. Actualiza tu archivo `.env` local con el nuevo token:
   ```bash
   NGROK_AUTHTOKEN=tu_nuevo_token_aqui
   ```

#### B. Regenerar JWT_SECRET (Recomendado)
Si el JWT_SECRET en `README.md` era el que estabas usando en producción:

1. Genera un nuevo JWT_SECRET:
   ```bash
   node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
   ```
2. Actualiza tu archivo `.env`:
   ```bash
   JWT_SECRET=tu_nuevo_jwt_secret_aqui
   ```
3. Si ya tienes usuarios en la base de datos, necesitarás regenerar sus tokens

## 🧹 Limpieza del Historial de Git

El token de Ngrok está en el historial de git. Para eliminarlo completamente, tienes dos opciones:

### Opción 1: Usar git filter-repo (Recomendado)

```bash
# Instalar git-filter-repo (si no lo tienes)
pip install git-filter-repo

# Eliminar ngrok.yml del historial
git filter-repo --path ngrok.yml --invert-paths

# Forzar push (⚠️ ADVERTENCIA: Esto reescribe el historial)
git push origin --force --all
```

### Opción 2: Usar BFG Repo-Cleaner

```bash
# Descargar BFG
wget https://repo1.maven.org/maven2/com/madgag/bfg/1.14.0/bfg-1.14.0.jar

# Crear backup
git clone --mirror https://github.com/boogiepop-135/MullBot.git backup.git

# Eliminar ngrok.yml del historial
java -jar bfg-1.14.0.jar --delete-files ngrok.yml

# Limpiar y forzar push
cd MullBot.git
git reflog expire --expire=now --all && git gc --prune=now --aggressive
git push --force
```

### Opción 3: Crear un nuevo repositorio (Más simple)

Si el repositorio no tiene muchos colaboradores:

1. Crea un nuevo repositorio
2. Haz push de los cambios actuales (sin el historial):
   ```bash
   git checkout --orphan new-main
   git add .
   git commit -m "Initial commit - cleaned"
   git branch -D main
   git branch -m main
   git push -f origin main
   ```

## 📋 Checklist de Seguridad

- [ ] Regenerar token de Ngrok
- [ ] Actualizar `.env` local con nuevo token
- [ ] Regenerar JWT_SECRET si era el de producción
- [ ] Limpiar historial de git (elegir una opción arriba)
- [ ] Verificar que `.env` está en `.gitignore`
- [ ] Verificar que `ngrok.yml` está en `.gitignore`
- [ ] Revisar otros archivos por información sensible

## 🔐 Mejores Prácticas para el Futuro

1. **NUNCA** subas archivos `.env` al repositorio
2. **NUNCA** subas tokens, API keys o secretos en archivos de configuración
3. **SIEMPRE** usa archivos `.example` para plantillas
4. **SIEMPRE** verifica `.gitignore` antes de hacer commit
5. **SIEMPRE** usa variables de entorno para información sensible
6. **REVISA** el historial antes de hacer push público

## 📚 Recursos

- [GitHub: Removing sensitive data](https://docs.github.com/en/authentication/keeping-your-account-and-data-secure/removing-sensitive-data-from-a-repository)
- [Ngrok: Rotate Auth Token](https://dashboard.ngrok.com/get-started/your-authtoken)
