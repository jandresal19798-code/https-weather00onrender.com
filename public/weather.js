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
  
  const themeBtn = document.querySelector('.icon-btn:last-child');
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
  saveRecentSearch(location);
  showForecasts();
  
  const loading = document.getElementById('loading');
  loading.classList.add('active');
  
  try {
    const response = await fetch(`/api/weather?location=${encodeURIComponent(location)}`);
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
    
    const data = await response.json();
    
    if (data.success) {
      updateCurrentWeather(data.report);
      currentReport = data.report;
      const now = new Date();
      await Promise.all([
        loadHourlyForecast(location),
        loadDailyForecast(location),
        loadMap(location),
        loadSatelliteImage(location),
        loadWeatherNews(location)
      ]);
      updateSolarInfo(now);
      updateMoonInfo(now);
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
  document.getElementById('weather-icon').textContent = getWeatherIcon(weatherDescription);
  
  setWeatherBackground(weatherDescription);
  
  const aiInsight = generateAIInsight(report, weatherDescription);
  const existingInsight = document.querySelector('.ai-insight');
  const weatherCard = document.querySelector('.weather-card');
  
  if (existingInsight) existingInsight.remove();
  if (aiInsight && weatherCard) {
    weatherCard.insertAdjacentHTML('beforeend', aiInsight);
  }
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
    'cloudy': '☁️',
    'sunny': '☀️',
    'mostly sunny': '🌤️',
    'partly cloudy': '⛅'
  };
  
  const descLower = description.toLowerCase();
  for (const [key, value] of Object.entries(icons)) {
    if (descLower.includes(key)) {
      return value;
    }
  }
  return '☀️';
}

async function loadHourlyForecast(location, retryCount = 0) {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(),10000);
    
    const response = await fetch(`/api/forecast-7days?location=${encodeURIComponent(location)}`, {
      signal: controller.signal
    });
    
    clearTimeout(timeout);
    
    if (!response.ok) {
      if (response.status === 429 && retryCount < 2) {
        console.log('Rate limited, reintentando en 2 segundos...');
        await new Promise(r => setTimeout(r, 2000));
        return loadHourlyForecast(location, retryCount + 1);
      }
      throw new Error(`HTTP ${response.status}`);
    }
    
    const data = await response.json();
 
     if (data.success) {
      hourlyForecastData = data.forecast;
      displayHourlyForecast(hourlyForecastData);
    } else {
      console.warn('Pronóstico no disponible:', data.error);
      displayHourlyForecast(getMockForecast());
    }
  } catch (error) {
    if (error.name === 'AbortError') {
      console.warn('Hourly forecast timeout, using mock data');
      displayHourlyForecast(getMockForecast());
    } else {
      console.warn('Error pronóstico horario, usando datos demo:', error.message);
      displayHourlyForecast(getMockForecast());
    }
  }
}

function getMockForecast() {
  const today = new Date();
  return Array.from({ length: 7 }, (_, i) => {
    const date = new Date(today);
    date.setDate(date.getDate() + i);
    return {
      date: date.toISOString(),
      temperatureMax: 22 + Math.random() * 10,
      temperatureMin: 12 + Math.random() * 8,
      description: 'parcialmente nublado',
      weatherCode: 3
    };
  });
}

async function loadDailyForecast(location, retryCount = 0) {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000);
    
    const response = await fetch(`/api/forecast-7days?location=${encodeURIComponent(location)}`, {
      signal: controller.signal
    });
    
    clearTimeout(timeout);
    
    if (!response.ok) {
      if (response.status === 429 && retryCount < 2) {
        console.log('Rate limited, reintentando...');
        await new Promise(r => setTimeout(r, 2000));
        return loadDailyForecast(location, retryCount + 1);
      }
      throw new Error(`HTTP ${response.status}`);
    }
    
    const data = await response.json();
    
    if (data.success) {
      displayDailyForecast(data.forecast);
      updateWeatherDetails(data.forecast);
      renderTempChart(data.forecast);
      updateSolarInfo(new Date());
      updateMoonInfo(new Date());
      generateActivities(data.forecast);
    } else {
      console.warn('Pronóstico diario no disponible');
      const mockData = getMockForecast();
      displayDailyForecast(mockData);
      updateWeatherDetails(mockData);
      renderTempChart(mockData);
      generateActivities(mockData);
    }
  } catch (error) {
    if (error.name === 'AbortError') {
      console.warn('Daily forecast timeout, using mock data');
      const mockData = getMockForecast();
      displayDailyForecast(mockData);
      updateWeatherDetails(mockData);
      renderTempChart(mockData);
      generateActivities(mockData);
    } else {
      console.warn('Error pronóstico diario, usando datos demo:', error.message);
      const mockData = getMockForecast();
      displayDailyForecast(mockData);
      updateWeatherDetails(mockData);
      renderTempChart(mockData);
      generateActivities(mockData);
    }
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
  const containerWrapper = document.querySelector('.hourly-scroll-container');
  
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
    
    const tempVariation = (i * 0.5) * Math.sin(i / 3);
    const temp = todayData.temperatureMax - 2 + tempVariation + (Math.random() * 1 - 0.5);
    
    const isDaytime = displayHour >= 6 && displayHour < 20;
    const baseIcon = getWeatherIcon(todayData.description);
    const icon = isDaytime ? baseIcon : baseIcon.replace('☀️', '🌙').replace('🌤️', '🌙').replace('⛅', '☁️');
    
    const precipChance = Math.random() * 20;
    
    hours.push({
      time: i === 0 ? 'Ahora' : `${String(displayHour).padStart(2, '0')}:00`,
      temp: temp,
      icon: i === 0 ? '🕐' : icon,
      isNow: i === 0,
      precip: precipChance
    });
  }

  container.innerHTML = hours.map(hour => `
    <div class="hourly-card ${hour.isNow ? 'selected' : ''}">
      <div class="hourly-time">${hour.time}</div>
      <div class="hourly-icon">${hour.icon}</div>
      <div class="hourly-temp">${hour.temp.toFixed(0)}°</div>
      ${hour.precip > 5 ? `<div class="hourly-precip">💧 ${hour.precip.toFixed(0)}%</div>` : ''}
    </div>
  `).join('');
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
  if (uvIndex >= 8) uvLevel = 'Extremo';
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

function updateSolarInfo(date) {
  const sunriseEl = document.getElementById('sunrise');
  const sunsetEl = document.getElementById('sunset');
  
  try {
    const response = await fetch(`https://api.sunrisesunset.io/json?lat=${currentCoords?.lat || 0}&lng=${currentCoords?.lng || 0}&date=${date.toISOString().split('T')[0]}`);
    
    if (response.ok) {
      const data = await response.json();
      
      if (data.results && data.results.sunrise && data.results.sunset) {
        const sunrise = new Date(data.results.sunrise);
        const sunset = new Date(data.results.sunset);
        
        sunriseEl.textContent = sunrise.toLocaleTimeString('es', { hour: '2-digit', minute: '2-digit' });
        sunsetEl.textContent = sunset.toLocaleTimeString('es', { hour: '2-digit', minute: '2-digit' });
      }
    }
  } catch (error) {
    console.warn('Solar data error:', error);
    const now = new Date();
    const sunrise = new Date(now);
    sunrise.setHours(6, 30, 0);
    const sunset = new Date(now);
    sunset.setHours(18, 30, 0);
    
    sunriseEl.textContent = sunrise.toLocaleTimeString('es', { hour: '2-digit', minute: '2-digit' });
    sunsetEl.textContent = sunset.toLocaleTimeString('es', { hour: '2-digit', minute: '2-digit' });
  }
}

