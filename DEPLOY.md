# 🚀 Deploy en Vercel (Gratis)

## Pasos para desplegar:

### 1. Instalar Vercel CLI
```bash
npm i -g vercel
```

### 2. Login en Vercel
```bash
vercel login
```

### 3. Desplegar
```bash
vercel
```

### 4. Seguir las instrucciones:
- Enter para confirmar la configuración
- Se creará un proyecto en Vercel
- Obtendrás un URL público como: `https://weather-agent.vercel.app`

### 5. Deploy en producción
```bash
vercel --prod
```

## Alternativa: Deploy en Netlify

### 1. Instalar Netlify CLI
```bash
npm i -g netlify-cli
```

### 2. Build y deploy
```bash
netlify deploy --prod
```

## Alternativa: Deploy en Railway

1. Ve a [railway.app](https://railway.app)
2. Crea una cuenta
3. Nuevo proyecto → Deploys from GitHub
4. Sube tu código a GitHub
5. Railway lo despliega automáticamente

## Alternativa: Usar ngrok (temporal)

### 1. Instalar ngrok
```bash
# Descarga desde https://ngrok.com/download
```

### 2. Ejecutar ngrok
```bash
ngrok http 3001
```

### 3. Obtendrás un URL público temporal
Ejemplo: `https://random.ngrok.io`

Este URL expirará cuando cierres ngrok.

## Opción más rápida: Replit

1. Ve a [replit.com](https://replit.com)
2. Crea nuevo proyecto → Node.js
3. Copia todos los archivos
4. Click "Run"
5. Obtendrás un URL público

## Archivos necesarios para deploy:

- ✅ server.js
- ✅ package.json
- ✅ vercel.json (para Vercel)
- ✅ src/ (todo el código)
- ✅ public/ (HTML, CSS, JS)
