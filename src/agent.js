import dotenv from 'dotenv';
import { OpenWeatherMap, WeatherAPI, OpenMeteo, MetNorway, USNWS, MockWeatherSource } from './weatherSources.js';
import { OllamaClient } from './reportGenerator.js';

dotenv.config();

class WeatherAgent {
  constructor() {
    this.sources = [];
    this.reportGenerator = new OllamaClient(process.env.OLLAMA_URL);
    this.initializeSources();
    this.aiModels = this.initializeAIModels();
  }

  initializeSources() {
    this.sources.push(new OpenMeteo());
    this.sources.push(new USNWS());
    this.sources.push(new MetNorway());

    if (process.env.OPENWEATHER_API_KEY && process.env.OPENWEATHER_API_KEY !== 'tu_api_key_aqui') {
      this.sources.push(new OpenWeatherMap(process.env.OPENWEATHER_API_KEY));
    }

    if (process.env.WEATHERAPI_KEY && process.env.WEATHERAPI_KEY !== 'tu_api_key_aqui') {
      this.sources.push(new WeatherAPI(process.env.WEATHERAPI_KEY));
    }
  }

  initializeAIModels() {
    return {
      ensemble: (data) => this.ensemblePrediction(data),
      trend: (data) => this.trendAnalysis(data),
      anomaly: (data) => this.anomalyDetection(data),
      confidence: (data) => this.calculateConfidence(data)
    };
  }

  async analyzeWeather(location, date = new Date().toISOString().split('T')[0], useForecast = false) {
    console.log(`🔍 Zeus Meteo analizando: ${location}`);
    console.log(`📅 Fecha: ${date}`);
    console.log(`🤖 Consultando ${this.sources.length} fuentes con IA...\n`);

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
      throw new Error(`No se pudo obtener datos. Intenta con el nombre de la ciudad en español o inglés.`);
    }

    console.log('\n🧠 Aplicando IA de Zeus Meteo...');
    
    const aiAnalysis = this.applyAIAnalysis(weatherData, location, date);
    
    if (errors.length > 0) {
      console.log(`⚠️  Algunas fuentes fallaron: ${errors.map(e => e.source).join(', ')}`);
    }

    console.log('\n📝 Generando informe mejorado...\n');
    const report = await this.reportGenerator.generateReport(weatherData, location, date);

    const enhancedReport = this.enhanceReportWithAI(report, aiAnalysis);

