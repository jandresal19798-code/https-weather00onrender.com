import express from 'express';
import cors from 'cors';
import rateLimit from 'express-rate-limit';

const app = express();
const port = process.env.PORT || 3001;

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutos
  max: 100, // límite de 100 solicitudes por ventana de 15 minutos
  message: 'Demasiadas solicitudes. Por favor, espera un momento.',
  standardHeaders: true,
  legacyHeaders: false,
});

app.use(limiter);
app.use(cors());
app.use(express.static('public'));
app.use(express.json());

const cache = new Map();
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutos

function getCached(key) {
  const cached = cache.get(key);
  if (cached && Date.now() - cached.timestamp < CACHE_DURATION) {
    return cached.data;
  }
  cache.delete(key);
  return null;
}

function setCached(key, data) {
  cache.set(key, { data, timestamp: Date.now() });
  
  // Limpiar caché antiguo periódicamente
  setTimeout(() => {
    const keysToDelete = [];
    for (const [key, value] of cache.entries()) {
      if (Date.now() - value.timestamp > CACHE_DURATION) {
        keysToDelete.push(key);
      }
    }
    keysToDelete.forEach(key => cache.delete(key));
  }, 60000); // Cada minuto
}

function getCacheKey(endpoint, params) {
  return `${endpoint}:${JSON.stringify(params)}`;
}

app.get('/api/weather', async (req, res) => {
  try {
    const { location, date, forecast } = req.query;
    
    if (!location) {
      return res.status(400).json({ error: 'Ubicación requerida' });
    }

    const cacheKey = getCacheKey('/api/weather', { location, date, forecast });
    const cached = getCached(cacheKey);
    
    if (cached) {
      return res.json(cached);
    }

    const { WeatherAgent } = await import('./src/agent.js');
    const agent = new WeatherAgent();
    const report = await agent.analyzeWeather(
      location,
      date || new Date().toISOString().split('T')[0],
      forecast === 'true'
    );

    const response = { success: true, report };
    setCached(cacheKey, response);
    
    res.json(response);
  } catch (error) {
    console.error('Error en API:', error);
    res.status(500).json({ 
      error: error.message,
      suggestion: 'Intenta con el nombre de la ciudad en español o inglés, o sin incluir el país'
    });
  }
});

app.get('/api/forecast-7days', async (req, res) => {
  try {
    const { location } = req.query;
    
    if (!location) {
      return res.status(400).json({ error: 'Ubicación requerida' });
    }

    const cacheKey = getCacheKey('/api/forecast-7days', { location });
    const cached = getCached(cacheKey);
    
    if (cached) {
      return res.json(cached);
    }

    const { OpenMeteo } = await import('./src/weatherSources.js');
    const openMeteo = new OpenMeteo();
    const forecast = await openMeteo.get7DayForecast(location);

    const response = { success: true, forecast };
    setCached(cacheKey, response);
    
    res.json(response);
  } catch (error) {
    console.error('Error en forecast 7 días:', error);
    res.status(500).json({ error: error.message, suggestion: 'Usa el caché integrado. Intenta de nuevo en 5 minutos.' });
  }
});

app.get('/api/coordinates', async (req, res) => {
  try {
    const { location } = req.query;
    
    if (!location) {
      return res.status(400).json({ error: 'Ubicación requerida' });
    }

    const cacheKey = getCacheKey('/api/coordinates', { location });
    const cached = getCached(cacheKey);
    
    if (cached) {
      return res.json(cached);
    }

    const { OpenMeteo } = await import('./src/weatherSources.js');
    const openMeteo = new OpenMeteo();
    const coords = await openMeteo.getCoordinates(location);

    const response = { 
      success: true, 
      location: coords.name,
      country: coords.country,
      latitude: coords.latitude,
      longitude: coords.longitude
    };
    setCached(cacheKey, response);
    
    res.json(response);
  } catch (error) {
    console.error('Error al obtener coordenadas:', error);
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/cache/stats', (req, res) => {
  const stats = Array.from(cache.entries()).map(([key, value]) => ({
    key,
    age: Math.floor((Date.now() - value.timestamp) / 1000) + 's',
    expired: Date.now() - value.timestamp >= CACHE_DURATION
  }));
  
  res.json({
    cacheSize: cache.size,
    cacheDuration: `${CACHE_DURATION / 1000}s`,
    stats: stats
  });
});

app.get('/', (req, res) => {
  res.sendFile('index.html', { root: 'public' });
});

app.listen(port, () => {
  console.log(`🌐 Servidor web: http://localhost:${port}`);
  console.log(`📊 API: http://localhost:${port}/api/weather?location=Madrid`);
  console.log(`📅 Forecast: http://localhost:${port}/api/forecast-7days?location=Madrid`);
  console.log(`🗺️ Coordinates: http://localhost:${port}/api/coordinates?location=Madrid`);
  console.log(`💾 Cache stats: http://localhost:${port}/api/cache/stats`);
  console.log(`⚡ Rate limit: 100 solicitudes / 15 minutos`);
});
