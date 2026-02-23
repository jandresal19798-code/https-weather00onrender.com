import express from 'express';
import cors from 'cors';
import rateLimit from 'express-rate-limit';
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

// Hourly forecast endpoint
app.get('/api/forecast', async (req, res) => {
  try {
    const { location } = req.query;

    if (!location) {
      return res.status(400).json({ error: 'Ubicación requerida' });
    }

    const cacheKey = getCacheKey('/api/forecast', { location });
    const cached = getCached(cacheKey);

    if (cached) {
      return res.json(cached);
    }

    const { OpenMeteo } = await import('./src/weatherSources.js');
    const openMeteo = new OpenMeteo();
    const hourlyData = await openMeteo.getHourlyForecast(location);

    const response = {
      success: true,
      location,
      hourly: hourlyData,
      source: 'Open-Meteo'
    };

    setCache(cacheKey, response);
    res.json(response);
  } catch (error) {
    console.error('Forecast error:', error);
    res.status(503).json({ error: 'Servicio no disponible', success: false });
  }
});

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
    const location = req.query.location;
    const lat = req.query.lat;
    const lng = req.query.lng;

    if (lat && lng) {
      const cacheKey = getCacheKey('/api/coordinates', { lat, lng });
      const cached = getCached(cacheKey);

      if (cached) {
        return res.json(cached);
      }

      try {
        const axios = (await import('axios')).default;
        const response = await axios.get(
          `https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${lat}&longitude=${lng}&localityLanguage=es`,
          { timeout: 5000 }
        );

        const data = response.data;
        const result = {
          success: true,
          location: data.city || data.locality || data.principalSubdivision || 'Ubicación desconocida',
          country: data.countryName || '',
          countryCode: data.countryCode || '',
          latitude: parseFloat(lat),
          longitude: parseFloat(lng)
        };

        setCached(cacheKey, result);
        return res.json(result);
      } catch (error) {
        console.log('Reverse geocoding falló, usando coordenadas directamente');
        return res.json({
          success: true,
          location: `${lat}, ${lng}`,
          country: '',
          countryCode: '',
          latitude: parseFloat(lat),
          longitude: parseFloat(lng)
        });
      }
    }

    if (!location) {
      return res.status(400).json({ error: 'Se requiere location o lat/lng' });
    }

    const cacheKey = getCacheKey('/api/coordinates', { location });
    const cached = getCached(cacheKey);

    if (cached) {
      return res.json(cached);
    }

    const { OpenMeteo } = await import('./src/weatherSources.js');
    const openMeteo = new OpenMeteo();
    let coords;

    const cleanLocation = location.split('(')[0]
      .replace(/Muy Fiel y Reconquistadora Ciudad de San Felipe y Santiago de/i, '')
      .trim();

    const variations = [location, cleanLocation];

    if (cleanLocation.toLowerCase().includes('montevideo')) {
      variations.push('Montevideo, Uruguay');
    }

    const commonCountries = [
      'argentina', 'uruguay', 'chile', 'brasil', 'paraguay', 'bolivia', 'peru', 'ecuador',
      'colombia', 'venezuela', 'mexico', 'españa', 'portugal', 'francia'
    ];

    if (cleanLocation.includes(',')) {
      const parts = cleanLocation.split(',').map(p => p.trim());
      variations.push(parts[0]);
      if (parts.length >= 2) variations.push(`${parts[0]}, ${parts[1]}`);
    } else {
      // Si la búsqueda es simple, intentar con países comunes si falla
      variations.push(`${cleanLocation}, Uruguay`);
      variations.push(`${cleanLocation}, Argentina`);
      variations.push(`${cleanLocation}, España`);
    }

    const triedLocations = new Set();
    for (const loc of variations) {
      const normalized = loc.trim().toLowerCase();
      if (!normalized || normalized.length < 2 || triedLocations.has(normalized)) continue;
      triedLocations.add(normalized);

      console.log(`🔍 Intentando geocodificar: "${loc}"`);
      try {
        coords = await openMeteo.getCoordinates(loc);
        if (coords && (coords.latitude || coords.lat)) break;
      } catch (e) {
        continue;
      }
    }

    if (!coords) {
      // Último recurso: si contiene una coma, intentar solo con la primera parte
      if (location.includes(',')) {
        const firstPart = location.split(',')[0].trim();
        try {
          coords = await openMeteo.getCoordinates(firstPart);
        } catch (e) { }
      }
    }

    if (!coords) {
      throw new Error(`Ubicación no encontrada: ${location}. Intenta con un nombre más simple (ej: Montevideo).`);
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
  res.json({
    cacheSize: cache.size,
    stats: Array.from(cache.entries()).map(([key, value]) => ({
      key,
      age: Math.floor((Date.now() - value.timestamp) / 1000) + 's'
    }))
  });
});