function calculateMoonPhase(date) {
  const synodic = 29.53058867;
  const knownNewMoon = new Date('2023-01-21T20:53:00Z');
  const daysSinceNewMoon = (date - knownNewMoon) / (1000 * 60 * 60 * 24);
  const newMoons = daysSinceNewMoon / synodic;
  const phase = newMoons - Math.floor(newMoons);
  
  const phases = [
    { name: 'Luna Nueva', icon: '🌑', illumination: 0 },
    { name: 'Cuarto Creciente', icon: '🌒', illumination: 25 },
    { name: 'Cuarto Creciente', icon: '🌓', illumination: 50 },
    { name: 'Luna Llena', icon: '🌕', illumination: 100 },
    { name: 'Cuarto Menguante', icon: '🌖', illumination: 75 },
    { name: 'Cuarto Menguante', icon: '🌗', illumination: 50 },
    { name: 'Luna Vieja', icon: '🌘', illumination: 25 }
  ];
  
  const phaseIndex = Math.floor(phase * 8) % 8;
  return phases[phaseIndex];
}

function updateMoonInfo(date) {
  const moonNameEl = document.getElementById('moon-name');
  const moonIlluminationEl = document.getElementById('moon-illumination');
  const moonContainer = document.getElementById('moon-phase');
  
  const moon = calculateMoonPhase(date);
  const moonIconEl = moonContainer.querySelector('.moon-icon');
  
  moonNameEl.textContent = moon.name;
  moonIlluminationEl.textContent = `${moon.illumination}% iluminación`;
  moonIconEl.textContent = moon.icon;
}

function generateActivities(forecast) {
  const container = document.getElementById('activities-grid');
  const today = forecast[0];
  
  if (!today) return;
  
  const temp = (today.temperatureMax + today.temperatureMin) / 2;
  const weatherDesc = today.description?.toLowerCase() || '';
  const weatherCode = today.weatherCode || 0;
  
  const activities = [];
  
  if (weatherDesc.includes('lluvia') || weatherDesc.includes('rain') || weatherDesc.includes('shower')) {
    activities.push({
      icon: '☔',
      name: 'Mantenerse bajo techo',
      recommendation: 'Lleva paraguas y ropa impermeable',
      confidence: 85,
      level: 'high'
    });
    activities.push({
      icon: '📱',
      name: 'Actividades interiores',
      recommendation: 'Es buen momento para lectura, películas o proyectos en casa',
      confidence: 90,
      level: 'high'
    });
  }
  
  if (temp > 30) {
    activities.push({
      icon: '🏊',
      name: 'Ir a la playa o piscina',
      recommendation: 'Temperatura ideal para refrescarse en el agua',
      confidence: 95,
      level: 'high'
    });
    activities.push({
      icon: '🧴',
      name: 'Hidratarse frecuentemente',
      recommendation: 'Bebe mucha agua y evita el sol directo',
      confidence: 90,
      level: 'high'
    });
  }
  
  if (weatherDesc.includes('soleado') || weatherDesc.includes('despejado')) {
    activities.push({
      icon: '🏃',
      name: 'Correr al aire libre',
      recommendation: 'Condiciones perfectas para ejercicio al exterior',
      confidence: 90,
      level: 'high'
    });
    activities.push({
      icon: '🧘',
      name: 'Usar protector solar',
      recommendation: 'Aplica SPF 50+ cada 2 horas',
      confidence: 95,
      level: 'high'
    });
  }
  
  if (weatherDesc.includes('nublado') || weatherDesc.includes('cloudy')) {
    activities.push({
      icon: '🚶',
      name: 'Caminar por la ciudad',
      recommendation: 'Temperatura agradable, ideal para paseos',
      confidence: 80,
      level: 'medium'
    });
    activities.push({
      icon: '📸',
      name: 'Fotografía urbana',
      recommendation: 'Luz difusa perfecta para retratos',
      confidence: 75,
      level: 'medium'
    });
  }
  
  if (weatherDesc.includes('nieve') || weatherDesc.includes('snow')) {
    activities.push({
      icon: '⛷️',
      name: 'Esquiar o snowboard',
      recommendation: 'Condiciones perfectas para deportes de nieve',
      confidence: 90,
      level: 'high'
    });
    activities.push({
      icon: '⛄',
      name: 'Construir muñeco de nieve',
      recommendation: 'Actividad divertida para disfrutar con la familia',
      confidence: 85,
      level: 'medium'
    });
  }
  
  if (weatherDesc.includes('tormenta') || weatherDesc.includes('thunder') || weatherDesc.includes('storm')) {
    activities.push({
      icon: '🏠',
      name: 'Quedarse en casa',
      recommendation: 'Es lo más seguro durante tormentas eléctricas',
      confidence: 95,
      level: 'high'
    });
    activities.push({
      icon: '📺',
      name: 'Ver series o películas',
      recommendation: 'Buen momento para maratones de tu programa favorito',
      confidence: 90,
      level: 'high'
    });
  }
  
  const moderateActivities = [
    { icon: '📖', name: 'Leer un libro', recommendation: 'Momento ideal para disfrutar de una buena lectura', confidence: 70, level: 'medium' },
    { icon: '🎮', name: 'Videojuegos', recommendation: 'Pasa tiempo jugando tus juegos favoritos', confidence: 65, level: 'medium' },
    { icon: '🍳', name: 'Actividades al aire libre', recommendation: 'Disfruta del aire libre si las condiciones lo permiten', confidence: 60, level: 'low' },
    { icon: '🎧', name: 'Escuchar música', recommendation: 'Crea tu playlist del momento según el clima', confidence: 65, level: 'low' },
    { icon: '🍳', name: 'Picnic al aire libre', recommendation: 'Disfruta de un almuerzo o cena al aire libre', confidence: 70, level: 'medium' }
  ];
  
  if (activities.length < 4) {
    activities.push(...moderateActivities.slice(0, 4 - activities.length));
  }
  
  container.innerHTML = activities.slice(0, 6).map(act => `
    <div class="activity-card ${act.level === 'high' ? 'recommended' : ''}">
      <div class="activity-header">
        <span class="activity-icon">${act.icon}</span>
        <span class="activity-name">${act.name}</span>
      </div>
      <div class="activity-recommendation">${act.recommendation}</div>
      <div class="activity-confidence ${act.level}">
        ${act.confidence}% recomendado
      </div>
    </div>
  `).join('');
}

function setForecastDateConstraints() {
  const datePicker = document.getElementById('forecast-date');
  const today = new Date();
  const maxDate = new Date();
  maxDate.setDate(today.getDate() + 7);
  
  datePicker.min = today.toISOString().split('T')[0];
  datePicker.max = maxDate.toISOString().split('T')[0];
  datePicker.value = today.toISOString().split('T')[0];
}

document.addEventListener('DOMContentLoaded', () => {
  setForecastDateConstraints();
  
  const datePicker = document.getElementById('forecast-date');
  datePicker.addEventListener('change', (e) => {
    const selectedDate = new Date(e.target.value);
    loadDailyForecastForDate(currentLocation, selectedDate);
    updateSolarInfo(selectedDate);
    updateMoonInfo(selectedDate);
  });
});

async function loadDailyForecastForDate(location, date) {
  try {
    const response = await fetch(`/api/forecast-7days?location=${encodeURIComponent(location)}`);
    const data = await response.json();
    
    if (data.success) {
      displayDailyForecast(data.forecast);
      updateWeatherDetails(data.forecast);
      generateActivities(data.forecast);
    }
  } catch (error) {
    console.warn('Error loading forecast for date:', error);
  }
}

