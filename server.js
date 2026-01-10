import express from 'express';
import cors from 'cors';

const app = express();
const port = 3001;

app.use(cors());
app.use(express.static('public'));

app.get('/api/forecast-7days', async (req, res) => {
  try {
    const { location } = req.query;
    
    if (!location) {
      return res.status(400).json({ error: 'Ubicación requerida' });
    }

    const { OpenMeteo } = await import('./src/weatherSources.js');
    const openMeteo = new OpenMeteo();
    const forecast = await openMeteo.get7DayForecast(location);

    res.json({ success: true, forecast });
  } catch (error) {
    console.error('Error en forecast 7 días:', error);
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/coordinates', async (req, res) => {
  try {
    const { location } = req.query;
    
    if (!location) {
      return res.status(400).json({ error: 'Ubicación requerida' });
    }

    const { OpenMeteo } = await import('./src/weatherSources.js');
    const openMeteo = new OpenMeteo();
    const coords = await openMeteo.getCoordinates(location);

    res.json({ 
      success: true, 
      location: coords.name,
      country: coords.country,
      latitude: coords.latitude,
      longitude: coords.longitude
    });
  } catch (error) {
    console.error('Error al obtener coordenadas:', error);
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/weather', async (req, res) => {
  try {
    const { location, date, forecast } = req.query;
    
    if (!location) {
      return res.status(400).json({ error: 'Ubicación requerida' });
    }

    const { WeatherAgent } = await import('./src/agent.js');
    const agent = new WeatherAgent();
    const report = await agent.analyzeWeather(
      location,
      date || new Date().toISOString().split('T')[0],
      forecast === 'true'
    );

    res.json({ success: true, report });
  } catch (error) {
    console.error('Error en API:', error);
    res.status(500).json({ 
      error: error.message,
      suggestion: 'Intenta con el nombre de la ciudad en español o inglés, o sin incluir el país'
    });
  }
});

app.get('/', (req, res) => {
  res.sendFile('index.html', { root: 'public' });
});

app.listen(port, () => {
  console.log(`🌐 Servidor web: http://localhost:${port}`);
  console.log(`📊 API: http://localhost:${port}/api/weather?location=Madrid`);
  console.log(`📅 Forecast: http://localhost:${port}/api/forecast-7days?location=Madrid`);
  console.log(`🗺️ Coordinates: http://localhost:${port}/api/coordinates?location=Madrid`);
});
