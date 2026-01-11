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
  document.getElementById('weather-icon').textContent = getWeatherIcon(weatherDescription);
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

async function loadSatelliteImage(location) {
  const satelliteContainer = document.getElementById('satellite-image');
  const satelliteTime = document.getElementById('satellite-time');
  
  satelliteContainer.innerHTML = '<div class="weather-animation">🛰️ Cargando...</div>';
  satelliteTime.innerHTML = '🛰️ Cargando...';
  
  try {
    const response = await fetch(`/api/coordinates?location=${encodeURIComponent(location)}`);
    const data = await response.json();

    if (data.success) {
      const { latitude, longitude } = data;
      const now = new Date();
      
      const weatherResponse = await fetch(`/api/weather?location=${encodeURIComponent(location)}`);
      const weatherData = await weatherResponse.json();
      
      let weatherCondition = 'parcialmente nublado';
      if (weatherData.report) {
        const match = weatherData.report.match(/Estado predominante:\s*(.+)/i);
        if (match) weatherCondition = match[1].trim().toLowerCase();
      }
      
      const emoji = getWeatherIcon(weatherCondition);
      const animationClass = getWeatherAnimation(weatherCondition);
      
      satelliteContainer.innerHTML = `
        <div class="weather-animation ${animationClass}">
          <div class="weather-scene">
            <div class="sun ${weatherCondition.includes('despejado') || weatherCondition.includes('soleado') ? 'visible' : ''}"></div>
            <div class="moon ${!animationClass.includes('sun') && weatherCondition.includes('despejado') ? 'visible' : ''}"></div>
            <div class="cloud cloud-1"></div>
            <div class="cloud cloud-2"></div>
            <div class="cloud cloud-3"></div>
            <div class="rain ${animationClass.includes('rain') ? 'visible' : ''}">
              <div class="drop drop-1"></div>
              <div class="drop drop-2"></div>
              <div class="drop drop-3"></div>
              <div class="drop drop-4"></div>
              <div class="drop drop-5"></div>
            </div>
            <div class="thunder ${animationClass.includes('thunder') ? 'visible' : ''}"></div>
            <div class="lightning ${animationClass.includes('thunder') ? 'flash' : ''}"></div>
            <div class="snow ${animationClass.includes('snow') ? 'visible' : ''}">
              <div class="flake flake-1">❄</div>
              <div class="flake flake-2">❄</div>
              <div class="flake flake-3">❄</div>
            </div>
            <div class="weather-emoji">${emoji}</div>
          </div>
          <div class="weather-info">
            <div class="weather-location">📍 ${data.location || location}</div>
            <div class="weather-condition">${weatherCondition}</div>
            <div class="weather-time">🕐 ${now.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })}</div>
          </div>
        </div>
      `;
      
      satelliteTime.innerHTML = `📍 ${data.location || location} • ${now.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })}`;
    }
  } catch (error) {
    console.error('Error:', error);
    satelliteContainer.innerHTML = `
      <div class="weather-error">
        <div class="weather-icon">🌤️</div>
        <p>Clima en ${location}</p>
        <p style="opacity: 0.7; font-size: 11px;">No se pudo cargar</p>
      </div>
    `;
    satelliteTime.innerHTML = '⚠️ Error';
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
  newsContainer.innerHTML = '<p class="loading-text">🔍 Buscando noticias...</p>';
  
  try {
    const keywords = ['tormenta', 'lluvia', 'inundación', 'huracán', 'clima extremo', 'temporal'];
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
      if (index < 4) {
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
          <p>📰 No se encontraron noticias para ${location}</p>
        </div>
      `;
      return;
    }
    
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
    console.error('Error al cargar noticias:', error);
    newsContainer.innerHTML = `
      <div class="no-news">
        <p>📰 No se pudieron cargar las noticias</p>
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