async function loadSatelliteImage(location) {
  const visualContainer = document.getElementById('weather-visual');
  const visualLabel = document.getElementById('weather-visual-label');
  
  try {
    visualLabel.textContent = 'Cargando...';
    
    const response = await fetch(`/api/weather?location=${encodeURIComponent(location)}`);
    
    if (!response.ok) throw new Error('No se pudo obtener clima');
    
    const data = await response.json();
    
    if (data.success && data.report) {
      const description = extractWeatherDescription(data.report);
      updateWeatherVisual(description);
      visualLabel.textContent = description;
    }
  } catch (error) {
    console.warn('Visual del clima:', error.message);
    updateWeatherVisual('parcialmente nublado');
    visualLabel.textContent = 'Clima estimado';
  }
}

function updateWeatherVisual(description) {
  const visual = document.getElementById('weather-visual');
  const desc = description.toLowerCase();
  
  visual.className = 'weather-visual';
  
  const isDarkMode = document.body.classList.contains('dark-mode');
  const hour = new Date().getHours();
  const isNight = hour < 6 || hour >= 20;
  
  if (isNight && !isDarkMode) {
    document.body.classList.add('night');
  }
  
  if (desc.includes('lluvia') || desc.includes('rain') || desc.includes('llovizna') || desc.includes('shower')) {
    visual.classList.add('rainy');
  } else if (desc.includes('tormenta') || desc.includes('thunder') || desc.includes('storm')) {
    visual.classList.add('stormy');
  } else if (desc.includes('nieve') || desc.includes('snow')) {
    visual.classList.add('snowy');
  } else if (desc.includes('nublado') || desc.includes('cloudy') || desc.includes('overcast')) {
    visual.classList.add('cloudy');
  } else {
    visual.classList.add('sunny');
  }
  
  const rainContainer = document.getElementById('rain-container');
  const lightningContainer = document.getElementById('lightning-container');
  const snowContainer = document.getElementById('snow-container');
  
  rainContainer.innerHTML = '';
  lightningContainer.innerHTML = '';
  snowContainer.innerHTML = '';
  
  if (visual.classList.contains('rainy') || visual.classList.contains('stormy')) {
    generateRain();
  }
  
  if (visual.classList.contains('stormy')) {
    generateLightning();
  }
  
  if (visual.classList.contains('snowy')) {
    generateSnow();
  }
}

function generateRain() {
  const container = document.getElementById('rain-container');
  container.innerHTML = '';
  
  for (let i = 0; i < 50; i++) {
    const drop = document.createElement('div');
    drop.className = 'rain-drop';
    drop.style.left = Math.random() * 100 + '%';
    drop.style.animationDuration = (0.5 + Math.random() * 0.5) + 's';
    drop.style.animationDelay = Math.random() * 2 + 's';
    container.appendChild(drop);
  }
}

function generateLightning() {
  const container = document.getElementById('lightning-container');
  container.innerHTML = '';
  
  for (let i = 0; i < 3; i++) {
    const lightning = document.createElement('div');
    lightning.className = 'lightning';
    lightning.style.left = (20 + Math.random() * 60) + '%';
    lightning.style.animationDelay = (Math.random() * 5) + 's';
    container.appendChild(lightning);
  }
}

function generateSnow() {
  const container = document.getElementById('snow-container');
  container.innerHTML = '';
  
  for (let i = 0; i < 40; i++) {
    const flake = document.createElement('div');
    flake.className = 'snowflake';
    flake.style.left = Math.random() * 100 + '%';
    flake.style.animationDuration = (3 + Math.random() * 4) + 's';
    flake.style.animationDelay = Math.random() * 3 + 's';
    flake.style.width = (4 + Math.random() * 6) + 'px';
    flake.style.height = flake.style.width;
    container.appendChild(flake);
  }
}

function getWeatherAnimation(condition) {
  const c = condition.toLowerCase();
  if (c.includes('lluvia') || c.includes('rain') || c.includes('shower')) return 'rainy';
  if (c.includes('tormenta') || c.includes('thunder') || c.includes('storm')) return 'thunder';
  if (c.includes('nieve') || c.includes('snow')) return 'snowy';
  if (c.includes('despejado') || c.includes('soleado') || c.includes('clear') || c.includes('sunny')) return 'sunny';
  if (c.includes('nublado') || c.includes('cloudy') || c.includes('nublado')) return 'cloudy';
  return 'partly-cloudy';
}

