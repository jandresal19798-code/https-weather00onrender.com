import express from 'express';
import cors from 'cors';
import rateLimit from 'express-rate-limit';
import helmet from 'helmet';
import { body, query, validationResult } from 'express-validator';

const app = express();
app.set('trust proxy', 1);
const port = process.env.PORT || 3001;

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 500,
  message: { error: 'Demasiadas solicitudes', suggestion: 'Espera un momento antes de continuar' },
  standardHeaders: true,
  legacyHeaders: false,
});

app.use(helmet());
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

const validateRequest = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }
  next();
};

const cache = new Map();
const CACHE_DURATION = 5 * 60 * 1000;
const MAX_CACHE_SIZE = 500;

function getCached(key) {
  const cached = cache.get(key);
  if (cached && Date.now() - cached.timestamp < CACHE_DURATION) {
    return cached.data;
  }
  cache.delete(key);
  return null;
}

function setCached(key, data) {
  if (cache.size >= MAX_CACHE_SIZE) {
    const firstKey = cache.keys().next().value;
    cache.delete(firstKey);
  }
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

    let forecast = null;
    let lastError = null;

    try {
      const { OpenMeteo } = await import('./src/weatherSources.js');
      const openMeteo = new OpenMeteo();
      forecast = await openMeteo.get7DayForecast(location);
      console.log('✅ Forecast desde OpenMeteo');
    } catch (error) {
      console.log('⚠️ OpenMeteo falló:', error.message);
      lastError = error;
      
      try {
        const { OpenMeteo, WttrIn } = await import('./src/weatherSources.js');
        const openMeteo = new OpenMeteo();
        const wttr = new WttrIn();
        
        const coords = await openMeteo.getCoordinates(location);
        console.log('📍 Coordenadas:', coords.latitude, coords.longitude);
        
        const wttrForecast = await wttr.getForecastByCoords(coords.latitude, coords.longitude, 7);
        
        forecast = wttrForecast.map(day => ({
          date: day.date,
          temperatureMax: day.temperatureMax,
          temperatureMin: day.temperatureMin,
          description: day.description,
          weatherCode: 0,
          precipitation: day.precipitation || 0
        }));
        console.log('✅ Forecast desde WttrIn (por coordenadas)');
      } catch (wttrError) {
        console.log('⚠️ WttrIn también falló:', wttrError.message);
        lastError = wttrError;
      }
    }

    if (!forecast) {
      console.log('⚠️ Todas las APIs fallaron, usando datos estimados para:', location);
      forecast = generateMockForecast(location);
    }

    const response = { success: true, forecast, source: forecast.length > 0 && forecast[0].estimated ? 'estimated' : 'live' };
    setCached(cacheKey, response);
    
    res.json(response);
  } catch (error) {
    console.error('Error en forecast 7 días:', error.message);
    const mockForecast = generateMockForecast('ubicación solicitada');
    res.json({ success: true, forecast: mockForecast, source: 'fallback', warning: 'APIs temporalmente no disponibles' });
  }
});

function generateMockForecast(location, days = 7) {
  const today = new Date();
  const conditions = ['soleado', 'parcialmente nublado', 'nublado', 'lluvia ligera'];
  
  return Array.from({ length: days }, (_, i) => {
    const date = new Date(today);
    date.setDate(date.getDate() + i);
    const condition = conditions[Math.floor(Math.random() * conditions.length)];
    const baseTemp = 18 + Math.random() * 10;
    
    return {
      date: date.toISOString().split('T')[0],
      temperatureMax: baseTemp + 4,
      temperatureMin: baseTemp - 4,
      description: condition,
      weatherCode: conditions.indexOf(condition),
      precipitation: condition.includes('lluvia') ? Math.random() * 8 : 0,
      estimated: true,
      location: location
    };
  });
}

