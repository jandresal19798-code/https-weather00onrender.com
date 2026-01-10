# 📤 Subir a GitHub y Desplegar en Render

## Paso 1: Crear repositorio en GitHub

1. Ve a [github.com](https://github.com) e inicia sesión
2. Click en el icono **+** (arriba a la derecha)
3. Click en **"New repository"**
4. Configura:
   - **Repository name**: `weather-agent`
   - **Description**: Agente de clima moderno con UI premium
   - **Visibility**: ✅ Public (o Private si prefieres)
   - Click en **"Create repository"**

## Paso 2: Subir el código a GitHub

En tu terminal (en el directorio del proyecto):

```bash
cd C:\Users\elchi\Downloads\agente

# Agrega el remoto de GitHub (reemplaza TU_USUARIO con tu nombre de usuario de GitHub)
git remote add origin https://github.com/TU_USUARIO/weather-agent.git

# Renombra la rama main
git branch -M main

# Sube el código
git push -u origin main
```

**O alternativamente usando GitHub Desktop:**

1. Descarga e instala [GitHub Desktop](https://desktop.github.com/)
2. Abre GitHub Desktop
3. File → Clone Repository
4. Pega el URL de tu repositorio: `https://github.com/TU_USUARIO/weather-agent.git`
4. Arrastra la carpeta `agente` al GitHub Desktop
5. Escribe un resumen del commit
6. Click en "Publish branch"

## Paso 3: Desplegar en Render

1. Ve a [render.com](https://render.com) e inicia sesión con GitHub
2. Click en **"New +"** (arriba a la derecha)
3. Click en **"Web Service"**
4. Configura el servicio:
   
   **Repository:**
   - Click en "Connect GitHub"
   - Autoriza a Render
   - Selecciona: `weather-agent`
   - Selecciona la rama: `main`

   **Name & Instance:**
   - Name: `weather-agent` (o el nombre que prefieras)
   - Region: Oregon (el más cercano a tus usuarios)

   **Build & Deploy:**
   - Build Command: `npm install`
   - Start Command: `node server.js`

5. Click en **"Create Web Service"**

## Paso 4: Esperar el despliegue

- Render comenzará a construir y desplegar automáticamente
- Tardará entre 1-3 minutos
- Verás el progreso en tiempo real
- Cuando esté listo, verás: **"Success! Live"**

## Paso 5: Obtener el URL público

Render te proporcionará un URL como:
```
https://weather-agent.onrender.com
```

Este URL será:
- ✅ Accesible desde cualquier lugar del mundo
- ✅ 24/7 disponible
- ✅ HTTPS automático incluido
- ✅ Certificado SSL gratuito
- ✅ Dominio personalizado disponible (opcional)

## 📊 Panel de control en Render

En tu dashboard de Render verás:
- **Live URL**: El URL público de tu aplicación
- **Logs**: Logs en tiempo real del servidor
- **Metrics**: Métricas de rendimiento
- **Events**: Eventos del despliegue
- **Manual Deploy**: Botón para desplegar manualmente

## 🔄 Actualizar la aplicación

Para actualizar la aplicación:

1. Haz cambios en el código
2. En tu terminal:
```bash
git add .
git commit -m "Descripción de los cambios"
git push
```
3. Render detectará el cambio y desplegará automáticamente
4. ¡Listo! Tu aplicación se actualizará automáticamente

## 🎯 Opcional: Dominio personalizado

1. Ve al panel de tu servicio en Render
2. Click en **"Settings"**
3. Click en **"Custom Domains"**
4. Agrega tu dominio personal
5. Configura los DNS según las instrucciones

## 📱 Compartir tu aplicación

El URL que obtendrás será algo como:
```
https://weather-XXXX.onrender.com
```

Puedes compartir este URL con cualquier persona y podrán acceder a tu aplicación de clima desde cualquier lugar del mundo.

## 🌐 URLs de ejemplo:

- **GitHub**: https://github.com/TU_USUARIO/weather-agent
- **Render**: https://weather-agent.onrender.com
- **Repositorio privado**: Solo tú verás el código
- **Repositorio público**: Cualquiera podrá ver y usar tu código

## 💡 Tips importantes:

1. **No subas el archivo `.env`**: Ya está en `.gitignore`
2. **Usa `.env.example`**: Para documentar las variables de entorno
3. **Branch protection**: Activa la protección de rama en GitHub
4. **Render logs**: Revisa los logs regularmente para ver errores
5. **Backups**: Render hace backups automáticos de tu aplicación

## 🔧 Troubleshooting

**Si el despliegue falla:**
1. Revisa los logs en Render
2. Verifica que `package.json` tenga los scripts correctos
3. Asegúrate de que `server.js` esté en la raíz
4. Verifica que `public/` esté incluido en el repositorio

**Si la aplicación no funciona:**
1. Revisa los logs en tiempo real en Render
2. Verifica que las APIs estén funcionando
3. Comprueba que el puerto sea correcto (Render usa $PORT)
4. Revisa las variables de entorno

## ✅ Checklist antes de desplegar:

- [ ] Repositorio creado en GitHub
- [ ] Código subido a GitHub
- [ ] Repositorio conectado a Render
- [ ] Configuración correcta de build y start commands
- [ ] Despliegue exitoso
- [ ] URL público funcionando
- [ ] HTTPS funcionando correctamente

¡Listo! Tu aplicación de clima ahora está disponible en todo el mundo 🌍