async function loadWeatherNews(location) {
  const newsContainer = document.getElementById('news-container');
  
  try {
    newsContainer.innerHTML = '<p class="loading-text">🔍 Buscando noticias...</p>';
    
    const keywords = ['tormenta', 'lluvia', 'inundación', 'huracán', 'clima extremo', 'temporal'];
    const randomKeyword = keywords[Math.floor(Math.random() * keywords.length)];
    const query = `${location} ${randomKeyword}`;
    
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);
    
    const response = await fetch(`https://api.rss2json.com/v1/api.json?rss_url=${encodeURIComponent(`https://news.google.com/rss/search?q=${query}&hl=es&gl=ES&ceid=ES:es`)}`, {
      signal: controller.signal
    });
    
    clearTimeout(timeout);
    
    if (!response.ok) throw new Error('No se pudo obtener noticias');
    
    const data = await response.json();
    
    if (!data.items || data.items.length === 0) {
      throw new Error('No se encontraron noticias');
    }
    
    const news = data.items.slice(0, 4).map(item => ({
      title: item.title?.replace(/<[^>]*>/g, '') || '',
      link: item.link || '#',
      date: item.pubDate ? new Date(item.pubDate).toLocaleDateString('es', { day: 'numeric', month: 'short' }) : '',
      source: item.author || 'Noticias'
    }));
    
    const weatherEmojis = ['⛈️', '🌧️', '🌪️', '🌊'];
    
    newsContainer.innerHTML = news.map(item => `
      <a href="${item.link}" target="_blank" rel="noopener noreferrer" class="news-card">
        <div class="news-image" style="display: flex; align-items: center; justify-content: center; font-size: 40px;">
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
    if (error.name !== 'AbortError') {
      console.warn('Noticias no disponibles:', error.message);
    }
    newsContainer.innerHTML = `
      <div class="no-news">
        <p>📰 Las noticias temporales no están disponibles en este momento.</p>
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
    url = `https://embed.windy.com/embed2.html?lat=${lat}&lon=${lng}&zoom=8&type=map&windstream=true&overlay=wind&menu=&message=&marker=&calendar=&pressure=&type=map&location=coordinates&detail=&detailLat=${lat}&detailLon=${lng}&metricWind=km%2Fh&metricTemp=%C2%B0C&radarRange=-1`;
  } else if (type === 'precipitation') {
    url = `https://embed.windy.com/embed2.html?lat=${lat}&lon=${lng}&zoom=8&type=map&overlay=rain&menu=&message=&marker=&calendar=&pressure=&type=map&location=coordinates&detail=&detailLat=${lat}&detailLon=${lng}&metricWind=km%2Fh&metricTemp=%C2%B0C&radarRange=-1`;
  } else if (type === 'wind') {
    url = `https://embed.windy.com/embed2.html?lat=${lat}&lon=${lng}&zoom=8&type=map&overlay=wind&menu=&message=&marker=&calendar=&pressure=&type=map&location=coordinates&detail=&detailLat=${lat}&detailLon=${lng}&metricWind=km%2Fh&metricTemp=%C2%B0C&radarRange=-1`;
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
  const clouds = document.getElementById('clouds-value')?.textContent || '25%';
  const uv = document.getElementById('uv-value')?.textContent || 'Moderado';
  
  doc.setFillColor(66, 133, 244);
  doc.rect(0, 0, 210, 50, 'F');
  
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(24);
  doc.setFont('helvetica', 'bold');
  doc.text(' Zeus Meteo', 20, 32);
  
  doc.setFontSize(12);
  doc.setFont('helvetica', 'normal');
  doc.text('Reporte Meteorológico', 140, 32);
  
  doc.setTextColor(32, 33, 36);
  doc.setFontSize(22);
  doc.setFont('helvetica', 'bold');
  doc.text(`${city}`, 20, 70);
  
  doc.setFontSize(11);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(95, 99, 104);
  doc.text(`${now.toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })} • ${now.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })}`, 20, 80);
  
  doc.setFillColor(248, 249, 250);
  doc.roundedRect(20, 95, 170, 55, 3, 3, 'F');
  
  doc.setTextColor(32, 33, 36);
  doc.setFontSize(48);
  doc.setFont('helvetica', '300');
  doc.text(`${temp}°C`, 35, 135);
  
  doc.setFontSize(16);
  doc.setFont('helvetica', 'normal');
  doc.text(desc, 35, 148);
  
  const stats = [
    { label: 'Humedad', value: humidity },
    { label: 'Viento', value: wind },
    { label: 'Sensacion termica', value: feelsLike },
    { label: 'Presion atmosferica', value: pressure }
  ];
  
  stats.forEach((stat, index) => {
    const x = 90 + (index * 42);
    doc.setFontSize(9);
    doc.setTextColor(95, 99, 104);
    doc.text(stat.label, x, 110);
    doc.setTextColor(32, 33, 36);
    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.text(stat.value, x, 122);
  });
  
  doc.setDrawColor(218, 220, 224);
  doc.line(20, 165, 190, 165);
  
  doc.setTextColor(32, 33, 36);
  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  doc.text('Condiciones adicionales:', 20, 180);
  
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(95, 99, 104);
  doc.text(`Nubosidad: ${clouds}`, 25, 190);
  doc.text(`Indice UV: ${uv}`, 25, 198);
  
  doc.setTextColor(32, 33, 36);
  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  doc.text('Fuentes de datos utilizadas:', 20, 220);
  
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(95, 99, 104);
  doc.text('• OpenMeteo (Suiza) - API meteorologica global', 25, 230);
  doc.text('• US National Weather Service (EE.UU.) - Datos oficiales', 25, 238);
  doc.text('• Met Norway (Noruega) - Pronosticos europeos', 25, 246);
  
  doc.setTextColor(32, 33, 36);
  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.text('Zeus Meteo - Inteligencia Artificial', 20, 265);
  
  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(128, 128, 128);
  doc.text('Reporte generado automaticamente', 20, 273);
  doc.text(`Coordenadas: ${currentCoords?.lat?.toFixed(4) || 'N/A'}, ${currentCoords?.lng?.toFixed(4) || 'N/A'}`, 20, 281);
  
  doc.setFillColor(66, 133, 244);
  doc.rect(0, 285, 210, 12, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(9);
  doc.text('Zeus Meteo © 2025 - Pronosticos con IA', 105, 293, { align: 'center' });
  
  doc.save(`ZeusMeteo_${city.replace(/\s+/g, '_')}_${now.toISOString().split('T')[0]}.pdf`);
}

document.getElementById('location-input').addEventListener('keypress', (e) => {
  if (e.key === 'Enter') {
    searchWeather();
  }
});

document.addEventListener('DOMContentLoaded', initTheme);

// PWA Install Prompt
let deferredPrompt = null;
let installBannerShown = false;

window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();
  deferredPrompt = e;
  console.log('PWA install prompt disponible');
  
  setTimeout(() => {
    if (deferredPrompt && !installBannerShown) {
      showInstallBanner();
    }
  }, 15000);
});

window.addEventListener('appinstalled', () => {
  deferredPrompt = null;
  installBannerShown = true;
  const banner = document.querySelector('.install-banner');
  if (banner) banner.remove();
  console.log('Zeus Meteo instalada correctamente');
});

function showInstallBanner() {
  if (installBannerShown || document.querySelector('.install-banner')) return;
  
  installBannerShown = true;
  
  const banner = document.createElement('div');
  banner.className = 'install-banner';
  banner.innerHTML = `
    <div class="install-content">
      <span style="font-size: 28px;">⛅</span>
      <div class="install-text">
        <strong>Instala Zeus Meteo</strong>
        <p>Accede rapidamente desde tu pantalla</p>
      </div>
      <button class="install-btn" onclick="installPWA()">Instalar</button>
      <button class="dismiss-btn" onclick="dismissInstall()">✕</button>
    </div>
  `;
  
  document.body.appendChild(banner);
  
  setTimeout(() => {
    banner.style.opacity = '1';
  }, 100);
}

function installPWA() {
  if (deferredPrompt) {
    deferredPrompt.prompt();
    deferredPrompt.userChoice.then(choiceResult => {
      if (choiceResult.outcome === 'accepted') {
        console.log('Usuario acepto instalar');
      }
      deferredPrompt = null;
      installBannerShown = true;
    });
  } else {
    showIOSInstructions();
  }
}

function showIOSInstructions() {
  alert('Para instalar en iOS:\n\n1. Toca el botón Compartir 📤\n2. Selecciona "Agregar a pantalla de inicio" ➕');
}

function dismissInstall() {
  const banner = document.querySelector('.install-banner');
  if (banner) {
    banner.style.opacity = '0';
    setTimeout(() => banner.remove(), 300);
  }
  installBannerShown = true;
}

// Check if running as installed PWA
if (window.matchMedia('(display-mode: standalone)').matches) {
  installBannerShown = true;
  console.log('Zeus Meteo running as PWA');
}

// ==================== NEW FEATURES ====================

// Recent Searches (LocalStorage)
const RECENT_SEARCHES_KEY = 'zeus_recent_searches';
const MAX_RECENT_SEARCHES = 5;

function getRecentSearches() {
  try {
    return JSON.parse(localStorage.getItem(RECENT_SEARCHES_KEY)) || [];
  } catch {
    return [];
  }
}

function saveRecentSearch(city) {
  let searches = getRecentSearches();
  searches = searches.filter(s => s.toLowerCase() !== city.toLowerCase());
  searches.unshift(city);
  if (searches.length > MAX_RECENT_SEARCHES) {
    searches = searches.slice(0, MAX_RECENT_SEARCHES);
  }
  localStorage.setItem(RECENT_SEARCHES_KEY, JSON.stringify(searches));
  displayRecentSearches();
}

function displayRecentSearches() {
  const container = document.getElementById('recent-searches');
  if (!container) return;
  
  const searches = getRecentSearches();
  if (searches.length === 0) {
    container.innerHTML = '';
    return;
  }
  
  container.innerHTML = searches.map(city => `
    <div class="recent-search-item" onclick="quickSearch('${city}')">
      <span>📍</span>
      <span>${city}</span>
      <span class="remove" onclick="event.stopPropagation(); removeRecentSearch('${city}')">✕</span>
    </div>
  `).join('');
}

function removeRecentSearch(city) {
  let searches = getRecentSearches();
  searches = searches.filter(s => s.toLowerCase() !== city.toLowerCase());
  localStorage.setItem(RECENT_SEARCHES_KEY, JSON.stringify(searches));
  displayRecentSearches();
}

