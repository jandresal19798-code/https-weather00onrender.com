import axios from 'axios';

class OllamaClient {
  constructor(baseUrl = 'http://localhost:11434') {
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
      return this.generateBasicReport(weatherData, location, date);
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
5. Visibilidad y nubosidad
6. Recomendaciones para actividades

Formato el informe de manera clara y profesional.`;
  }

  generateBasicReport(weatherData, location, date) {
    const avgTemp = weatherData.reduce((sum, d) => sum + d.temperature, 0) / weatherData.length;
    const avgHumidity = weatherData.reduce((sum, d) => sum + d.humidity, 0) / weatherData.length;
    const avgWind = weatherData.reduce((sum, d) => sum + d.windSpeed, 0) / weatherData.length;

    const conditions = weatherData.map(d => d.description);
    const commonCondition = conditions.sort((a,b) =>
      conditions.filter(v => v===a).length - conditions.filter(v => v===b).length
    ).pop();

    return `
📍 INFORME DEL CLIMA
📅 Fecha: ${date}
🌍 Ubicación: ${location}

📊 TEMPERATURA
• Promedio: ${avgTemp.toFixed(1)}°C
• Rango: ${Math.min(...weatherData.map(d => d.temperature)).toFixed(1)}°C - ${Math.max(...weatherData.map(d => d.temperature)).toFixed(1)}°C

💨 VIENTO
• Velocidad promedio: ${avgWind.toFixed(1)} m/s

💧 HUMEDAD
• Promedio: ${avgHumidity.toFixed(1)}%

☁️ CONDICIONES
• Estado predominante: ${commonCondition}

📝 FUENTES CONSULTADAS
${weatherData.map(d => `• ${d.source}`).join('\n')}

💡 RECOMENDACIONES
${avgTemp > 25 ? '• Usar protector solar e hidratarse' : avgTemp < 15 ? '• Abrigarse bien' : '• Clima agradable para actividades al aire libre'}
${avgWind > 10 ? '• Precaución con viento fuerte' : ''}
${avgHumidity > 70 ? '• Posible sensación de humedad' : ''}
`;
  }
}

export { OllamaClient };
