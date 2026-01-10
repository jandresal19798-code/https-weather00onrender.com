# 🌤️ Agente de Análisis del Clima

Agente local en JavaScript que consulta múltiples fuentes de datos del clima y genera informes detallados para cualquier lugar y fecha.

## ✨ Características

- **Múltiples fuentes de datos**: Consulta hasta 4 fuentes diferentes
- **100% APIs gratuitas**: Usa OpenMeteo y MetNorway por defecto (sin API key)
- **Interfaz web**: UI moderna y responsive
- **CLI**: Línea de comandos para uso avanzado
- **Informe detallado**: Genera reportes con temperatura, humedad, viento, presión, etc.
- **Opcionalmente con IA**: Integración con Ollama para informes más naturales

## 🚀 Instalación

```bash
npm install
```

## 📖 Uso

### Interfaz Web

```bash
npm run web
```

Abre tu navegador en: http://localhost:3000

### Línea de Comandos

```bash
node src/agent.js <ubicación> [fecha] [opciones]
```

### Ejemplos

```bash
# Clima actual de Madrid
node src/agent.js "Madrid"

# Clima para una fecha específica
node src/agent.js "Buenos Aires" "2024-01-15"

# Guardar informe en archivo
node src/agent.js "Ciudad de México" --save reporte.txt

# Usar pronóstico en lugar de clima actual
node src/agent.js "Lima" --forecast

# Combinar opciones
node src/agent.js "Tokyo" "2024-01-20" --save informe_tokyo.txt --forecast
```

### Opciones CLI

| Opción | Descripción |
|--------|-------------|
| `--save <archivo>` | Guarda el informe en un archivo |
| `--forecast` | Usa datos de pronóstico |

## 🔗 Fuentes de Datos

### Gratuitas (incluidas por defecto)
1. **OpenMeteo** - Sin API key, sin límites
2. **MetNorway** - Sin API key, sin límites

### Opcionales (requieren API key)
1. **OpenWeatherMap** - 1,000 llamadas/día gratis
2. **WeatherAPI** - 1,000 llamadas/día gratis

Para usar las APIs opcionales, agrega tus claves en `.env`:

```env
OPENWEATHER_API_KEY=tu_clave_aqui
WEATHERAPI_KEY=tu_clave_aqui
```

## 🤖 Integración con Ollama (opcional)

Para informes más detallados y naturales, puedes instalar [Ollama](https://ollama.ai) y ejecutar:

```bash
ollama run llama2
```

El agente detectará automáticamente Ollama y generará informes mejorados.

## 📝 Ejemplo de Salida

```
📍 INFORME DEL CLIMA
📅 Fecha: 2024-01-10
🌍 Ubicación: Madrid

📊 TEMPERATURA
• Promedio: 12.3°C
• Rango: 10.5°C - 14.1°C

💨 VIENTO
• Velocidad promedio: 3.2 m/s

💧 HUMEDAD
• Promedio: 65.8%

☁️ CONDICIONES
• Estado predominante: parcialmente nublado

📝 FUENTES CONSULTADAS
• OpenMeteo
• MetNorway

💡 RECOMENDACIONES
• Clima agradable para actividades al aire libre
```

## 🛠️ Arquitectura

```
src/
├── agent.js           - Agente principal
├── weatherSources.js  - Fuentes de datos del clima
└── reportGenerator.js - Generador de informes

public/
├── index.html         - Interfaz web
├── weather.css        - Estilos
└── weather.js         - Lógica frontend

server.js              - Servidor Express
```

## 🌍 Deploy en la nube (Gratis)

### Opción 1: Vercel (Recomendado)

1. Instalar Vercel CLI:
```bash
npm i -g vercel
```

2. Login y deploy:
```bash
vercel login
vercel
```

3. Deploy en producción:
```bash
vercel --prod
```

Obtendrás un URL público como: `https://weather-agent.vercel.app`

### Opción 2: Netlify

```bash
npm i -g netlify-cli
netlify deploy --prod
```

### Opción 3: Railway

1. Ve a [railway.app](https://railway.app)
2. Sube el código a GitHub
3. Conecta tu repositorio a Railway
4. Deploy automático

### Opción 4: Replit

1. Ve a [replit.com](https://replit.com)
2. Crea proyecto Node.js
3. Copia los archivos
4. Click "Run"

### Opción 5: ngrok (Temporal)

```bash
# Instalar ngrok: https://ngrok.com/download
ngrok http 3001
```

Obtendrás un URL temporal para compartir.

## 🌐 URL Público

Después de deployar en Vercel, obtendrás un URL público compartible como:
```
https://weather-agent-tu-usuario.vercel.app
```

Este URL será accesible desde cualquier lugar del mundo, 24/7, completamente gratis.
