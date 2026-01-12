import axios from 'axios';

class GroqClient {
  constructor(apiKey = process.env.GROQ_API_KEY) {
    this.apiKey = apiKey;
    this.baseUrl = 'https://api.groq.com/openai/v1';
  }

  async generateReport(weatherData, location, date) {
    const prompt = this.buildPrompt(weatherData, location, date);
    
    try {
      const response = await axios.post(
        `${this.baseUrl}/chat/completions`,
        {
          model: 'llama-3.3-70b-versatile',
          messages: [
            {
              role: 'system',
              content: 'Eres un asistente meteorológico experto. Generas informes claros, precisos y útiles en español. Siempre incluye análisis técnico y recomendaciones prácticas.'
            },
            {
              role: 'user',
              content: prompt
            }
          ],
          temperature: 0.7,
          max_tokens: 1024
        },
        {
          headers: {
            'Authorization': `Bearer ${this.apiKey}`,
            'Content-Type': 'application/json'
          }
        }
      );

      return response.data.choices[0].message.content;
    } catch (error) {
      console.warn('Groq no disponible:', error.message);
      return null;
    }
  }

  buildPrompt(weatherData, location, date) {
    const dataSummary = weatherData.map(d => 
      `${d.source}: ${d.temperature}°C, ${d.description}, humedad: ${d.humidity}%, viento: ${d.windSpeed}m/s${d.pressure ? `, presión: ${d.pressure}hPa` : ''}`
    ).join('\n');

    const avgTemp = weatherData.reduce((sum, d) => sum + d.temperature, 0) / weatherData.length;
    const avgHumidity = weatherData.reduce((sum, d) => sum + d.humidity, 0) / weatherData.length;
    const avgWind = weatherData.reduce((sum, d) => sum + d.windSpeed, 0) / weatherData.length;
    const tempRange = `${Math.min(...weatherData.map(d => d.temperature)).toFixed(1)}°C - ${Math.max(...weatherData.map(d => d.temperature)).toFixed(1)}°C`;

    return `Genera un informe meteorológico detallado para ${location} el ${date}.

DATOS AGREGADOS:
- Temperatura promedio: ${avgTemp.toFixed(1)}°C (rango: ${tempRange})
- Humedad promedio: ${avgHumidity.toFixed(1)}%
- Velocidad del viento: ${avgWind.toFixed(1)} m/s

DATOS POR FUENTE:
${dataSummary}

Genera un informe en español con:
1. **Resumen ejecutivo** del clima actual
2. **Análisis técnico** con temperaturas, humedad, viento y presión
3. **Predicción de tendencia** (estable, aumento, descenso)
4. **Recomendaciones específicas** para actividades al aire libre, vestimenta, salud
5. **Alertas** si hay condiciones extremas (tormentas, calor extremo, frío intenso)
6. **Confianza del pronóstico** basada en la consistencia de las fuentes

Usa emojis y formato markdown para que sea fácil de leer. Sé específico con horarios y valores.`;
  }
}

class OllamaClient {
  constructor(baseUrl = process.env.OLLAMA_URL || 'http://localhost:11434') {
    this.baseUrl = baseUrl;
  }

  async generateReport(weatherData, location, date) {
    const prompt = this.buildPrompt(weatherData, location, date);
    
    try {
      const response = await axios.post(`${this.baseUrl}/api/generate`, {
        model: 'llama2',
        prompt: prompt,
        stream: false
      });

      return response.data.response;
    } catch (error) {
      console.warn('Ollama no disponible, generando reporte básico...');
      return null;
    }
  }

  buildPrompt(weatherData, location, date) {
    const dataSummary = weatherData.map(d => 
      `${d.source}: ${d.temperature}°C, ${d.description}, humedad: ${d.humidity}%, viento: ${d.windSpeed}m/s`
    ).join('\n');

    return `Como asistente de meteorología, genera un informe detallado del clima para ${location} en la fecha ${date}.

Datos de múltiples fuentes:
${dataSummary}

Genera un informe en español que incluya:
1. Resumen general del clima
2. Temperatura promedio y rangos
3. Condiciones del viento
4. Humedad y presión atmosférica
5. Recomendaciones para actividades

Formato profesional con emojis.`;
  }
}

class ReportGenerator {
  constructor() {
    this.groqClient = new GroqClient();
    this.ollamaClient = new OllamaClient();
  }