// GPS Location
async function getCurrentLocation() {
  const gpsBtn = document.querySelector('.gps-btn');
  if (gpsBtn) gpsBtn.classList.add('active');
  
  if (!navigator.geolocation) {
    alert('Tu navegador no soporta geolocalización');
    if (gpsBtn) gpsBtn.classList.remove('active');
    return;
  }
  
  try {
    const position = await new Promise((resolve, reject) => {
      navigator.geolocation.getCurrentPosition(resolve, reject, {
        enableHighAccuracy: true,
        timeout: 10000
      });
    });
    
    const { latitude, longitude } = position.coords;
    const response = await fetch(`/api/coordinates?lat=${latitude}&lon=${longitude}`);
    const data = await response.json();
    
    if (data.success) {
      document.getElementById('location-input').value = data.location || 'Tu ubicación';
      searchWeather();
    }
  } catch (error) {
    console.error('GPS Error:', error);
    alert('No se pudo obtener tu ubicación. Asegúrate de haber dado permiso.');
  } finally {
    if (gpsBtn) gpsBtn.classList.remove('active');
  }
}

// Location Autocomplete
const CITIES = [
  { name: 'Montevideo', country: 'Uruguay', flag: '🇺🇾' },
  { name: 'Buenos Aires', country: 'Argentina', flag: '🇦🇷' },
  { name: 'Madrid', country: 'España', flag: '🇪🇸' },
  { name: 'Barcelona', country: 'España', flag: '🇪🇸' },
  { name: 'Ciudad de México', country: 'México', flag: '🇲🇽' },
  { name: 'Lima', country: 'Perú', flag: '🇵🇪' },
  { name: 'Santiago', country: 'Chile', flag: '🇨🇱' },
  { name: 'Bogotá', country: 'Colombia', flag: '🇨🇴' },
  { name: 'Caracas', country: 'Venezuela', flag: '🇻🇪' },
  { name: 'Asunción', country: 'Paraguay', flag: '🇵🇾' },
  { name: 'La Paz', country: 'Bolivia', flag: '🇧🇴' },
  { name: 'Quito', country: 'Ecuador', flag: '🇪🇨' },
  { name: 'Panama', country: 'Panamá', flag: '🇵🇦' },
  { name: 'San José', country: 'Costa Rica', flag: '🇨🇷' },
  { name: 'San Salvador', country: 'El Salvador', flag: '🇸🇻' },
  { name: 'Tegucigalpa', country: 'Honduras', flag: '🇭🇳' },
  { name: 'Managua', country: 'Nicaragua', flag: '🇳🇮' },
  { name: 'Belmopan', country: 'Belice', flag: '🇧🇿' },
  { name: 'Guatemala City', country: 'Guatemala', flag: '🇬🇹' },
  { name: 'Havana', country: 'Cuba', flag: '🇨🇺' },
  { name: 'Santo Domingo', country: 'República Dominicana', flag: '🇩🇴' },
  { name: 'San Juan', country: 'Puerto Rico', flag: '🇵🇷' },
  { name: 'New York', country: 'Estados Unidos', flag: '🇺🇸' },
  { name: 'Los Angeles', country: 'Estados Unidos', flag: '🇺🇸' },
  { name: 'Miami', country: 'Estados Unidos', flag: '🇺🇸' },
  { name: 'Chicago', country: 'Estados Unidos', flag: '🇺🇸' },
  { name: 'Toronto', country: 'Canadá', flag: '🇨🇦' },
  { name: 'Vancouver', country: 'Canadá', flag: '🇨🇦' },
  { name: 'Londres', country: 'Reino Unido', flag: '🇬🇧' },
  { name: 'París', country: 'Francia', flag: '🇫🇷' },
  { name: 'Berlín', country: 'Alemania', flag: '🇩🇪' },
  { name: 'Roma', country: 'Italia', flag: '🇮🇹' },
  { name: 'Lisboa', country: 'Portugal', flag: '🇵🇹' },
  { name: 'Amsterdam', country: 'Países Bajos', flag: '🇳🇱' },
  { name: 'Bruselas', country: 'Bélgica', flag: '🇧🇪' },
  { name: 'Viena', country: 'Austria', flag: '🇦🇹' },
  { name: 'Zúrich', country: 'Suiza', flag: '🇨🇭' },
  { name: 'Estocolmo', country: 'Suecia', flag: '🇸🇪' },
  { name: 'Oslo', country: 'Noruega', flag: '🇳🇴' },
  { name: 'Copenhague', country: 'Dinamarca', flag: '🇩🇰' },
  { name: 'Helsinki', country: 'Finlandia', flag: '🇫🇮' },
  { name: 'Varsovia', country: 'Polonia', flag: '🇵🇱' },
  { name: 'Moscú', country: 'Rusia', flag: '🇷🇺' },
  { name: 'Estambul', country: 'Turquía', flag: '🇹🇷' },
  { name: 'Dubai', country: 'Emiratos Árabes', flag: '🇦🇪' },
  { name: 'Tokio', country: 'Japón', flag: '🇯🇵' },
  { name: 'Seúl', country: 'Corea del Sur', flag: '🇰🇷' },
  { name: 'Pekín', country: 'China', flag: '🇨🇳' },
  { name: 'Shanghái', country: 'China', flag: '🇨🇳' },
  { name: 'Hong Kong', country: 'China', flag: '🇭🇰' },
  { name: 'Singapur', country: 'Singapur', flag: '🇸🇬' },
  { name: 'Sídney', country: 'Australia', flag: '🇦🇺' },
  { name: 'Melbourne', country: 'Australia', flag: '🇦🇺' },
  { name: 'Auckland', country: 'Nueva Zelanda', flag: '🇳🇿' },
  { name: 'São Paulo', country: 'Brasil', flag: '🇧🇷' },
  { name: 'Río de Janeiro', country: 'Brasil', flag: '🇧🇷' },
  { name: 'Recife', country: 'Brasil', flag: '🇧🇷' },
  { name: 'Buenos Aires', country: 'Argentina', flag: '🇦🇷' }
];

function setupAutocomplete() {
  const input = document.getElementById('location-input');
  const container = document.getElementById('autocomplete-container');
  
  if (!input || !container) return;
  
  input.addEventListener('input', (e) => {
    const value = e.target.value.trim().toLowerCase();
    
    if (value.length < 2) {
      container.classList.remove('active');
      return;
    }
    
    const matches = CITIES.filter(city => 
      city.name.toLowerCase().includes(value) ||
      city.country.toLowerCase().includes(value)
    ).slice(0, 6);
    
    if (matches.length === 0) {
      container.classList.remove('active');
      return;
    }
    
    container.innerHTML = matches.map(city => `
      <div class="autocomplete-item" onclick="selectCity('${city.name}')">
        <span class="flag">${city.flag}</span>
        <div>
          <div class="city">${city.name}</div>
          <div class="country">${city.country}</div>
        </div>
      </div>
    `).join('');
    
    container.classList.add('active');
  });
  
  input.addEventListener('blur', () => {
    setTimeout(() => container.classList.remove('active'), 200);
  });
  
  input.addEventListener('focus', () => {
    if (input.value.trim().length >= 2) {
      input.dispatchEvent(new Event('input'));
    }
  });
}

function selectCity(cityName) {
  document.getElementById('location-input').value = cityName;
  document.getElementById('autocomplete-container').classList.remove('active');
  searchWeather();
}