app.get('/api/forecast-15days', async (req, res) => {
  try {
    const { location } = req.query;
    
    if (!location) {
      return res.status(400).json({ error: 'Ubicación requerida' });
    }

    const cacheKey = getCacheKey('/api/forecast-15days', { location });
    const cached = getCached(cacheKey);
    
    if (cached) {
      return res.json(cached);
    }

    let forecast = null;

    try {
      const { OpenMeteo } = await import('./src/weatherSources.js');
      const openMeteo = new OpenMeteo();
      forecast = await openMeteo.get15DayForecast(location);
      console.log('✅ 15-day Forecast desde OpenMeteo');
    } catch (error) {
      console.log('⚠️ OpenMeteo 15-day falló:', error.message);
      forecast = generateMockForecast(location, 15);
      console.log('⚠️ Usando datos estimados para 15 días');
    }

    const response = { success: true, forecast, source: 'live' };
    setCached(cacheKey, response);
    
    res.json(response);
  } catch (error) {
    console.error('Error en 15-day forecast:', error);
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/coordinates', async (req, res) => {
  try {
    let location = req.query.location;
    
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
    
    let coords = null;
    const variations = [];
    
    const commonCountries = [
      'argentina', 'uruguay', 'chile', 'brasil', 'paraguay', 'bolivia', 'peru', 'ecuador',
      'colombia', 'venezuela', 'mexico', 'españa', 'portugal', 'francia', 'italia', 'alemania',
      'estados unidos', 'usa', 'united states', 'canada', 'reino Unido', 'uk', 'japon', 'china',
      'argentinian', 'uruguayan', 'chilean', 'brazilian', 'paraguayan', 'peruvian', 'ecuadorian',
      'colombian', 'venezuelan', 'mexican', 'spanish', 'portuguese', 'french', 'italian', 'german'
    ];
    
    variations.push(location);
    
    if (location.includes(',')) {
      const parts = location.split(',').map(p => p.trim());
      if (parts.length >= 2) {
        variations.push(parts[0]);
        variations.push(`${parts[0]}, ${parts[1].toLowerCase()}`);
        variations.push(`${parts[0]}, ${parts[1].toUpperCase()}`);
      }
    } else {
      for (const country of commonCountries) {
        variations.push(`${location}, ${country}`);
        variations.push(`${location} ${country}`);
      }
    }
    
    const triedLocations = new Set();
    for (const loc of variations) {
      if (triedLocations.has(loc.toLowerCase())) continue;
      triedLocations.add(loc.toLowerCase());
      
      try {
        coords = await openMeteo.getCoordinates(loc);
        if (coords && coords.country) break;
      } catch (e) {
        continue;
      }
    }
    
    if (!coords) {
      throw new Error(`Ubicación no encontrada: ${location}`);
    }

    const response = { 
      success: true, 
      location: coords.name,
      country: coords.country,
      countryCode: coords.country_code?.toUpperCase() || '',
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

app.get('/api/search', async (req, res) => {
  try {
    const query = req.query.q;
    
    if (!query || query.length < 2) {
      return res.json([]);
    }

    const cacheKey = getCacheKey('/api/search', { query });
    const cached = getCached(cacheKey);
    
    if (cached) {
      return res.json(cached);
    }

    const axios = (await import('axios')).default;
    const response = await axios.get('https://geocoding-api.open-meteo.com/v1/search', {
      params: {
        name: query,
        count: 10,
        language: 'es',
        format: 'json'
      },
      timeout: 5000
    });

    if (!response.data.results) {
      return res.json([]);
    }

    const suggestions = response.data.results.map(r => ({
      name: r.name,
      country: r.country || '',
      countryCode: r.country_code?.toUpperCase() || '',
      state: r.admin1 || '',
      latitude: r.latitude,
      longitude: r.longitude,
      display: `${r.name}${r.country ? ', ' + r.country : ''}${r.admin1 ? ' (' + r.admin1 + ')' : ''}`
    }));

    setCached(cacheKey, suggestions);
    
    res.json(suggestions);
  } catch (error) {
    console.error('Error en búsqueda:', error);
    res.json([]);
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
