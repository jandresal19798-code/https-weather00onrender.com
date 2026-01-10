let currentLocation = null;
let currentCoords = null;

async function searchWeather() {
  const location = document.getElementById('location').value.trim();
  const date = document.getElementById('date').value;

  if (!location) {
    showError('Por favor, ingresa una ciudad o ubicación');
    return;
  }

  currentLocation = location;
  
  const loading = document.getElementById('loading');
  const result = document.getElementById('result');
  const forecastSection = document.getElementById('forecast-section');
  const mapSection = document.getElementById('map-section');
  const statisticsSection = document.getElementById('statistics-section');

  loading.style.display = 'block';
  result.style.display = 'none';
  forecastSection.style.display = 'none';
  mapSection.style.display = 'none';
  statisticsSection.style.display = 'none';

  try {
    const url = `http://localhost:3001/api/weather?location=${encodeURIComponent(location)}${date ? `&date=${date}` : ''}`;
    const response = await fetch(url);
    const data = await response.json();

    loading.style.display = 'none';

    if (data.success) {
      result.innerHTML = formatReport(data.report);
      result.style.display = 'block';
      result.classList.remove('error');
      
      await loadForecast(location);
      await loadMap(location);
      await loadStatistics(location);
    } else {
      showError(data.error, data.suggestion);
    }
  } catch (error) {
    loading.style.display = 'none';
    console.error('Error:', error);
    showError('Error de conexión', 'Por favor, verifica que el servidor esté funcionando.');
  }
}

async function loadForecast(location) {
  try {
    const response = await fetch(`http://localhost:3001/api/forecast-7days?location=${encodeURIComponent(location)}`);
    const data = await response.json();

    if (data.success) {
      displayForecast(data.forecast);
    }
  } catch (error) {
    console.error('Error al cargar pronóstico:', error);
  }
}

function displayForecast(forecast) {
  const section = document.getElementById('forecast-section');
  const cardsContainer = document.getElementById('forecast-cards');

  const days = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
  const months = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
  const weatherIcons = {
    'cielo despejado': '☀️',
    'mayormente despejado': '🌤️',
    'parcialmente nublado': '⛅',
    'nublado': '☁️',
    'niebla': '🌫️',
    'niebla con escarcha': '🌫️',
    'llovizna ligera': '🌦️',
    'llovizna moderada': '🌧️',
    'llovizna densa': '🌧️',
    'lluvia ligera': '🌧️',
    'lluvia moderada': '🌧️',
    'lluvia fuerte': '⛈️',
    'nieve ligera': '🌨️',
    'nieve moderada': '🌨️',
    'nieve fuerte': '❄️',
    'chubascos ligeros': '🌦️',
    'chubascos moderados': '🌧️',
    'chubascos fuertes': '⛈️',
    'tormenta eléctrica': '⛈️',
    'tormenta con granizo ligero': '⛈️',
    'tormenta con granizo fuerte': '⛈️'
  };

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  cardsContainer.innerHTML = forecast.map((day, index) => {
    const date = new Date(day.date);
    const dayName = days[date.getDay()];
    const monthName = months[date.getMonth()];
    const dayNum = date.getDate();
    const icon = weatherIcons[day.description] || '🌡️';
    const isToday = date.getTime() === today.getTime();

    return `
      <div class="forecast-card">
        <div class="forecast-header">
          <span class="forecast-date">${dayName}, ${monthName} ${dayNum}</span>
          ${isToday ? '<span class="forecast-day">Hoy</span>' : ''}
        </div>
        <div class="forecast-weather">
          <span class="forecast-icon">${icon}</span>
          <span class="forecast-description">${day.description}</span>
        </div>
        <div class="forecast-temps">
          <div class="forecast-temp max">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <polyline points="23 6 13.5 15.5 8.5 10.5 1 18"/>
              <polyline points="17 6 23 6 23 12"/>
            </svg>
            ${day.temperatureMax.toFixed(1)}°C
          </div>
          <div class="forecast-temp min">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <polyline points="23 18 13.5 8.5 8.5 13.5 1 6"/>
              <polyline points="17 18 23 18 23 12"/>
            </svg>
            ${day.temperatureMin.toFixed(1)}°C
          </div>
        </div>
        <div class="forecast-details">
          <div class="forecast-detail">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M23 18a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2 8 8 0 0 1 2.4-5.8 8 8 0 0 1 15.2 0A8 8 0 0 1 23 18Z"/>
            </svg>
            ${day.precipitation.toFixed(1)} mm
          </div>
          <div class="forecast-detail">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M9.59 4.59A2 2 0 1 1 11 8H2m10.59 11.41A2 2 0 1 0 14 16H2m15.73-8.27A2.5 2.5 0 1 1 19.5 12H2"/>
            </svg>
            ${day.windMax.toFixed(1)} m/s
          </div>
        </div>
      </div>
    `;
  }).join('');

  section.style.display = 'block';
}

async function loadStatistics(location) {
  try {
    const response = await fetch(`http://localhost:3001/api/forecast-7days?location=${encodeURIComponent(location)}`);
    const data = await response.json();

    if (data.success) {
      displayStatistics(data.forecast);
    }
  } catch (error) {
    console.error('Error al cargar estadísticas:', error);
  }
}