// Dynamic Weather Background
function setWeatherBackground(condition) {
  const body = document.body;
  body.classList.remove('weather-sunny', 'weather-cloudy', 'weather-rainy', 'weather-stormy', 'weather-night');
  
  const c = condition.toLowerCase();
  const hour = new Date().getHours();
  const isNight = hour < 6 || hour > 20;
  
  if (isNight) {
    body.classList.add('weather-night');
  } else if (c.includes('lluvia') || c.includes('rain') || c.includes('shower')) {
    body.classList.add('weather-rainy');
  } else if (c.includes('tormenta') || c.includes('thunder') || c.includes('storm')) {
    body.classList.add('weather-stormy');
  } else if (c.includes('nublado') || c.includes('cloudy') || c.includes('overcast')) {
    body.classList.add('weather-cloudy');
  } else if (c.includes('despejado') || c.includes('soleado') || c.includes('clear') || c.includes('sunny')) {
    body.classList.add('weather-sunny');
  }
}

// Temperature Chart with ApexCharts
let tempChart = null;

function renderTempChart(forecast) {
  const container = document.getElementById('temp-chart-container');
  if (!container) return;
  
  if (!forecast || forecast.length === 0) {
    container.style.display = 'none';
    return;
  }
  
  container.style.display = 'block';
  
  const labels = forecast.slice(0, 24).map((day, i) => {
    const date = new Date(day.date);
    return i === 0 ? 'Hoy' : date.toLocaleDateString('es', { weekday: 'short', day: 'numeric' });
  });
  
  const tempsMax = forecast.slice(0, 24).map(day => day.temperatureMax);
  const tempsMin = forecast.slice(0, 24).map(day => day.temperatureMin);
  
  if (tempChart) {
    tempChart.destroy();
  }
  
  const options = {
    series: [
      { name: 'Máxima', data: tempsMax },
      { name: 'Mínima', data: tempsMin }
    ],
    chart: {
      type: 'area',
      height: 200,
      toolbar: { show: false },
      animations: {
        enabled: true,
        easing: 'easeinout',
        speed: 800
      },
      fontFamily: 'Inter, sans-serif'
    },
    colors: ['#4285f4', '#fbbc04'],
    stroke: { curve: 'smooth', width: 3 },
    fill: {
      type: 'gradient',
      gradient: {
        shadeIntensity: 1,
        opacityFrom: 0.4,
        opacityTo: 0.1,
        stops: [0, 90, 100]
      }
    },
    dataLabels: { enabled: false },
    xaxis: {
      categories: labels,
      labels: {
        style: { colors: '#5f6368', fontSize: '11px' }
      },
      axisBorder: { show: false },
      axisTicks: { show: false }
    },
    yaxis: {
      labels: {
        style: { colors: '#5f6368', fontSize: '11px' },
        formatter: (val) => `${val.toFixed(0)}°`
      }
    },
    grid: {
      borderColor: '#f1f3f4',
      strokeDashArray: 4
    },
    legend: {
      position: 'top',
      horizontalAlign: 'right',
      markers: { radius: 12 },
      itemMargin: { horizontal: 12 }
    },
    tooltip: {
      y: { formatter: (val) => `${val.toFixed(1)}°C` }
    }
  };
  
  tempChart = new ApexCharts(document.querySelector('#tempChart'), options);
  tempChart.render();
}

// AI Insight
function generateAIInsight(report, condition) {
  const insights = [
    { condition: 'lluvia', text: '💡 La IA sugiere llevar paraguas y ropa impermeable. La humedad alta puede hacer que la sensación térmica sea más fría.' },
    { condition: 'tormenta', text: '⚠️ Alerta de IA: Se esperan tormentas. Mantente en interiores y evita zonas abiertas.' },
    { condition: 'nieve', text: '❄️ La IA recomienda usar ropa térmica muy abrigada. Las carreteras pueden estar resbaladizas.' },
    { condition: 'despejado', text: '☀️ ¡Día perfecto! La IA recomienda aprovechar para actividades al aire libre. No olvides protector solar.' },
    { condition: 'soleado', text: '🌞 Alto índice UV esperado. La IA sugiere usar gafas de sol y protector solar SPF 30+.' },
    { condition: 'viento', text: '💨 Mucho viento hoy. La IA recomienda asegurar objetos ligeros y usar ropa que no vole fácilmente.' },
    { condition: 'nublado', text: '☁️ Día nublado. La IA dice que no lloverá, pero ten un jacket a mano por si baja la temperatura.' },
    { condition: 'humedad', text: '💧 Alta humedad detectada. La IA sugiere evitar ejercicio intenso al aire libre y mantenerse hidratado.' }
  ];
  
  const c = condition.toLowerCase();
  const match = insights.find(i => c.includes(i.condition));
  
  if (match) {
    return `<div class="ai-insight">
      <div class="ai-insight-header">
        <span class="icon">🤖</span>
        <span class="title">Insight de IA</span>
      </div>
      <p>${match.text}</p>
    </div>`;
  }
  
  return '';
}

// Initialize new features
document.addEventListener('DOMContentLoaded', () => {
  displayRecentSearches();
  setupAutocomplete();
  
  const searchBox = document.querySelector('.search-box');
  if (searchBox) {
    searchBox.insertAdjacentHTML('afterend', '<div id="autocomplete-container" class="location-autocomplete"></div>');
  }
  
  const gpsBtn = document.querySelector('.gps-btn');
  if (gpsBtn) {
    gpsBtn.addEventListener('click', getCurrentLocation);
  }
});

// ==================== CHATBOT OLLAMA ====================

let chatHistory = [];

const WEATHER_CONTEXT = `
Eres Zeus AI, un asistente meteorológico inteligente.
Contexto sobre Zeus Meteo:
- App de clima con IA que usa 3 APIs gratuitas: OpenMeteo, US NWS y MetNorway
- Características: pronósticos por hora/día, imagen satelital, mapas interactivos, reportes PDF
- Diseño moderno con glassmorphism y animaciones
- PWA instalable en móvil
- Totalmente gratis y sin registro

Instrucciones:
1. Responde de forma concisa y amigable
2. Usa emojis relevantes para hacer las respuestas más visuales
3. Si te preguntan sobre el clima, sugiere buscar una ciudad
4. Puedes compartir curiosidades meteorológicas interesantes
5. Mantén las respuestas relativamente cortas (máximo 2-3 oraciones)
6. Si no sabes algo, sé honesto y sugiere consultar fuentes oficiales
`;

async function toggleChatbot() {
  const container = document.getElementById('chatbot-container');
  const fab = document.getElementById('chatbot-fab');
  container.classList.toggle('active');
  fab.style.display = container.classList.contains('active') ? 'none' : 'flex';
  
  if (container.classList.contains('active')) {
    setTimeout(() => {
      document.getElementById('chatbot-input').focus();
    }, 300);
  }
}

function handleChatKeyPress(event) {
  if (event.key === 'Enter' && !event.shiftKey) {
    event.preventDefault();
    sendChatMessage();
  }
}

function sendChatMessage() {
  const input = document.getElementById('chatbot-input');
  const message = input.value.trim();
  
  if (!message) return;
  
  addChatMessage('user', message);
  input.value = '';
  
  addThinkingIndicator();
  
  getAIResponse(message).then(response => {
    removeThinkingIndicator();
    addChatMessage('assistant', response);
  }).catch(error => {
    removeThinkingIndicator();
    addChatMessage('assistant', '😕 Lo siento, hubo un error. ¿Podrías intentar de nuevo?');
    console.error('Chat error:', error);
  });
}

function addChatMessage(role, content) {
  const container = document.getElementById('chatbot-messages');
  const messageDiv = document.createElement('div');
  messageDiv.className = `chatbot-message ${role}`;
  messageDiv.textContent = content;
  container.appendChild(messageDiv);
  
  container.scrollTop = container.scrollHeight;
  
  chatHistory.push({ role, content });
  
  if (chatHistory.length > 20) {
    chatHistory = chatHistory.slice(-20);
  }
}

