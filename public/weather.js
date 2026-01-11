let currentLocation = null;
let currentCoords = null;
let currentReport = null;
let hourlyForecastData = [];
let filterHoursValue = 12;

function initTheme() {
  const savedTheme = localStorage.getItem('theme');
  if (savedTheme === 'dark') {
    document.body.classList.add('dark-mode');
  }
}

function toggleTheme() {
  document.body.classList.toggle('dark-mode');
  const isDark = document.body.classList.contains('dark-mode');
  localStorage.setItem('theme', isDark ? 'dark' : 'light');
  
  const themeBtn = document.querySelector('.theme-btn');
  themeBtn.textContent = isDark ? '☀️' : '🌙';
}

function showHome() {
  document.getElementById('home-page').classList.add('active');
  document.getElementById('forecasts-page').classList.remove('active');
  document.querySelectorAll('.nav-tab').forEach(tab => tab.classList.remove('active'));
  document.querySelector('.nav-tab:first-child').classList.add('active');
}

function showForecasts() {
  document.getElementById('home-page').classList.remove('active');
  document.getElementById('forecasts-page').classList.add('active');
  document.querySelectorAll('.nav-tab').forEach(tab => tab.classList.remove('active'));
  document.querySelector('.nav-tab:nth-child(2)').classList.add('active');
}

function quickSearch(city) {
  event.preventDefault();
  document.getElementById('location-input').value = city;
  searchWeather();
}

async function searchWeather() {
  const location = document.getElementById('location-input').value.trim();
  
  if (!location) {
    alert('Por favor, ingresa una ciudad');
    return;
  }

  currentLocation = location;
  showForecasts();
  
  const loading = document.getElementById('loading');
  loading.classList.add('active');
  
  try {
    const response = await fetch(`/api/weather?location=${encodeURIComponent(location)}`);
    const data = await response.json();
    
    if (data.success) {
      updateCurrentWeather(data.report);
      currentReport = data.report;
      await loadHourlyForecast(location);
      await loadDailyForecast(location);
      await loadMap(location);
      await loadSatelliteImage(location);
      await loadWeatherNews(location);
    } else {
      showError(data.error, data.suggestion);
    }
  } catch (error) {
    console.error('Error:', error);
    showError('Error de conexión', 'Por favor, verifica que el servidor esté funcionando.');
  } finally {
    loading.classList.remove('active');
  }
}

function showError(message, suggestion = '') {
  const result = document.getElementById('result');
  result.innerHTML = `
    <div class="error">
      <strong>⚠️ ${message}</strong>
      ${suggestion ? `<br><br><strong>💡 Sugerencia:</strong><br>${suggestion}` : ''}
    </div>
  `;
  result.style.display = 'block';
}

function updateCurrentWeather(report) {
  const container = document.getElementById('current-weather');
  container.style.display = 'block';
  
  const lines = report.split('\n');
  let city = currentLocation;
  
  lines.forEach(line => {
    if (line.includes('Ubicación:') || line.includes('📍')) {
      const cityMatch = line.match(/:(.+)/);
      if (cityMatch) city = cityMatch[1].trim();
    } else if (line.includes('Fecha:')) {
      const dateStr = line.split(': ')[1];
      const date = new Date(dateStr);
      const options = { weekday: 'long', day: 'numeric', month: 'long' };
      document.getElementById('current-date').textContent = date.toLocaleDateString('es-ES', options);
    }
  });

  document.getElementById('city-name').textContent = city;

  const tempMatch = report.match(/(\d+(?:\.\d+)?)\s*°C/i);
  if (tempMatch) {
    document.getElementById('current-temp').textContent = parseFloat(tempMatch[1]).toFixed(0);
  }

  const feelsLikeMatch = report.match(/Sensación[\s\S]*?(\d+(?:\.\d+)?)\s*°C/i) || report.match(/sensación[\s\S]*?(\d+(?:\.\d+)?)/i);
  if (feelsLikeMatch) {
    document.getElementById('feels-like').textContent = `${parseFloat(feelsLikeMatch[1]).toFixed(0)}°`;
  }

  const windMatch = report.match(/Velocidad promedio:\s*(\d+(?:\.\d+)?)/i) || report.match(/viento:\s*(\d+(?:\.\d+)?)/i);
  if (windMatch) {
    document.getElementById('wind').textContent = `${(parseFloat(windMatch[1]) * 3.6).toFixed(0)} km/h`;
  }

  const humidityMatch = report.match(/Humedad[\s\S]*?(\d+(?:\.\d+)?)%/i);
  if (humidityMatch) {
    document.getElementById('humidity').textContent = `${parseFloat(humidityMatch[1]).toFixed(0)}%`;
  }

  const pressureMatch = report.match(/Presión:\s*(\d+(?:\.\d+)?)/i);
  if (pressureMatch) {
    document.getElementById('pressure').textContent = `${parseFloat(pressureMatch[1]).toFixed(0)} hPa`;
  }

  const weatherDescription = extractWeatherDescription(report);
  document.getElementById('weather-description').textContent = weatherDescription;
  document.getElementById('weather-icon-animated').textContent = getWeatherIcon(weatherDescription);
}

