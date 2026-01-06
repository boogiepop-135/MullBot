# 🔒 Corrección de Seguridad - Información Sensible Expuesta

## ⚠️ PROBLEMA DETECTADO

Se encontró información sensible en el repositorio público:

1. **API Key de Gemini** en `.env.example` - Expuesta en el historial de git: `AIzaSyCjN-SiPpKayCQMW70GVIQi3LNsFH7xIDg`
2. **Token de Ngrok** en `ngrok.yml` - Expuesto en el historial de git: `32R0zcy88zNsf9mGgXmXYpF0VlQ_6FNoHX1a6nhWi7bP682vG`
3. **JWT_SECRET de ejemplo** en `README.md` - Podría confundirse con uno real

## ✅ CAMBIOS REALIZADOS

### 1. Archivos Corregidos
- ✅ `.env.example` - API key real reemplazada con placeholder seguro
- ✅ `ngrok.yml` - Token reemplazado con placeholder
- ✅ `README.md` - JWT_SECRET de ejemplo actualizado
- ✅ `.gitignore` - Agregado `ngrok.yml` para evitar futuros commits
- ✅ `ngrok.yml.example` - Creado archivo de ejemplo seguro
- ✅ `docker-compose.yml` - Actualizado para usar token desde variable de entorno

### 2. Acciones Inmediatas Requeridas

#### A. Regenerar API Key de Gemini (CRÍTICO - PRIORIDAD MÁXIMA)
La API key de Gemini que estaba expuesta debe ser **regenerada inmediatamente**:

1. Ve a: https://makersuite.google.com/app/apikey
2. Encuentra la API key expuesta: `AIzaSyCjN-SiPpKayCQMW70GVIQi3LNsFH7xIDg`
3. Haz clic en "Delete" o "Revoke" para revocarla
4. Genera una nueva API key
5. Actualiza tu archivo `.env` local con la nueva API key:
   ```bash
   GEMINI_API_KEY=tu_nueva_api_key_aqui
   ```
6. Si estás usando esta API key en producción (Railway, Digital Ocean, etc.), actualízala también allí

#### B. Regenerar Token de Ngrok (CRÍTICO)
El token de Ngrok que estaba expuesto debe ser **regenerado inmediatamente**:

1. Ve a: https://dashboard.ngrok.com/get-started/your-authtoken
2. Haz clic en "Revoke" en el token expuesto
3. Genera un nuevo token
4. Actualiza tu archivo `.env` local con el nuevo token:
   ```bash
   NGROK_AUTHTOKEN=tu_nuevo_token_aqui
   ```

#### C. Regenerar JWT_SECRET (Recomendado)
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

Las API keys y tokens están en el historial de git. Para eliminarlos completamente, tienes tres opciones:

### Opción 1: Usar git filter-repo (Recomendado)

```bash
# Instalar git-filter-repo (si no lo tienes)
pip install git-filter-repo

# Eliminar archivos con información sensible del historial
git filter-repo --path ngrok.yml --path .env.example --invert-paths

# O eliminar solo el contenido sensible de .env.example
git filter-repo --replace-text <(echo "AIzaSyCjN-SiPpKayCQMW70GVIQi3LNsFH7xIDg==>tu_api_key_de_gemini_aqui")
git filter-repo --replace-text <(echo "32R0zcy88zNsf9mGgXmXYpF0VlQ_6FNoHX1a6nhWi7bP682vG==>TU_NGROK_AUTHTOKEN_AQUI")

# Forzar push (⚠️ ADVERTENCIA: Esto reescribe el historial)
git push origin --force --all
```

### Opción 2: Usar BFG Repo-Cleaner

```bash
# Descargar BFG
wget https://repo1.maven.org/maven2/com/madgag/bfg/1.14.0/bfg-1.14.0.jar

# Crear backup
git clone --mirror https://github.com/boogiepop-135/MullBot.git backup.git

# Eliminar archivos con información sensible del historial
java -jar bfg-1.14.0.jar --delete-files ngrok.yml .env.example

# O reemplazar contenido sensible
java -jar bfg-1.14.0.jar --replace-text passwords.txt
# (crea passwords.txt con: AIzaSyCjN-SiPpKayCQMW70GVIQi3LNsFH7xIDg==>tu_api_key_de_gemini_aqui)

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

- [ ] **URGENTE:** Regenerar API key de Gemini en Google AI Studio
- [ ] **URGENTE:** Actualizar `.env` local con nueva API key de Gemini
- [ ] **URGENTE:** Actualizar API key en producción (Railway/Digital Ocean) si aplica
- [ ] Regenerar token de Ngrok
- [ ] Actualizar `.env` local con nuevo token de Ngrok
- [ ] Regenerar JWT_SECRET si era el de producción
- [ ] Limpiar historial de git (elegir una opción arriba)
- [ ] Verificar que `.env` está en `.gitignore`
- [ ] Verificar que `ngrok.yml` está en `.gitignore`
- [ ] Verificar que `.env.example` solo contiene placeholders
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