function addThinkingIndicator() {
  const container = document.getElementById('chatbot-messages');
  const indicator = document.createElement('div');
  indicator.className = 'chatbot-message thinking';
  indicator.id = 'thinking-indicator';
  indicator.innerHTML = `
    <div class="typing-indicator">
      <span></span>
      <span></span>
      <span></span>
    </div>
  `;
  container.appendChild(indicator);
  container.scrollTop = container.scrollHeight;
}

function removeThinkingIndicator() {
  const indicator = document.getElementById('thinking-indicator');
  if (indicator) {
    indicator.remove();
  }
}

// Configuración de APIs
const API_CONFIG = {
  groq: {
    endpoint: 'https://api.groq.com/openai/v1/chat/completions',
    model: 'llama-3.3-70b-versatile',
    apiKey: localStorage.getItem('zeus_groq_api_key') || ''
  },
  ollama: {
    endpoint: 'http://localhost:11434/api/generate',
    model: 'llama3.2'
  }
};

function updateChatbotStatus() {
  const statusEl = document.getElementById('chatbot-status-text');
  if (API_CONFIG.groq.apiKey) {
    statusEl.textContent = 'Groq IA';
    statusEl.style.color = '#00c853';
  } else {
    statusEl.textContent = 'IA Gratuita';
    statusEl.style.color = '#fff';
  }
}
document.addEventListener('DOMContentLoaded', updateChatbotStatus);