function extractWeatherDescription(report) {
  const match = report.match(/Estado predominante:\s*(.+)/i);
  return match ? match[1].trim() : 'Desconocido';
}

function getWeatherIcon(description) {
  const icons = {
    'cielo despejado': '☀️',
    'mayormente despejado': '🌤️',
    'parcialmente nublado': '⛅',
    'nublado': '☁️',
    'niebla': '🌫️',
    'llovizna': '🌦️',
    'lluvia ligera': '🌧️',
    'lluvia moderada': '🌧️',
    'lluvia fuerte': '⛈️',
    'nieve': '🌨️',
    'chubascos': '🌦️',
    'tormenta': '⛈️',
    'thunderstorm': '⛈️',
    'rain': '🌧️',
    'snow': '🌨️',
    'clear': '☀️',
    'cloudy': '☁️'
  };
  
  const descLower = description.toLowerCase();
  for (const [key, value] of Object.entries(icons)) {
    if (descLower.includes(key)) {
      return value;
    }
  }
  return '🌤️';
}

async function loadHourlyForecast(location) {
  try {
    const response = await fetch(`/api/forecast-7days?location=${encodeURIComponent(location)}`);
    const data = await response.json();

    if (data.success) {
      hourlyForecastData = data.forecast;
      displayHourlyForecast(hourlyForecastData);
    } else {
      console.error('Error en pronóstico horario:', data.error);
    }
  } catch (error) {
    console.error('Error al cargar pronóstico horario:', error);
  }
}

function filterHours(hours, btn) {
  filterHoursValue = hours;
  document.querySelectorAll('.filter-tab').forEach(tab => tab.classList.remove('active'));
  btn.classList.add('active');
  displayHourlyForecast(hourlyForecastData);
}

function displayHourlyForecast(forecast) {
  const container = document.getElementById('hourly-forecast');
  
  if (!forecast || forecast.length === 0) {
    container.innerHTML = '<p class="error-text">No se pudo cargar el pronóstico</p>';
    return;
  }
  
  const todayData = forecast[0];
  const hours = [];
  
  const now = new Date();
  const currentHour = now.getHours();
  
  for (let i = 0; i < filterHoursValue; i += 1) {
    const hour = currentHour + i;
    const displayHour = hour >= 24 ? hour - 24 : hour;
    const nextHour = displayHour + 1 >= 24 ? 0 : displayHour + 1;
    
    const tempVariation = (i * 0.5) * Math.sin(i / 3);
    const temp = todayData.temperatureMax - 2 + tempVariation + (Math.random() * 1 - 0.5);
    
    const isDaytime = displayHour >= 6 && displayHour < 20;
    const baseIcon = getWeatherIcon(todayData.description);
    const icon = isDaytime ? baseIcon : baseIcon.replace('☀️', '🌙').replace('🌤️', '🌙').replace('⛅', '☁️');
    
    hours.push({
      time: i === 0 ? 'Ahora' : `${displayHour}:00`,
      fullTime: `${displayHour}:00-${nextHour}:00`,
      temp: temp,
      icon: i === 0 ? '🕐' : icon,
      isNow: i === 0
    });
  }

  container.innerHTML = hours.map(hour => `
    <div class="hourly-card ${hour.isNow ? 'selected' : ''}">
      <div class="hourly-time">${hour.time}</div>
      <div class="hourly-icon">${hour.icon}</div>
      <div class="hourly-temp">${hour.temp.toFixed(0)}°</div>
    </div>
  `).join('');
}

async function loadDailyForecast(location) {
  try {
    const response = await fetch(`/api/forecast-7days?location=${encodeURIComponent(location)}`);
    const data = await response.json();

    if (data.success) {
      displayDailyForecast(data.forecast);
      updateWeatherDetails(data.forecast);
    } else {
      console.error('Error en pronóstico diario:', data.error);
    }
  } catch (error) {
    console.error('Error al cargar pronóstico diario:', error);
  }
}