app.post('/api/chat', async (req, res) => {
  try {
    const { message, history, context } = req.body;
    
    console.log('Chat request received:', { message: message?.substring(0, 50) });
    
    if (!message) {
      return res.status(400).json({ error: 'Mensaje requerido' });
    }
    
    // Build location and weather context
    const location = context?.location || 'No especificada';
    const weather = context ? 
      `${context.temperature}°C, ${context.description}, humedad ${context.humidity}%` : 
      'No disponibles';

    // Check for GROQ_API_KEY
    const apiKey = process.env.GROQ_API_KEY;
    console.log('GROQ_API_KEY exists:', !!apiKey, 'length:', apiKey?.length);
    
    if (apiKey && apiKey !== 'tu_api_key_aqui' && apiKey.length > 10) {
      console.log('Attempting Groq API call...');
      try {
        const axios = (await import('axios')).default;
        const response = await axios.post('https://api.groq.com/openai/v1/chat/completions', {
          model: 'llama3-70b-8192',
          messages: [
            {
              role: 'system',
              content: `Eres Zeus, un asistente meteorologico experto y amigable de Zeus Meteo.
              Ubicacion actual del usuario: ${location}
              Clima actual: ${weather}
              Responde de forma concisa, util y en espanol. Usa emojis ocasionalmente.
              Puedes ayudar con: clima, temperatura, lluvia, viento, humedad, presion, recomendaciones de ropa, etc.`
            },
            ...(history || []).slice(-4).map(msg => ({
              role: msg.role === 'user' ? 'user' : 'assistant',
              content: msg.content
            })),
            { role: 'user', content: message }
          ],
          temperature: 0.7,
          max_tokens: 300
        }, {
          headers: { 
            'Authorization': `Bearer ${apiKey}`, 
            'Content-Type': 'application/json' 
          },
          timeout: 30000
        });

        const reply = response.data.choices[0].message.content;
        console.log('Groq response OK, length:', reply.length);
        return res.json({ response: reply });
      } catch (groqError) {
        console.error('Groq API error:', groqError.response?.status, groqError.response?.data || groqError.message);
        // Fall through to fallback
      }
    } else {
      console.log('No valid GROQ_API_KEY, using fallback');
    }

    // Fallback: Smart response without API
    const fallbackResponse = generateSmartResponse(message, location, weather);
    return res.json({ response: fallbackResponse });
    
  } catch (error) {
    console.error('Chat error:', error.message);
    const fallbackResponse = generateSmartResponse(req.body?.message || 'hola', 'ubicacion', 'clima actual');
    res.json({ response: fallbackResponse });
  }
});