    return enhancedReport;
  }

  applyAIAnalysis(data, location, date) {
    const ensemble = this.aiModels.ensemble(data);
    const trend = this.aiModels.trend(data);
    const anomaly = this.aiModels.anomaly(data);
    const confidence = this.aiModels.confidence(data);
    const confidence = this.aiModels.confidence(data);

    return {
      ensemble,
      trend,
      anomaly,
      confidence,
      recommendation: this.generateRecommendation(ensemble, trend),
      alerts: this.generateAlerts(ensemble, anomaly)
    };
  }

  ensemblePrediction(data) {
    if (data.length === 0) return { avg: 20, min: 15, max: 25 };

    const weights = data.map(d => this.getSourceWeight(d.source));
    const totalWeight = weights.reduce((a, b) => a + b, 0);
    
    const avgTemp = data.reduce((sum, d, i) => sum + d.temperature * weights[i], 0) / totalWeight;
    const avgHumidity = data.reduce((sum, d, i) => sum + (d.humidity || 50) * weights[i], 0) / totalWeight;
    const avgWind = data.reduce((sum, d, i) => sum + (d.windSpeed || 0) * weights[i], 0) / totalWeight;
    const avgPressure = data.reduce((sum, d, i) => sum + (d.pressure || 1013) * weights[i], 0) / totalWeight;

    return {
      avg: avgTemp,
      min: Math.min(...data.map(d => d.temperature)) - 2,
      max: Math.max(...data.map(d => d.temperature)) + 2,
      humidity: avgHumidity,
      wind: avgWind,
      pressure: avgPressure,
      descriptions: [...new Set(data.map(d => d.description))].slice(0, 3)
    };
  }

  getSourceWeight(source) {
    const weights = {
      'USNWS': 1.2,
      'OpenMeteo': 1.1,
      'MetNorway': 1.0,
      'OpenWeatherMap': 0.9,
      'WeatherAPI': 0.85
    };
    return weights[source] || 1.0;
  }

  trendAnalysis(data) {
    if (data.length < 2) return { direction: 'stable', change: 0 };

    const sorted = [...data].sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
    const tempDiff = sorted[sorted.length - 1].temperature - sorted[0].temperature;
    
    let direction = 'estable';
    if (tempDiff > 2) direction = 'subiendo';
    else if (tempDiff < -2) direction = 'bajando';

    return {
      direction,
      change: tempDiff,
      humidityTrend: sorted[sorted.length - 1].humidity - sorted[0].humidity,
      windTrend: sorted[sorted.length - 1].windSpeed - sorted[0].windSpeed
    };
  }

  anomalyDetection(data) {
    const temps = data.map(d => d.temperature);
    const mean = temps.reduce((a, b) => a + b, 0) / temps.length;
    const stdDev = Math.sqrt(temps.reduce((sum, t) => sum + Math.pow(t - mean, 2), 0) / temps.length);

    const anomalies = data.filter(d => Math.abs(d.temperature - mean) > 2 * stdDev);

    return {
      isAnomaly: anomalies.length > 0,
      mean,
      stdDev,
      abnormalSources: anomalies.map(d => d.source)
    };
  }

  calculateConfidence(data) {
    const sourceCount = data.length;
    const consistency = this.calculateConsistency(data);
    const dataQuality = this.assessDataQuality(data);
    
    let confidence = 0;
    confidence += Math.min(sourceCount * 15, 45);
    confidence += consistency * 30;
    confidence += dataQuality * 25;

    return Math.min(Math.round(confidence), 100);
  }

  calculateConsistency(data) {
    if (data.length < 2) return 1;
    const temps = data.map(d => d.temperature);
    const range = Math.max(...temps) - Math.min(...temps);
    return Math.max(0, 1 - range / 20);
  }

  assessDataQuality(data) {
    let score = 0;
    data.forEach(d => {
      if (d.temperature > -50 && d.temperature < 60) score += 0.15;
      if (d.humidity !== null && d.humidity >= 0 && d.humidity <= 100) score += 0.1;
      if (d.pressure !== null && d.pressure >= 900 && d.pressure <= 1100) score += 0.1;
    });
    return Math.min(score / data.length, 1);
  }

  generateRecommendation(ensemble, trend) {
    const recs = [];
    
    if (ensemble.avg > 25) {
      recs.push('Usar protector solar');
    }
    if (ensemble.avg < 15) {
      recs.push('Abrigarse bien');
    }
    if (trend.direction === 'bajando') {
      recs.push('Temperatura en descenso - planificar actividades');
    }
    if (trend.direction === 'subiendo') {
      recs.push('Temperatura en aumento');
    }
    if (ensemble.wind > 10) {
      recs.push('Precaución con viento fuerte');
    }
    
    return recs.length > 0 ? recs : ['Clima favorable para actividades'];
  }

  generateAlerts(ensemble, anomaly) {
    const alerts = [];
    
    if (anomaly.isAnomaly) {
      alerts.push(`⚠️ Variación detectada de ${anomaly.mean.toFixed(1)}°C`);
    }
    if (ensemble.humidity > 85) {
      alerts.push('💧 Alta humedad - posible sensación de bochorno');
    }
    if (ensemble.wind > 15) {
      alerts.push('💨 Viento fuerte - precaución');
    }
    
    return alerts;
  }

  enhanceReportWithAI(report, aiAnalysis) {
    let enhanced = report;
    
    enhanced += `

═══════════════════════════════════════════
🤖 ANÁLISIS INTELIGENTE ZEUS METEO
═══════════════════════════════════════════

📊 Predicción Ensemble (ponderada):
   Temperatura: ${aiAnalysis.ensemble.avg.toFixed(1)}°C
   Rango: ${aiAnalysis.ensemble.min.toFixed(1)}°C - ${aiAnalysis.ensemble.max.toFixed(1)}°C
   Humedad promedio: ${aiAnalysis.ensemble.humidity.toFixed(0)}%
   Viento promedio: ${aiAnalysis.ensemble.wind.toFixed(1)} m/s

📈 Tendencia: ${aiAnalysis.trend.direction === 'estable' ? '🟢 Estable' : aiAnalysis.trend.direction === 'subiendo' ? '🔴 Subiendo' : '🔵 Bajando'}
   Cambio: ${aiAnalysis.trend.change > 0 ? '+' : ''}${aiAnalysis.trend.change.toFixed(1)}°C

🎯 Confianza del pronóstico: ${aiAnalysis.confidence}%

💡 Recomendaciones:
${aiAnalysis.recommendation.map(r => `   • ${r}`).join('\n')}

⚡ Fuentes procesadas: ${aiAnalysis.ensemble.descriptions.length} condiciones detectadas
`;

    return enhanced;
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
 ⚡ Zeus Meteo - Agente de Análisis del Clima

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
