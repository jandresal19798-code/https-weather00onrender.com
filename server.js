import express from 'express';
import cors from 'cors';
import rateLimit from 'express-rate-limit';

const app = express();
const port = process.env.PORT || 3001;

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 500,
  message: { error: 'Demasiadas solicitudes', suggestion: 'Espera un momento antes de continuar' },
  standardHeaders: true,
  legacyHeaders: false,
});

app.use(limiter);
app.use(cors());
app.use(express.static('public'));
app.use(express.json());

app.use((req, res, next) => {
  if (req.path.endsWith('.json')) {
    res.setHeader('Content-Type', 'application/json');
  }
  if (req.path.endsWith('.js') && req.path.includes('sw')) {
    res.setHeader('Content-Type', 'application/javascript');
  }
  next();
});

const cache = new Map();
const CACHE_DURATION = 5 * 60 * 1000;

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
  
  setTimeout(() => {
    const keysToDelete = [];
    for (const [key, value] of cache.entries()) {
      if (Date.now() - value.timestamp > CACHE_DURATION) {
        keysToDelete.push(key);
      }
    }
    keysToDelete.forEach(key => cache.delete(key));
  }, 60000);
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

    if (location.length < 2) {
      return res.status(400).json({ 
        error: 'Nombre muy corto',
        suggestion: 'Ingresa al menos 2 caracteres para buscar'
      });
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
    
    const isNotFound = error.message.includes('No se encontró') || 
                       error.message.includes('no encontrada') ||
                       error.message.includes('ubicación');
    
    res.status(isNotFound ? 400 : 500).json({ 
      error: error.message,
      suggestion: isNotFound ? 'Verifica la ortografía o intenta con otra ciudad' : 'Intenta de nuevo en unos minutos'
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
    res.status(500).json({ error: error.message, suggestion: 'Intenta de nuevo en 5 minutos.' });
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
  console.log(`💾 Cache: 5 minutos | Rate limit: 100/15min`);
});