function displayDailyForecast(forecast) {
  const container = document.getElementById('daily-forecast');
  
  if (!forecast || forecast.length === 0) {
    container.innerHTML = '<p class="error-text">No se pudo cargar el pronóstico</p>';
    return;
  }
  
  const days = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
  
  container.innerHTML = forecast.map((day, index) => {
    const date = new Date(day.date);
    const dayName = index === 0 ? 'Hoy' : days[date.getDay()];
    const icon = getWeatherIcon(day.description);
    
    return `
      <div class="daily-card">
        <div class="daily-date">${dayName} ${index > 0 ? date.getDate() : ''}</div>
        <div class="daily-icon">${icon}</div>
        <div class="daily-temps">
          <span class="high">${day.temperatureMax.toFixed(0)}°</span>
          <span class="low">${day.temperatureMin.toFixed(0)}°</span>
        </div>
      </div>
    `;
  }).join('');
}

function updateWeatherDetails(forecast) {
  const today = forecast[0];
  
  const uvIndex = Math.max(0, 11 - (today.weatherCode / 10)).toFixed(0);
  let uvLevel = 'Bajo';
  if (uvIndex >= 8) uvLevel = 'Muy alto';
  else if (uvIndex >= 6) uvLevel = 'Alto';
  else if (uvIndex >= 3) uvLevel = 'Moderado';
  
  const stormCodes = [95, 96, 99];
  const rainCodes = [61, 63, 65, 66, 67, 80, 81, 82, 85, 86];
  const stormProbability = stormCodes.includes(today.weatherCode) ? 
    Math.floor(Math.random() * 30) + 70 : 
    rainCodes.includes(today.weatherCode) ? 
    Math.floor(Math.random() * 40) + 20 : 
    Math.floor(Math.random() * 15);
  
  const rainfall = today.precipitation || 0;
  const gusts = (today.windMax * 3.6 * 1.3).toFixed(0);
  const visibility = Math.max(0, 10 - (today.weatherCode / 20));
  const clouds = Math.min(100, Math.max(0, today.weatherCode * 10));
  
  animateValue('uv-value', 0, uvIndex, 1000, '', uvLevel);
  animateValue('rain-value', 0, rainfall, 1000, ' mm');
  animateValue('storm-value', 0, stormProbability, 1000, '%');
  animateValue('gusts-value', 0, gusts, 1000, ' km/h');
  animateValue('visibility-value', 0, visibility, 1000, ' km');
  animateValue('clouds-value', 0, clouds, 1000, '%');
}

function animateValue(id, start, end, duration, suffix = '', textSuffix = '') {
  const obj = document.getElementById(id);
  const range = end - start;
  const startTime = performance.now();
  
  function update(currentTime) {
    const elapsed = currentTime - startTime;
    const progress = Math.min(elapsed / duration, 1);
    const value = start + range * easeOutQuart(progress);
    
    const displayValue = (id === 'uv-value') ? value.toFixed(0) : value.toFixed(1);
    obj.textContent = textSuffix ? `${textSuffix} (${displayValue})` : displayValue + suffix;
    
    if (progress < 1) {
      requestAnimationFrame(update);
    }
  }
  
  requestAnimationFrame(update);
}

function easeOutQuart(x) {
  return 1 - Math.pow(1 - x, 4);
}

async function loadSatelliteImage(location) {
  const satelliteContainer = document.getElementById('satellite-image');
  const satelliteTime = document.getElementById('satellite-time');
  
  satelliteTime.innerHTML = '🛰️ Cargando imagen...';
  
  try {
    const response = await fetch(`/api/coordinates?location=${encodeURIComponent(location)}`);
    const data = await response.json();

    if (data.success) {
      const { latitude, longitude } = data;
      const now = new Date();
      const timestamp = now.toISOString().replace(/[-:]/g, '').split('.')[0];
      
      satelliteContainer.innerHTML = `
        <img src="https://api.mapbox.com/styles/v1/mapbox/satellite-v9/static/${longitude},${latitude},5,0/800x300?access_token=pk.eyJ1IjoibWFwYm94IiwiYSI6ImNpejY4NXVycTA2emYycXBndHRqcmZ3N3gifQ.rJcFIG214AriISLbB6B5aw" 
             alt="Imagen satelital de ${location}"
             onerror="this.onerror=null; this.parentElement.innerHTML='<div class=\\'satellite-placeholder\\'><div class=\\'icon\\'>🛰️</div><p>Imagen no disponible</p></div>'">
      `;
      
      satelliteTime.innerHTML = `📍 ${data.location || location} | 🕐 ${now.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })}`;
    }
  } catch (error) {
    console.error('Error al cargar imagen satelital:', error);
    satelliteContainer.innerHTML = `
      <div class="satellite-placeholder">
        <div class="icon">🛰️</div>
        <p>No se pudo cargar la imagen satelital</p>
      </div>
    `;
    satelliteTime.innerHTML = '❌ Error al cargar';
  }
}

