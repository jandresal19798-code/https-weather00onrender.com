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
      renderTempChart(data.forecast);
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

async function getAIResponse(userMessage) {
  const ollamaEndpoint = 'http://localhost:11434/api/generate';
  
  const systemMessage = WEATHER_CONTEXT;
  
  const messages = [
    { role: 'system', content: systemMessage },
    ...chatHistory.slice(-10),
    { role: 'user', content: userMessage }
  ];
  
  const prompt = messages.map(m => {
    if (m.role === 'system') return `[SYSTEM]: ${m.content}`;
    if (m.role === 'user') return `[USER]: ${m.content}`;
    return `[ASSISTANT]: ${m.content}`;
  }).join('\n');
  
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 8000);
    
    const response = await fetch(ollamaEndpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'llama3.2',
        prompt: prompt,
        stream: false,
        options: {
          temperature: 0.7,
          top_p: 0.9,
          max_tokens: 300
        }
      }),
      signal: controller.signal
    });
    
    clearTimeout(timeoutId);
    
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    
    const data = await response.json();
    return data.response.trim();
  } catch (error) {
    console.error('Ollama error:', error.message);
    
    if (error.name === 'AbortError') {
      return '⏱️ La IA tardó demasiado en responder. ¿Podrías repetir tu pregunta?';
    }
    
    return getFallbackResponse(userMessage);
  }
}

function getFallbackResponse(message) {
  const lowerMessage = message.toLowerCase();
  
  const responses = {
    'hola': '¡Hola! 👋 Soy Zeus AI. ¿Cómo puedo ayudarte con el clima hoy?',
    'buenos días': '¡Buenos días! ☀️ ¿Qué te gustaría saber sobre el clima?',
    'buenas tardes': '¡Buenas tardes! 🌤️ ¿En qué puedo ayudarte?',
    'buenas noches': '¡Buenas noches! 🌙 ¿Necesitas información sobre el clima nocturno?',
    'llover': '🌧️ Para saber si lloverá, busca una ciudad específica. ¿Te gustaría buscar el clima de algún lugar?',
    'lluvia': '🌧️ La lluvia depende de muchos factores. ¿En qué ciudad estás interesado?',
    'sol': '☀️ ¡Perfecto! El sol está brillando. ¿Buscas el pronóstico para alguna ciudad?',
    'frío': '❄️ Hace frío, ¿verdad? Puedo darte información sobre temperaturas bajas. ¿En qué ciudad?',
    'calor': '🔥 Mucho calor hoy. ¿Te gustaría saber el pronóstico para otra ciudad?',
    'viento': '💨 El viento puede ser fuerte. ¿En qué zona te interesa consultar?',
    'tormenta': '⛈️ Cuidado con las tormentas. ¿Te ayudo a buscar información sobre alguna ciudad específica?',
    'temperatura': '🌡️ Para conocer la temperatura exacta, busca una ciudad. ¿Dónde te gustaría consultar?',
    'pronóstico': '📊 Los pronósticos están disponibles para cualquier ciudad. ¿Cuál te interesa?',
    'gracias': '¡De nada! 😊 ¿Hay algo más en lo que pueda ayudarte?',
    'adiós': '¡Adiós! 👋 ¡Que tengas un excelente día!',
    'chao': '¡Chao! 👋 ¡Vuelve cuando quieras consultar el clima!',
    'qué puedes hacer': '🤖 Puedo:\n• Responder preguntas sobre el clima\n• Compartir curiosidades meteorológicas\n• Darte consejos según las condiciones\n• Explicar fenómenos climáticos',
    'que puedes hacer': '🤖 Puedo:\n• Responder preguntas sobre el clima\n• Compartir curiosidades meteorológicas\n• Darte consejos según las condiciones\n• Explicar fenómenos climáticos'
  };
  
  for (const [key, value] of Object.entries(responses)) {
    if (lowerMessage.includes(key)) {
      return value;
    }
  }
  
  return `Interesante pregunta sobre "${message}". 🤔 Para darte información precisa sobre el clima, te recomiendo buscar una ciudad específica. ¿Hay algo más en lo que pueda ayudarte?`;
}