// Smart fallback responses without AI
function generateSmartResponse(message, location, weather) {
  const msg = message.toLowerCase();
  
  if (msg.includes('hola') || msg.includes('hi') || msg.includes('buenos') || msg.includes('buenas')) {
    return `¡Hola! 👋 Soy Zeus IA, tu asistente meteorologico de Zeus Meteo. Preguntame sobre el clima, temperatura, lluvia o cualquier duda meteorologica.`;
  }
  
  if (msg.includes('clima') || msg.includes('tiempo') || msg.includes('temperatura') || msg.includes('cuanto')) {
    return `📍 El clima actual en ${location} es: ${weather}. ¿Quieres saber el pronostico para los proximos dias?`;
  }
  
  if (msg.includes('llover') || msg.includes('lluvia') || msg.includes('llovizna') || msg.includes('paraguas')) {
    return `🌧️ Para saber si llovera, consulta la seccion de pronostico. Si hay nubes oscuras y humedad alta, es probable que llueva. ¿Buscas el clima en alguna ciudad especifica?`;
  }
  
  if (msg.includes('calor') || msg.includes('caluroso') || msg.includes('frio') || msg.includes('helado')) {
    return `🌡️ Actualmente en ${location}: ${weather}. Recuerda hidratarte si hace calor, o abrigarte si hace frio!`;
  }
  
  if (msg.includes('viento') || msg.includes('ventoso') || msg.includes('aire')) {
    return `💨 El viento es importante para la sensacion termica. En ${location} el clima es: ${weather}. Los vientos fuertes pueden hacer que se sienta mas frio.`;
  }
  
  if (msg.includes('humedad') || msg.includes('seco')) {
    return `💧 La humedad afecta como percibimos la temperatura. Clima actual en ${location}: ${weather}. Alta humedad = sensacion de mas calor.`;
  }
  
  if (msg.includes('rayo') || msg.includes('tormenta') || msg.includes('trueno')) {
    return `⛈️ Si hay tormenta electrica, mantente bajo techo y alejado de arboles y metales. Cada segundo caen unos 100 rayos en el mundo!`;
  }
  
  if (msg.includes('nieve') || msg.includes('nevando')) {
    return `❄️ La nieve se forma cuando la temperatura es menor a 0°C y hay suficiente humedad. Clima actual: ${weather}`;
  }
  
  if (msg.includes('arcoiris') || msg.includes('arco iris')) {
    return `🌈 Los arcoiris se forman cuando la luz del sol atraviesa gotas de lluvia. Necesitas sol detras de ti y lluvia enfrente para verlo!`;
  }
  
  if (msg.includes('presion') || msg.includes('barometro')) {
    return `⏱️ La presion atmosferica indica cambios del clima. Presion alta = buen tiempo. Presion baja = posible lluvia. Clima actual: ${weather}`;
  }
  
  if (msg.includes('amanecer') || msg.includes('atardecer') || msg.includes('sol')) {
    return `☀️ Los horarios de amanecer y atardecer cambian segun la estacion y ubicacion. Consulta la seccion principal para ver los horarios exactos.`;
  }
  
  if (msg.includes('luna') || msg.includes('fase lunar')) {
    return `🌙 La Luna tarda 29.5 dias en completar sus fases. La luna llena es la mas brillante. Consulta el widget lunar en la app!`;
  }
  
  if (msg.includes('gracias') || msg.includes('thanks') || msg.includes('genial')) {
    return `¡De nada! 😊 Estoy aqui para ayudarte con cualquier consulta meteorologica. ¡Que tengas un excelente dia!`;
  }
  
  if (msg.includes('adios') || msg.includes('bye') || msg.includes('chau')) {
    return `¡Hasta luego! 👋 Vuelve cuando quieras consultar el clima. ¡Cuidate!`;
  }
  
  return `🤔 Entiendo tu pregunta. El clima actual en ${location} es: ${weather}. Puedo ayudarte con informacion sobre temperatura, lluvia, viento, humedad y mas. ¿Que te gustaria saber?`;
}

app.get('/', (req, res) => {
  res.sendFile('index.html', { root: 'public' });
});

app.listen(port, () => {
  console.log(`🌐 Server: http://localhost:${port}`);
});