async function getAIResponse(userMessage) {
  const systemMessage = WEATHER_CONTEXT;
  
  const messages = [
    { role: 'system', content: systemMessage },
    ...chatHistory.slice(-10),
    { role: 'user', content: userMessage }
  ];
  
  // Intentar Groq primero (gratuito en la nube)
  if (API_CONFIG.groq.apiKey) {
    try {
      const response = await fetch(API_CONFIG.groq.endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${API_CONFIG.groq.apiKey}`
        },
        body: JSON.stringify({
          model: API_CONFIG.groq.model,
          messages: messages,
          temperature: 0.7,
          max_tokens: 300,
          stream: false
        })
      });
      
      if (response.ok) {
        const data = await response.json();
        return data.choices[0].message.content.trim();
      }
    } catch (error) {
      console.error('Groq error:', error);
    }
  }
  
  // Intentar Ollama local como fallback
  try {
    const prompt = messages.map(m => {
      if (m.role === 'system') return `[SYSTEM]: ${m.content}`;
      if (m.role === 'user') return `[USER]: ${m.content}`;
      return `[ASSISTANT]: ${m.content}`;
    }).join('\n');
    
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 8000);
    
    const response = await fetch(API_CONFIG.ollama.endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: API_CONFIG.ollama.model,
        prompt: prompt,
        stream: false,
        options: {
          temperature: 0.7,
          max_tokens: 300
        }
      }),
      signal: controller.signal
    });
    
    clearTimeout(timeoutId);
    
    if (response.ok) {
      const data = await response.json();
      return data.response.trim();
    }
  } catch (error) {
    console.log('Ollama no disponible, usando respuestas inteligentes');
  }
  
  // Respuestas inteligentes locales
  return getSmartResponse(userMessage);
}

function getSmartResponse(message) {
  const lowerMessage = message.toLowerCase();
  
  const smartResponses = {
    greeting: ['Hola 👋 ¿En qué puedo ayudarte con el clima?', '¡Hey! 🌤️ ¿Buscas información meteorológica?', '¡Buenas! ☀️ ¿Qué quieres saber del clima?'],
    weather_search: ['Para conocer el clima exacto, busca una ciudad arriba 🔍 ¿Te ayudo a buscar alguna?', '🌡️ Escribe el nombre de una ciudad y te doy el pronóstico completo', '🔍 Busca cualquier ciudad del mundo para ver su clima actual'],
    temperature: ['La temperatura depende de la ciudad y la época del año 🌡️ ¿Cuál te interesa?', '❄️🔥 Las temperaturas varían mucho según la ubicación. ¿Buscas alguna ciudad específica?'],
    rain: ['🌧️ Para saber si lloverá, necesito saber dónde estás. ¿Buscas el clima de alguna ciudad?', 'La probabilidad de lluvia se calcula según la humedad y presión atmosférica ☔'],
    sun: ['☀️ ¡Perfecto! El sol es genial. ¿En qué ciudad quieres ver el pronóstico?', 'El sol aparece cuando no hay nubes ☀️ ¿Te gustaría buscar una ciudad?'],
    wind: ['💨 El viento puede ser fuerte o suave. ¿En qué zona te interesa?', 'Los vientos se miden en km/h y dependen de la presión atmosférica 🌬️'],
    storm: ['⛈️ Las tormentas son fenómenos complejos. ¿Te interesa alguna ciudad específica?'],
    cold: ['❄️ Hace frío, ¿verdad? La sensación térmica puede ser diferente a la temperatura real 🧥'],
    hot: ['🔥 Hace calor hoy. No olvides hidratarte y usar protector solar 🧴'],
    humidity: ['💧 La humedad alta hace que la sensación térmica sea más extrema. ¿En qué ciudad consultas?'],
    forecast: ['📊 Los pronósticos están disponibles para 7 días. Busca una ciudad para verlos 🌤️'],
    curiosity: ['💡 Dato curioso: Los rayos pueden alcanzar temperaturas de 30,000°C ⚡', '¿Sabías que la presión atmosférica puede predecir cambios de clima? 📊', '🌍 La temperatura más alta registrada fue 56.7°C en California'],
    thanks: ['¡De nada! 😊 ¿Hay algo más en lo que pueda ayudarte?', '¡Con gusto! 🌤️ ¿Necesitas algo más?'],
    goodbye: ['¡Adiós! 👋 ¡Que tengas un excelente día!', '¡Chao! 🌙 ¡Vuelve cuando quieras!', '¡Hasta luego! ☀️ ¡Cuídate!'],
    help: ['🤖 Puedo responder preguntas sobre:\n• El clima actual\n• Pronósticos\n• Curiosidades meteorológicas\n• Consejos según el clima\n\nSolo busca una ciudad o pregúntame algo 😊'],
    how_are_you: ['¡Muy bien! 🌞 Estoy listo para ayudarte con el clima. ¿Qué quieres saber?', '¡Excelente! ☀️ ¿En qué puedo asistirte hoy?'],
    what_is: ['💡 Pregunta interesante. Los fenómenos meteorológicos son fascinantes. ¿Hay algo específico que quieras saber?'],
    why: ['🤔 Buena pregunta. El clima depende de muchos factores: temperatura, humedad, presión, viento...'],
    when: ['⏰ El tiempo meteorológico cambia constantemente. ¿Buscas el pronóstico para una fecha específica?'],
    where: ['📍 Las condiciones climáticas varían según la ubicación. ¿Qué ciudad te interesa?'],
    can_i: ['¡Claro! 😊 Pregúntame lo que quieras sobre el clima 🌤️'],
    should_i: ['💡 Basándome en las condiciones, te recomendaría... ¿En qué ciudad estás?']
  };
  
  const patterns = [
    { keys: ['hola', 'buenos días', 'buenas tardes', 'buenas noches', 'hey', 'qué tal', 'que tal'], type: 'greeting' },
    { keys: ['clima', 'tiempo', 'pronóstico', 'pronostico', 'como está', 'como esta'], type: 'weather_search' },
    { keys: ['temperatura', 'cuántos grados', 'cuantos grados', 'calor', 'frío', 'frio'], type: 'temperature' },
    { keys: ['llover', 'lluvia', 'lloverá', 'llovera', 'llovizna', 'aguanieve'], type: 'rain' },
    { keys: ['sol', 'soleado', 'despejado', 'claro'], type: 'sun' },
    { keys: ['viento', 'viento', 'ráfagas', 'rafagas'], type: 'wind' },
    { keys: ['tormenta', 'rayo', 'trueno', 'relámpago', 'rayos'], type: 'storm' },
    { keys: ['frío', 'frio', 'helado', 'congelado'], type: 'cold' },
    { keys: ['calor', 'caluroso', 'caliente'], type: 'hot' },
    { keys: ['humedad', 'húmedo', 'humedo'], type: 'humidity' },
    { keys: ['pronóstico', 'pronostico', '7 días', '7 dias', 'semana'], type: 'forecast' },
    { keys: ['sabías', 'sabias', 'curiosidad', 'dato', 'interesante'], type: 'curiosity' },
    { keys: ['gracias', 'thank', 'te agradezco'], type: 'thanks' },
    { keys: ['adiós', 'adios', 'chao', 'bye', 'nos vemos', 'hasta luego'], type: 'goodbye' },
    { keys: ['qué puedes', 'que puedes', 'qué haces', 'que haces', 'ayuda', 'help'], type: 'help' },
    { keys: ['cómo estás', 'como estas', 'qué tal estás', 'que tal estas', 'cómo te', 'como te'], type: 'how_are_you' },
    { keys: ['qué es', 'que es', 'qué es el', 'que es el', 'explica', 'explicar'], type: 'what_is' },
    { keys: ['por qué', 'porque', 'por que', 'el motivo', 'la razón', 'la razon'], type: 'why' },
    { keys: ['cuándo', 'cuando', 'a qué hora', 'a que hora'], type: 'when' },
    { keys: ['dónde', 'donde', 'en qué lugar', 'en que lugar'], type: 'where' },
    { keys: ['puedo', 'puedo hacer', 'puedo llevar', 'debería', 'deberia'], type: 'should_i' },
    { keys: ['puedo', 'puedo usar', 'se puede', 'es seguro'], type: 'can_i' }
  ];
  
  for (const pattern of patterns) {
    if (pattern.keys.some(key => lowerMessage.includes(key))) {
      const responses = smartResponses[pattern.type];
      return responses[Math.floor(Math.random() * responses.length)];
    }
  }
  
  const defaultResponses = [
    'Interesante pregunta 🤔 Para darte información precisa, busca una ciudad específica arriba 🔍',
    '¡Hmm! Pregunta interesante 💭 ¿Te ayudo a buscar el clima de alguna ciudad?',
    '😊 No estoy seguro de entender. ¿Buscas el pronóstico de alguna ciudad?',
    '¡Vale! 🌤️ ¿En qué ciudad te gustaría consultar el clima?'
  ];
  
  return defaultResponses[Math.floor(Math.random() * defaultResponses.length)];
}

// ==================== GROQ API CONFIG ====================

function showApiKeyConfig() {
  const container = document.getElementById('chatbot-messages');
  const configHtml = `
    <div class="chatbot-config">
      <div class="chatbot-config-header">
        <span>⚙️</span>
        <strong>Configurar Groq API (Opcional)</strong>
      </div>
      <p>Groq ofrece IA gratuita en la nube. Obtén tu API key gratis:</p>
      <ol>
        <li>Ve a <a href="https://console.groq.com" target="_blank">console.groq.com</a></li>
        <li>Crea una cuenta gratis</li>
        <li>Copia tu API Key</li>
        <li>Pégala aquí abajo</li>
      </ol>
      <div class="chatbot-input-container" style="margin-top: 12px;">
        <input type="password" id="groq-api-key" placeholder="Pega tu API key de Groq..." />
        <button class="chatbot-send" onclick="saveApiKey()">💾</button>
      </div>
      <p style="font-size: 11px; opacity: 0.7; margin-top: 8px;">Tu API key se guarda solo en tu navegador</p>
      <button onclick="testApiKey()" style="margin-top: 8px; padding: 8px 16px; border-radius: 8px; border: 1px solid var(--border-color); background: var(--bg-tertiary); cursor: pointer;">Probar API Key</button>
    </div>
  `;
  
  container.insertAdjacentHTML('beforeend', configHtml);
  container.scrollTop = container.scrollHeight;
}

function saveApiKey() {
  const input = document.getElementById('groq-api-key');
  const apiKey = input.value.trim();
  
  if (apiKey.length < 10) {
    alert('La API key parece muy corta. Verifícala por favor.');
    return;
  }
  
  localStorage.setItem('zeus_groq_api_key', apiKey);
  API_CONFIG.groq.apiKey = apiKey;
  
  const configDiv = document.querySelector('.chatbot-config');
  if (configDiv) {
    configDiv.innerHTML = `
      <div style="text-align: center; padding: 20px;">
        <span style="font-size: 48px;">✅</span>
        <p style="margin-top: 12px;"><strong>¡API Key guardada!</strong></p>
        <p style="font-size: 13px; opacity: 0.7;">Ahora el chatbot usará IA avanzada de Groq</p>
      </div>
    `;
  }
}

function testApiKey() {
  const input = document.getElementById('groq-api-key');
  const apiKey = input.value.trim();
  
  if (!apiKey) {
    alert('Primero ingresa una API key');
    return;
  }
  
  const btn = document.querySelector('button[onclick="testApiKey()"]');
  btn.textContent = '⏳ Probando...';
  btn.disabled = true;
  
  fetch('https://api.groq.com/openai/v1/models', {
    headers: { 'Authorization': `Bearer ${apiKey}` }
  })
  .then(response => {
    if (response.ok) {
      alert('✅ API Key válida. El chatbot ahora usará IA avanzada.');
      saveApiKey();
    } else {
      alert('❌ API Key inválida. Verifícala en console.groq.com');
    }
  })
  .catch(error => {
    alert('❌ Error al conectar. Verifica tu conexión o API key.');
  })
  .finally(() => {
    btn.textContent = 'Probar API Key';
    btn.disabled = false;
  });
}

// Añadir comando para configurar API key
function handleSpecialCommands(message) {
  const lower = message.toLowerCase().trim();
  
  if (lower === '/config' || lower === '/api' || lower === 'configurar api') {
    showApiKeyConfig();
    return true;
  }
  
  if (lower === '/clear' || lower === '/borrar') {
    chatHistory = [];
    const container = document.getElementById('chatbot-messages');
    container.innerHTML = `
      <div class="chatbot-welcome">
        <div class="chatbot-avatar">🤖</div>
        <p>¡Historial borrado! 💬 ¿En qué puedo ayudarte?</p>
      </div>
    `;
    return true;
  }
  
  if (lower === '/status' || lower === '/estado') {
    let status = '📊 Estado del Chatbot:\n\n';
    status += API_CONFIG.groq.apiKey ? '✅ Groq API: Configurada\n' : '⚪ Groq API: No configurada\n';
    status += '✅ Respuestas inteligentes: Activas\n';
    status += localStorage.getItem('zeus_groq_api_key') ? '✅ API Key: Guardada' : '⚪ API Key: No guardada';
    
    alert(status);
    return true;
  }
  
  return false;
}

// Modificar sendChatMessage para incluir comandos especiales
const originalSendChatMessage = sendChatMessage;
sendChatMessage = function() {
  const input = document.getElementById('chatbot-input');
  const message = input.value.trim();
  
  if (!message) return;
  
  if (message.startsWith('/') || message.toLowerCase().includes('/api') || message.toLowerCase().includes('configurar')) {
    if (handleSpecialCommands(message)) {
      input.value = '';
      return;
    }
  }
  
  originalSendChatMessage();
};