  async generateReport(weatherData, location, date) {
    if (!weatherData || weatherData.length === 0) {
      return this.generateBasicReport(weatherData, location, date);
    }

    let report = null;

    if (process.env.GROQ_API_KEY) {
      report = await this.groqClient.generateReport(weatherData, location, date);
      if (report) {
        console.log('Reporte generado con Groq AI');
        return this.formatReport(report, weatherData, location, date);
      }
    }

    report = await this.ollamaClient.generateReport(weatherData, location, date);
    if (report) {
      console.log('Reporte generado con Ollama');
      return this.formatReport(report, weatherData, location, date);
    }

    console.log('Usando reporte básico');
    return this.generateBasicReport(weatherData, location, date);
  }

  formatReport(aiReport, weatherData, location, date) {
    const sources = [...new Set(weatherData.map(d => d.source))].join(', ');
    
    return `
🤖 ANÁLISIS INTELIGENTE ZEUS METEO
═══════════════════════════════════════

${aiReport}

📊 FUENTES PROCESADAS
${weatherData.map(d => `• ${d.source}: ${d.temperature}°C, ${d.description}`).join('\n')}
`;
  }

  generateBasicReport(weatherData, location, date) {
    const avgTemp = weatherData.reduce((sum, d) => sum + d.temperature, 0) / weatherData.length;
    const avgHumidity = weatherData.reduce((sum, d) => sum + d.humidity, 0) / weatherData.length;
    const avgWind = weatherData.reduce((sum, d) => sum + d.windSpeed, 0) / weatherData.length;

    const conditions = weatherData.map(d => d.description);
    const commonCondition = conditions.sort((a,b) =>
      conditions.filter(v => v===a).length - conditions.filter(v => v===b).length
    ).pop();

    const sources = [...new Set(weatherData.map(d => d.source))];

    let recommendations = '';
    if (avgTemp > 30) {
      recommendations = '• Alerta de calor: hidratarse frecuentemente\n• Evitar exposición directa al sol\n• Usar ropa ligera';
    } else if (avgTemp > 25) {
      recommendations = '• Clima cálido: protector solar recomendado\n• Ideal para actividades al aire libre';
    } else if (avgTemp > 15) {
      recommendations = '• Clima agradable\n• Perfecto para actividades exteriores';
    } else if (avgTemp > 5) {
      recommendations = '• Fresco: abrigarse ligeramente\n• Ideal para caminatas';
    } else {
      recommendations = '• Frío extremo: abrigarse bien\n• Evitar exposición prolongada';
    }

    if (avgWind > 15) {
      recommendations += '\n• Alerta por viento fuerte: precaución';
    }

    if (avgHumidity > 80) {
      recommendations += '\n• Alta humedad: sensación de incomodidad';
    }

    const trend = avgTemp > 20 ? '📈 Subiendo' : avgTemp < 15 ? '📉 Bajando' : '➡️ Estable';
    const confidence = Math.min(50 + weatherData.length * 15, 95);

    return `
📍 INFORME DEL CLIMA
📅 Fecha: ${date}
🌍 Ubicación: ${location}

📊 TEMPERATURA
• Promedio: ${avgTemp.toFixed(1)}°C
• Rango: ${Math.min(...weatherData.map(d => d.temperature)).toFixed(1)}°C - ${Math.max(...weatherData.map(d => d.temperature)).toFixed(1)}°C
• Tendencia: ${trend}

💨 VIENTO
• Velocidad promedio: ${avgWind.toFixed(1)} m/s

💧 HUMEDAD
• Promedio: ${avgHumidity.toFixed(1)}%

☁️ CONDICIONES
• Estado predominante: ${commonCondition}

📊 CONFIANZA DEL PRONÓSTICO: ${confidence}%

📝 FUENTES CONSULTADAS
${sources.map(s => `• ${s}`).join('\n')}

💡 RECOMENDACIONES
${recommendations}

🤖 ANÁLISIS INTELIGENTE ZEUS METEO
═══════════════════════════════════════

📈 PREDICCIÓN SIMPLE
• El clima se mantiene ${trend.toLowerCase().replace('📈', '').replace('📉', '').replace('➡️', '').trim()}
• Temperatura estable para las próximas horas
• Condiciones generales: ${commonCondition}
`;
  }
}

export { ReportGenerator, GroqClient, OllamaClient };
