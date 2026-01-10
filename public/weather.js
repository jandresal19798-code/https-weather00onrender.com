let currentLocation = null;
let currentCoords = null;

function initTheme() {
  const savedTheme = localStorage.getItem('theme');
  if (savedTheme === 'dark') {
    document.body.classList.add('dark-mode');
  }
  createParticles();
}

function toggleTheme() {
  document.body.classList.toggle('dark-mode');
  const isDark = document.body.classList.contains('dark-mode');
  localStorage.setItem('theme', isDark ? 'dark' : 'light');
  
  const particles = document.getElementById('particles');
  particles.innerHTML = '';
  createParticles();
}

function createParticles() {
  const container = document.getElementById('particles');
  const particleCount = 50;
  
  for (let i = 0; i < particleCount; i++) {
    const particle = document.createElement('div');
    particle.className = 'particle';
    particle.style.cssText = `
      position: absolute;
      width: ${Math.random() * 4 + 2}px;
      height: ${Math.random() * 4 + 2}px;
      background: ${Math.random() > 0.5 ? 'var(--primary)' : 'var(--secondary)'};
      border-radius: 50%;
      left: ${Math.random() * 100}%;
      top: ${Math.random() * 100}%;
      opacity: ${Math.random() * 0.5 + 0.1};
      animation: particleFloat ${Math.random() * 20 + 10}s linear infinite;
      animation-delay: ${Math.random() * 10}s;
    `;
    container.appendChild(particle);
  }
}

const style = document.createElement('style');
style.textContent = `
  @keyframes particleFloat {
    0%, 100% {
      transform: translate(0, 0) scale(1);
      opacity: var(--opacity);
    }
    25% {
      transform: translate(100px, -100px) scale(1.2);
    }
    50% {
      transform: translate(-50px, 50px) scale(0.8);
    }
    75% {
      transform: translate(-100px, -100px) scale(1.1);
    }
  }
`;
document.head.appendChild(style);

function showHome() {
  document.getElementById('home-page').classList.add('active');
  document.getElementById('forecasts-page').classList.remove('active');
  document.querySelectorAll('.nav-link').forEach(link => link.classList.remove('active'));
  document.querySelector('.nav-link:first-child').classList.add('active');
}

function showForecasts() {
  document.getElementById('home-page').classList.remove('active');
  document.getElementById('forecasts-page').classList.add('active');
  document.querySelectorAll('.nav-link').forEach(link => link.classList.remove('active'));
  document.querySelector('.nav-link:nth-child(2)').classList.add('active');
}

function quickSearch(city) {
  event.preventDefault();
  document.getElementById('location-input').value = city;
  searchWeather();
}

async function searchWeather() {
  const location = document.getElementById('location-input').value.trim();
  
  if (!location) {
    alert('Por favor, ingresa una ciudad o ubicación');
    return;
  }

  currentLocation = location;
  showForecasts();
  
  const loading = document.getElementById('loading');
  loading.style.display = 'flex';
  
  try {
    const response = await fetch(`http://localhost:3001/api/weather?location=${encodeURIComponent(location)}`);
    const data = await response.json();
    
    if (data.success) {
      updateCurrentWeather(data.report);
      await loadHourlyForecast(location);
      await loadDailyForecast(location);
      await loadMap(location);
    } else {
      alert(data.error);
      showHome();
    }
  } catch (error) {
    console.error('Error:', error);
    alert('Error de conexión. Por favor, verifica que el servidor esté funcionando.');
    showHome();
  } finally {
    loading.style.display = 'none';
  }
}

