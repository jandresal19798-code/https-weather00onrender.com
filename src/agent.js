import dotenv from 'dotenv';
import { OpenWeatherMap, WeatherAPI, OpenMeteo, MetNorway, MockWeatherSource } from './weatherSources.js';
import { OllamaClient } from './reportGenerator.js';

dotenv.config();

class WeatherAgent {
  constructor() {
    this.sources = [];
    this.reportGenerator = new OllamaClient(process.env.OLLAMA_URL);
    this.initializeSources();
  }

  initializeSources() {
    this.sources.push(new OpenMeteo());
    this.sources.push(new MetNorway());

    if (process.env.OPENWEATHER_API_KEY && process.env.OPENWEATHER_API_KEY !== 'tu_api_key_aqui') {
      this.sources.push(new OpenWeatherMap(process.env.OPENWEATHER_API_KEY));
    }

    if (process.env.WEATHERAPI_KEY && process.env.WEATHERAPI_KEY !== 'tu_api_key_aqui') {
      this.sources.push(new WeatherAPI(process.env.WEATHERAPI_KEY));
    }
  }

  async analyzeWeather(location, date = new Date().toISOString().split('T')[0], useForecast = false) {
    console.log(`🔍 Analizando clima para: ${location}`);
    console.log(`📅 Fecha: ${date}`);
    console.log(`📊 Consultando ${this.sources.length} fuentes de datos...\n`);

    const weatherData = [];
    const errors = [];

    const locationsToTry = [
      location,
      location.replace(/,\s*\w+$/i, ''),
      location.replace(/\s+\w+$/i, '')
    ];

    for (const source of this.sources) {
      let locationFound = false;
      for (const loc of locationsToTry) {
        if (locationFound) break;
        try {
          let data;
          if (useForecast) {
            const forecast = await source.getForecast(loc, 3);
            data = Array.isArray(forecast) ? forecast[0] : forecast;
            if (!data || !data.temperature) {
              throw new Error('Datos de pronóstico no válidos');
            }
          } else {
            data = await source.getCurrentWeather(loc);
            if (!data || !data.temperature) {
              throw new Error('Datos actuales no válidos');
            }
          }
          weatherData.push(data);
          console.log(`✅ ${data.source}: ${data.temperature}°C - ${data.description}`);
          locationFound = true;
        } catch (error) {
          if (loc === locationsToTry[locationsToTry.length - 1]) {
            console.log(`❌ ${source.constructor.name}: ${error.message}`);
            errors.push({ source: source.constructor.name, error: error.message });
          }
        }
      }
    }

    if (weatherData.length === 0) {
      throw new Error(`No se pudo obtener datos de ninguna fuente. Intenta con el nombre de la ciudad en español o inglés.`);
    }

    if (errors.length > 0) {
      console.log(`⚠️  Algunas fuentes fallaron: ${errors.map(e => e.source).join(', ')}`);
    }

    console.log('\n📝 Generando informe...\n');
    const report = await this.reportGenerator.generateReport(weatherData, location, date);

    return report;
  }

  async saveReport(report, filename) {
    const fs = await import('fs');
    await fs.promises.writeFile(filename, report, 'utf-8');
    console.log(`💾 Informe guardado en: ${filename}`);
  }
}

async function main() {
  const args = process.argv.slice(2);
  
  if (args.length < 1) {
    console.log(`
🌤️  Agente de Análisis del Clima

Uso:
  node src/agent.js <ubicación> [fecha] [opciones]

Ejemplos:
  node src/agent.js "Madrid"
  node src/agent.js "Buenos Aires" "2024-01-15"
  node src/agent.js "Ciudad de México" "2024-01-15" --save reporte.txt
  node src/agent.js "Lima" --forecast

Opciones:
  --save <archivo>   Guardar informe en archivo
  --forecast         Usar datos de pronóstico
    `);
    process.exit(1);
  }

  const location = args[0];
  const date = args[1] || new Date().toISOString().split('T')[0];
  const saveIndex = args.indexOf('--save');
  const saveFile = saveIndex !== -1 ? args[saveIndex + 1] : null;
  const useForecast = args.includes('--forecast');

  try {
    const agent = new WeatherAgent();
    const report = await agent.analyzeWeather(location, date, useForecast);

    console.log(report);

    if (saveFile) {
      await agent.saveReport(report, saveFile);
    }
  } catch (error) {
    console.error(`❌ Error: ${error.message}`);
    process.exit(1);
  }
}

if (import.meta.url === `file://${process.argv[1].replace(/\\/g, '/')}`) {
  main();
}

export { WeatherAgent };