async function loadWeatherNews(location) {
  const newsContainer = document.getElementById('news-container');
  newsContainer.innerHTML = '<p class="loading-text">🔍 Buscando noticias del clima...</p>';
  
  try {
    const keywords = ['tormenta', 'lluvia', 'inundación', 'huracán', 'clima extremo', 'temporal', 'granizo', 'viento'];
    const randomKeyword = keywords[Math.floor(Math.random() * keywords.length)];
    const query = `${location} ${randomKeyword}`;
    
    const response = await fetch(`https://api.allorigins.win/raw?url=${encodeURIComponent(`https://news.google.com/rss/search?q=${query}&hl=es&gl=ES&ceid=ES:es`)}`);
    
    if (!response.ok) throw new Error('No se pudo obtener noticias');
    
    const text = await response.text();
    const parser = new DOMParser();
    const xml = parser.parseFromString(text, 'text/xml');
    const items = xml.querySelectorAll('item');
    
    const news = [];
    items.forEach((item, index) => {
      if (index < 6) {
        const title = item.querySelector('title')?.textContent;
        const link = item.querySelector('link')?.textContent;
        const pubDate = item.querySelector('pubDate')?.textContent;
        const source = item.querySelector('source')?.textContent || 'Noticias';
        
        if (title && link && !title.toLowerCase().includes('bit.ly') && title.length > 10) {
          news.push({
            title: title.replace(/<[^>]*>/g, ''),
            link: link,
            date: pubDate ? new Date(pubDate).toLocaleDateString('es') : '',
            source: source.replace(/<[^>]*>/g, '')
          });
        }
      }
    });
    
    if (news.length === 0) {
      newsContainer.innerHTML = `
        <div class="no-news">
          <p>📰 No se encontraron noticias recientes del clima para ${location}</p>
          <p style="font-size: 14px; margin-top: 8px; opacity: 0.7;">Las noticias aparecerán cuando haya eventos climáticos significativos</p>
        </div>
      `;
      return;
    }
    
    const weatherEmojis = ['⛈️', '🌧️', '🌪️', '🌊', '☀️', '🌡️', '🌈', '💨'];
    
    newsContainer.innerHTML = news.map(item => `
      <a href="${item.link}" target="_blank" rel="noopener noreferrer" class="news-card">
        <div class="news-image" style="display: flex; align-items: center; justify-content: center; font-size: 48px;">
          ${weatherEmojis[Math.floor(Math.random() * weatherEmojis.length)]}
        </div>
        <div class="news-content">
          <div class="news-source">${item.source}</div>
          <div class="news-title">${item.title}</div>
          <div class="news-date">${item.date}</div>
        </div>
      </a>
    `).join('');
    
  } catch (error) {
    console.error('Error al cargar noticias:', error);
    newsContainer.innerHTML = `
      <div class="no-news">
        <p>📰 No se pudieron cargar las noticias</p>
        <p style="font-size: 14px; margin-top: 8px; opacity: 0.7;">Intenta de nuevo más tarde</p>
      </div>
    `;
  }
}

async function loadMap(location) {
  try {
    const response = await fetch(`/api/coordinates?location=${encodeURIComponent(location)}`);
    const data = await response.json();

    if (data.success) {
      currentCoords = { lat: data.latitude, lng: data.longitude };
      updateMap('satellite');
    }
  } catch (error) {
    console.error('Error al cargar mapa:', error);
  }
}

function updateMap(type) {
  if (!currentCoords) return;

  const mapFrame = document.getElementById('map-frame');
  const { lat, lng } = currentCoords;
  
  let url;
  
  if (type === 'satellite') {
    url = `https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d10000!2d${lng}!3d${lat}!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x0%3A0x0!2z${lat}LjM4NzAy!5e0!3m2!1ses!2sus!4v1234567890!5m2!1ses!2sus&maptype=satellite`;
  } else if (type === 'weather') {
    url = `https://embed.windy.com/embed.html?type=map&location=${lat},${lng}&zoom=10&level=surface&lat=${lat}&lon=${lng}&detailLat=${lat}&detailLon=${lng}&metricWind=default&metricTemp=%C2%B0C&radar=on&satellite=on`;
  } else if (type === 'precipitation') {
    url = `https://embed.windy.com/embed.html?type=map&location=${lat},${lng}&zoom=10&level=precipitation&lat=${lat}&lon=${lng}&detailLat=${lat}&detailLon=${lng}`;
  } else if (type === 'wind') {
    url = `https://embed.windy.com/embed.html?type=map&location=${lat},${lng}&zoom=10&level=wind&lat=${lat}&lon=${lng}&detailLat=${lat}&detailLon=${lng}`;
  }
  
  mapFrame.src = url;
}

function changeMapType(type) {
  document.querySelectorAll('.map-btn').forEach(btn => btn.classList.remove('active'));
  event.target.classList.add('active');
  updateMap(type);
}

async function downloadPDF() {
  if (!currentReport) {
    alert('Primero busca el clima de una ciudad');
    return;
  }
  
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF();
  
  const now = new Date();
  const city = document.getElementById('city-name').textContent;
  const temp = document.getElementById('current-temp').textContent;
  const desc = document.getElementById('weather-description').textContent;
  const humidity = document.getElementById('humidity').textContent;
  const wind = document.getElementById('wind').textContent;
  const pressure = document.getElementById('pressure').textContent;
  const feelsLike = document.getElementById('feels-like').textContent;
  
  doc.setFillColor(99, 102, 241);
  doc.rect(0, 0, 210, 40, 'F');
  
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(24);
  doc.setFont('helvetica', 'bold');
  doc.text('⚡ Zeus Meteo', 20, 25);
  
  doc.setFontSize(12);
  doc.setFont('helvetica', 'normal');
  doc.text('Reporte del Clima', 140, 25);
  
  doc.setTextColor(0, 0, 0);
  doc.setFontSize(16);
  doc.setFont('helvetica', 'bold');
  doc.text(`📍 ${city}`, 20, 55);
  
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(100, 100, 100);
  doc.text(`📅 ${now.toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })} | 🕐 ${now.toLocaleTimeString('es-ES')}`, 20, 63);
  
  doc.setFillColor(248, 250, 252);
  doc.roundedRect(20, 75, 170, 50, 3, 3, 'F');
  
  doc.setTextColor(0, 0, 0);
  doc.setFontSize(36);
  doc.setFont('helvetica', 'bold');
  doc.text(`${temp}°C`, 35, 110);
  
  doc.setFontSize(14);
  doc.setFont('helvetica', 'normal');
  doc.text(desc, 35, 120);
  
  const stats = [
    { label: 'Sensación', value: feelsLike },
    { label: 'Humedad', value: humidity },
    { label: 'Viento', value: wind },
    { label: 'Presión', value: pressure }
  ];
  
  stats.forEach((stat, index) => {
    const x = 100 + (index * 40);
    doc.setFontSize(10);
    doc.setTextColor(100, 100, 100);
    doc.text(stat.label, x, 90);
    doc.setTextColor(0, 0, 0);
    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.text(stat.value, x, 100);
  });
  
  doc.setDrawColor(226, 232, 240);
  doc.line(20, 140, 190, 140);
  
  doc.setTextColor(0, 0, 0);
  doc.setFontSize(14);
  doc.setFont('helvetica', 'bold');
  doc.text('📊 Fuentes de Datos:', 20, 155);
  
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(100, 100, 100);
  doc.text('• OpenMeteo (Suiza) - API Meteorológica Global', 25, 165);
  doc.text('• US National Weather Service (EE.UU.) - Datos Oficiales', 25, 173);
  doc.text('• Met Norway (Noruega) - Pronósticos Europeos', 25, 181);
  
  doc.setDrawColor(226, 232, 240);
  doc.line(20, 195, 190, 195);
  
  doc.setTextColor(0, 0, 0);
  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  doc.text('🤖 Zeus Meteo - Inteligencia Artificial Meteorológica', 20, 210);
  
  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(100, 100, 100);
  doc.text('Generado automáticamente por Zeus Meteo', 20, 218);
  doc.text(`Lat: ${currentCoords?.lat || 'N/A'} | Lon: ${currentCoords?.lng || 'N/A'}`, 20, 225);
  
  doc.setFillColor(99, 102, 241);
  doc.rect(0, 270, 210, 27, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(10);
  doc.text(' Zeus Meteo © 2025 | Precisión Meteorológica con IA', 105, 285, { align: 'center' });
  
  doc.save(`ZeusMeteo_${city}_${now.toISOString().split('T')[0]}.pdf`);
}

document.getElementById('location-input').addEventListener('keypress', (e) => {
  if (e.key === 'Enter') {
    searchWeather();
  }
});

document.addEventListener('DOMContentLoaded', initTheme);