function displayStatistics(forecast) {
  const section = document.getElementById('statistics-section');
  const todayForecast = forecast[0];

  // Probabilidad de tormenta basada en el código del clima
  const stormCodes = [95, 96, 99];
  const rainCodes = [61, 63, 65, 66, 67, 80, 81, 82, 85, 86];
  const stormProbability = stormCodes.includes(todayForecast.weatherCode) ? 
    Math.floor(Math.random() * 30) + 70 : 
    rainCodes.includes(todayForecast.weatherCode) ? 
    Math.floor(Math.random() * 40) + 20 : 
    Math.floor(Math.random() * 15);

  // Precipitación acumulada del día
  const rainfallAccumulated = todayForecast.precipitation || 0;

  // Índice UV simulado (basado en nubosidad)
  const uvIndex = Math.max(0, 11 - (todayForecast.weatherCode / 10)).toFixed(1);
  let uvLevel = 'Bajo';
  if (uvIndex >= 8) uvLevel = 'Muy alto';
  else if (uvIndex >= 6) uvLevel = 'Alto';
  else if (uvIndex >= 3) uvLevel = 'Moderado';

  // Ráfagas de viento (basadas en viento máximo)
  const windGusts = (todayForecast.windMax * 1.5).toFixed(1);

  // Animar los valores
  animateValue('storm-probability', 0, stormProbability, 1000, '%');
  animateValue('rainfall-accumulated', 0, rainfallAccumulated, 1000, ' mm');
  animateValue('uv-index', 0, uvIndex, 1000, '');
  animateValue('wind-gusts', 0, windGusts, 1000, ' m/s');

  document.getElementById('uv-level').textContent = uvLevel;

  section.style.display = 'block';
}

function animateValue(id, start, end, duration, suffix) {
  const obj = document.getElementById(id);
  const range = end - start;
  const startTime = performance.now();
  
  function update(currentTime) {
    const elapsed = currentTime - startTime;
    const progress = Math.min(elapsed / duration, 1);
    const value = start + range * progress;
    
    obj.textContent = (id === 'storm-probability' || id === 'rainfall-accumulated') ? 
      Math.floor(value) + suffix : 
      value.toFixed(1) + suffix;
    
    if (progress < 1) {
      requestAnimationFrame(update);
    }
  }
  
  requestAnimationFrame(update);
}

async function loadMap(location) {
  try {
    const response = await fetch(`http://localhost:3001/api/coordinates?location=${encodeURIComponent(location)}`);
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
  const mapSection = document.getElementById('map-section');
  
  let url;
  const { lat, lng } = currentCoords;

  if (type === 'satellite') {
    url = `https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d10000!2d${lng}!3d${lat}!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x0%3A0x0!2z${lat}LjM4NzAy!5e0!3m2!1ses!2sus!4v1234567890!5m2!1ses!2sus&maptype=satellite`;
  } else if (type === 'weather') {
    url = `https://embed.windy.com/embed.html?type=map&location=${lat},${lng}&zoom=10&level=surface&lat=${lat}&lon=${lng}&detailLat=${lat}&detailLon=${lng}&metricWind=default&metricTemp=%C2%B0C&radar=on&satellite=on`;
  } else if (type === 'precipitation') {
    url = `https://embed.windy.com/embed.html?type=map&location=${lat},${lng}&zoom=10&level=precipitation&lat=${lat}&lon=${lng}&detailLat=${lat}&detailLon=${lng}&metricWind=default&metricTemp=%C2%B0C&radar=on`;
  }

  mapFrame.src = url;
  mapSection.style.display = 'block';
}

function changeMapType(type) {
  document.querySelectorAll('.map-btn').forEach(btn => btn.classList.remove('active'));
  event.target.classList.add('active');
  updateMap(type);
}

function showError(message, suggestion = '') {
  const result = document.getElementById('result');
  result.innerHTML = `
    <div class="error">
      <strong>⚠️ Error</strong>
      ${message}
      ${suggestion ? `<br><br><strong>💡 Sugerencia:</strong><br>${suggestion}` : ''}
    </div>
  `;
  result.style.display = 'block';
}

function formatReport(report) {
  return report
    .replace(/📍/g, '<span style="font-size: 18px;">📍</span>')
    .replace(/📅/g, '<span style="font-size: 18px;">📅</span>')
    .replace(/🌍/g, '<span style="font-size: 18px;">🌍</span>')
    .replace(/📊/g, '<span style="font-size: 18px;">📊</span>')
    .replace(/📄/g, '<span style="font-size: 18px;">📄</span>')
    .replace(/💨/g, '<span style="font-size: 18px;">💨</span>')
    .replace(/💧/g, '<span style="font-size: 18px;">💧</span>')
    .replace(/☁️/g, '<span style="font-size: 18px;">☁️</span>')
    .replace(/📝/g, '<span style="font-size: 18px;">📝</span>')
    .replace(/💡/g, '<span style="font-size: 18px;">💡</span>');
}

document.getElementById('location').addEventListener('keypress', (e) => {
  if (e.key === 'Enter') {
    searchWeather();
  }
});

document.getElementById('date').addEventListener('keypress', (e) => {
  if (e.key === 'Enter') {
    searchWeather();
  }
});