function updateCurrentWeather(report) {
  const container = document.getElementById('current-weather');
  container.style.display = 'block';
  container.style.animation = 'pageFadeIn 0.6s cubic-bezier(0.25, 0.46, 0.45, 0.94)';

  const lines = report.split('\n');
  
  lines.forEach(line => {
    if (line.includes('Ubicación:')) {
      const city = line.split(': ')[1];
      document.getElementById('city-name').textContent = city;
    } else if (line.includes('Fecha:')) {
      const dateStr = line.split(': ')[1];
      const date = new Date(dateStr);
      const options = { weekday: 'long', day: 'numeric', month: 'long' };
      document.getElementById('current-date').textContent = date.toLocaleDateString('es-UY', options);
    } else if (line.includes('Promedio:')) {
      const temp = line.split(': ')[1].replace('°C', '');
      document.getElementById('current-temp').textContent = parseFloat(temp).toFixed(0);
    } else if (line.includes('Velocidad promedio:')) {
      const wind = line.split(': ')[1].replace('m/s', '');
      document.getElementById('wind').textContent = `${(parseFloat(wind) * 3.6).toFixed(0)} km/h`;
    } else if (line.includes('HUMEDAD')) {
      const match = line.match(/Promedio:\s*([\d.]+)/);
      if (match) {
        document.getElementById('humidity').textContent = `${parseFloat(match[1]).toFixed(0)}%`;
      }
    }
  });

  const weatherDescription = extractWeatherDescription(report);
  document.getElementById('weather-description').textContent = weatherDescription;
  document.getElementById('weather-icon-animated').textContent = getWeatherIcon(weatherDescription);
  
  const feelsLike = extractFeelsLike(report);
  document.getElementById('feels-like').textContent = feelsLike;
  
  const pressure = extractPressure(report);
  document.getElementById('pressure').textContent = pressure;
}

function extractWeatherDescription(report) {
  const match = report.match(/Estado predominante:\s*(.+)/);
  return match ? match[1].trim() : 'Desconocido';
}

function extractFeelsLike(report) {
  const match = report.match(/Sensación térmica:\s*([\d.]+)/);
  return match ? `${parseFloat(match[1]).toFixed(0)}°` : '28°';
}

function extractPressure(report) {
  const match = report.match(/Presión:\s*([\d.]+)/);
  return match ? `${parseFloat(match[1]).toFixed(0)} hPa` : '1015 hPa';
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
    'tormenta': '⛈️'
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
    const response = await fetch(`http://localhost:3001/api/forecast-7days?location=${encodeURIComponent(location)}`);
    const data = await response.json();

    if (data.success) {
      displayHourlyForecast(data.forecast);
    }
  } catch (error) {
    console.error('Error al cargar pronóstico horario:', error);
  }
}

function displayHourlyForecast(forecast) {
  const container = document.getElementById('hourly-forecast');
  
  const todayData = forecast[0];
  const hours = [];
  
  const now = new Date();
  for (let i = 0; i < 24; i += 3) {
    const hour = now.getHours() + i;
    const displayHour = hour >= 24 ? hour - 24 : hour;
    hours.push({
      time: `${displayHour}:00`,
      temp: todayData.temperatureMax - (i * 0.3) + (Math.random() * 2 - 1),
      icon: getWeatherIcon(todayData.description),
      delay: i * 0.1
    });
  }

  container.innerHTML = hours.map(hour => `
    <div class="hourly-card" style="animation: pageFadeIn 0.6s cubic-bezier(0.25, 0.46, 0.45, 0.94) ${hour.delay}s both;">
      <div class="hourly-time">${hour.time}</div>
      <div class="hourly-icon">${hour.icon}</div>
      <div class="hourly-temp">${hour.temp.toFixed(0)}°</div>
    </div>
  `).join('');
}

async function loadDailyForecast(location) {
  try {
    const response = await fetch(`http://localhost:3001/api/forecast-7days?location=${encodeURIComponent(location)}`);
    const data = await response.json();

    if (data.success) {
      displayDailyForecast(data.forecast);
      updateWeatherDetails(data.forecast);
    }
  } catch (error) {
    console.error('Error al cargar pronóstico diario:', error);
  }
}

function displayDailyForecast(forecast) {
  const container = document.getElementById('daily-forecast');
  
  const days = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
  
  container.innerHTML = forecast.map((day, index) => {
    const date = new Date(day.date);
    const dayName = index === 0 ? 'Hoy' : days[date.getDay()];
    const icon = getWeatherIcon(day.description);
    
    return `
      <div class="daily-card" style="animation: pageFadeIn 0.6s cubic-bezier(0.25, 0.46, 0.45, 0.94) ${index * 0.1}s both;">
        <div class="daily-date">${dayName}</div>
        <div class="daily-icon">${icon}</div>
        <div class="daily-temps">
          <span>${day.temperatureMax.toFixed(0)}°</span>
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
  const visibility = 10 - (today.weatherCode / 20);
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

document.getElementById('location-input').addEventListener('keypress', (e) => {
  if (e.key === 'Enter') {
    searchWeather();
  }
});

document.addEventListener('DOMContentLoaded', initTheme);
