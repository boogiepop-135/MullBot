# 🔐 Configuración de Token de GitHub

## Paso 1: Crear un Token de Acceso Personal en GitHub

1. **Ve a GitHub y accede a tu cuenta:**
   - Abre: https://github.com/settings/tokens
   - O ve a: GitHub → Settings → Developer settings → Personal access tokens → Tokens (classic)

2. **Crear un nuevo token:**
   - Haz clic en "Generate new token" → "Generate new token (classic)"
   - Dale un nombre descriptivo: `MullBot-Docker-Push`
   - Selecciona el tiempo de expiración (recomendado: 90 días o sin expiración)
   - **Selecciona los siguientes permisos (scopes):**
     - ✅ `repo` (Full control of private repositories)
       - Esto incluye: repo:status, repo_deployment, public_repo, repo:invite, security_events

3. **Generar y copiar el token:**
   - Haz clic en "Generate token" al final de la página
   - **⚠️ IMPORTANTE:** Copia el token inmediatamente, solo se muestra una vez
   - El token se verá algo así: `ghp_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx`

## Paso 2: Configurar el token en Git

Una vez que tengas el token, ejecuta estos comandos:

```bash
cd /home/levieduardo/Documentos/MullBot

# Configurar el remote con el token
git remote set-url origin https://TU_TOKEN@github.com/boogiepop-135/MullBot.git

# O si prefieres usar tu usuario:
git remote set-url origin https://TU_USUARIO:TU_TOKEN@github.com/boogiepop-135/MullBot.git
```

**Reemplaza:**
- `TU_TOKEN` con el token que copiaste de GitHub
- `TU_USUARIO` con tu nombre de usuario de GitHub (opcional)

## Paso 3: Hacer el Push

```bash
git push origin main
```

## Alternativa: Usar SSH (más seguro a largo plazo)

Si prefieres usar SSH en lugar de HTTPS:

1. **Generar clave SSH (si no tienes una):**
```bash
ssh-keygen -t ed25519 -C "tu_email@ejemplo.com"
```

2. **Agregar la clave pública a GitHub:**
   - Copia el contenido de: `~/.ssh/id_ed25519.pub`
   - Ve a: https://github.com/settings/keys
   - Haz clic en "New SSH key"
   - Pega la clave y guarda

3. **Cambiar el remote a SSH:**
```bash
git remote set-url origin git@github.com:boogiepop-135/MullBot.git
```

## Notas de Seguridad

- ⚠️ **Nunca compartas tu token públicamente**
- ⚠️ **No subas el token al repositorio**
- ✅ El token se guardará en `~/.git-credentials` (si usas credential.helper store)
- ✅ Considera usar SSH para mayor seguridad a largo plazo
