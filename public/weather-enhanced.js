// ============================================
// ZEUS METEO PREMIUM - ENGINE 2.0
// UI Engineering: Optimized for Premium Experience
// ============================================

// Global State
let currentLocation = null;
let currentCoords = null;
let currentReport = null;
let hourlyForecastData = [];
let searchController = null;
let currentDailyForecast = [];
let currentLocationName = '';
let temperatureUnit = 'C';
let tempChart = null;

// ============================================
// CORE INITIALIZATION
// ============================================
document.addEventListener('DOMContentLoaded', () => {
  initTheme();
  initChatbot();
  const lastLocation = localStorage.getItem('last_location');
  if (lastLocation) {
    document.getElementById('location-input').value = lastLocation;
  }
});

// ============================================
// UI FEEDBACK SYSTEMS
// ============================================
function showLoading() {
  const loader = document.getElementById('loading');
  if (loader) loader.classList.add('active');

  // Skeleton Animation on content
  const elements = ['current-temp', 'city-name', 'weather-description', 'humidity', 'wind', 'pressure'];
  elements.forEach(id => {
    const el = document.getElementById(id);
    if (el) el.classList.add('skeleton-pulse');
  });
}

function hideLoading() {
  const loader = document.getElementById('loading');
  if (loader) loader.classList.remove('active');

  const elements = ['current-temp', 'city-name', 'weather-description', 'humidity', 'wind', 'pressure'];
  elements.forEach(id => {
    const el = document.getElementById(id);
    if (el) el.classList.remove('skeleton-pulse');
  });
}

// ============================================
// SEARCH ENGINE
// ============================================
async function searchWeather() {
  const input = document.getElementById('location-input');
  const location = input.value.trim();

  if (!location) {
    showNotification('Ingresa una ciudad para comenzar', 'warning');
    return;
  }

  showLoading();
  localStorage.setItem('last_location', location);

  if (searchController) searchController.abort();
  searchController = new AbortController();

  try {
    const response = await fetch(`/api/weather?location=${encodeURIComponent(location)}`, {
      signal: searchController.signal
    });

    const data = await response.json();

    if (data.success) {
      currentReport = data.report;
      currentLocation = location;
      document.getElementById('empty-state-hero').style.display = 'none';
      document.getElementById('main-content').style.display = 'grid';

      updateCurrentWeather(data.report);
      await fetchExtendedForecast(location);
      updateDynamicBackground(data.report.description);
      
      // Load enhanced features
      loadEnhancedFeatures(data.report);
    } else {
      showNotification(data.error || 'Ubicación no encontrada', 'error');
    }
  } catch (error) {
    if (error.name !== 'AbortError') {
      console.error('Search error:', error);
      showNotification('Error al conectar con Zeus', 'error');
    }
  } finally {
    hideLoading();
  }
}

async function fetchExtendedForecast(location) {
  try {
    const mockDaily = [];
    const days = ['Hoy', 'Mañana', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes'];
    for (let i = 0; i < 7; i++) {
      mockDaily.push({
        day: days[i],
        temp: currentReport.temperature + (Math.random() * 4 - 2),
        icon: i === 0 ? getWeatherIcon(currentReport.description) : '🌤️'
      });
    }
    currentDailyForecast = mockDaily;
    displayDailyForecast(mockDaily);
    renderTemperatureChart(mockDaily);
    renderNearbyCities(location);
  } catch (e) {
    console.warn('Forecast error:', e);
  }
}

function renderNearbyCities(location) {
  const container = document.getElementById('nearby-cities');
  const cities = [
    { name: 'Ciudad de México', temp: 22 },
    { name: 'Buenos Aires', temp: 18 },
    { name: 'Madrid', temp: 14 }
  ];

  container.innerHTML = cities.map(c => `
        <div class="stat-item" style="flex-direction: row; justify-content: space-between; cursor: pointer;" onclick="quickSearch('${c.name}')">
            <span>${c.name}</span>
            <span style="font-weight: 700;">${c.temp}°C</span>
        </div>
    `).join('');
}

// ============================================
// UI RENDERING
// ============================================
function updateCurrentWeather(report) {
  document.getElementById('city-name').textContent = report.location;
  document.getElementById('current-temp').textContent = Math.round(report.temperature);
  document.getElementById('weather-description').textContent = report.description;

  document.getElementById('humidity').textContent = `${report.humidity || 50}%`;
  document.getElementById('wind').textContent = `${Math.round(report.windSpeed || 10)} km/h`;
  document.getElementById('pressure').textContent = `${report.pressure || 1013} hPa`;

  const iconEl = document.getElementById('weather-icon');
  iconEl.textContent = getWeatherIcon(report.description);

  // Update Map
  const mapFrame = document.getElementById('map-iframe');
  if (mapFrame && report.lat && report.lng && !isNaN(report.lat) && !isNaN(report.lng)) {
    const lat = parseFloat(report.lat);
    const lng = parseFloat(report.lng);
    mapFrame.src = `https://www.openstreetmap.org/export/embed.html?bbox=${lng - 0.1},${lat - 0.1},${lng + 0.1},${lat + 0.1}&layer=mapnik`;
  }

  // AI Analysis in Panel
  renderAIAnalysis(report);
}

function displayDailyForecast(days) {
  const container = document.getElementById('daily-forecast');
  container.innerHTML = days.map(d => `
        <div class="forecast-day-card">
            <div class="day-name">${d.day}</div>
            <div style="font-size: 2rem; margin: 10px 0;">${d.icon}</div>
            <div class="day-temp">${Math.round(d.temp)}°</div>
        </div>
    `).join('');
}

function renderAIAnalysis(report) {
  const panel = document.getElementById('ai-recommendation');
  const text = report.analysis || `Basado en las condiciones actuales en ${report.location} (${report.temperature}°C), el sistema Zeus detecta un clima ${report.description}. Se recomienda ${report.temperature > 25 ? 'hidratación constante y uso de protector solar.' : report.temperature < 15 ? 'vestir prendas de abrigo y evitar exposición prolongada al frío.' : 'ropa ligera pero con una chaqueta adicional para la tarde.'} La humedad del ${report.humidity}% favorece una sensación térmica estable.`;

  typewriterEffect(panel, text);
}

// ============================================
// DATA VISUALIZATION (APEXCHARTS)
// ============================================
function renderTemperatureChart(data) {
  const options = {
    series: [{
      name: 'Temperatura',
      data: data.map(d => Math.round(d.temp))
    }],
    chart: {
      type: 'area',
      height: 300,
      toolbar: { show: false },
      animations: { enabled: true, easing: 'easeinout', speed: 800 },
      background: 'transparent'
    },
    colors: ['#38bdf8'],
    fill: {
      type: 'gradient',
      gradient: {
        shadeIntensity: 1,
        opacityFrom: 0.45,
        opacityTo: 0.05,
        stops: [20, 100]
      }
    },
    dataLabels: { enabled: false },
    stroke: { curve: 'smooth', width: 3 },
    grid: { borderColor: 'rgba(255,255,255,0.05)', strokeDashArray: 4 },
    xaxis: {
      categories: data.map(d => d.day),
      labels: { style: { colors: 'rgba(255,255,255,0.5)', fontFamily: 'Outfit' } }
    },
    yaxis: {
      labels: { style: { colors: 'rgba(255,255,255,0.5)', fontFamily: 'Outfit' } }
    },
    theme: { mode: 'dark' }
  };

  if (tempChart) tempChart.destroy();
  tempChart = new ApexCharts(document.querySelector("#tempChart"), options);
  tempChart.render();
}

// ============================================
// UTILITIES & POLISH
// ============================================
function updateDynamicBackground(desc = '') {
  const root = document.getElementById('ambient-root');
  const h = desc.includes('Nublado') || desc.includes('lluv') ? 220 : 200;
  const s = desc.includes(' Nublado') ? '30%' : '80%';
  const l = desc.includes('Nublado') ? '30%' : '50%';

  document.documentElement.style.setProperty('--primary-h', h);
  document.documentElement.style.setProperty('--primary-s', s);
  document.documentElement.style.setProperty('--primary-l', l);
}

function typewriterEffect(element, text) {
  let i = 0;
  element.innerHTML = '';
  const speed = 20;

  function type() {
    if (i < text.length) {
      element.innerHTML += text.charAt(i);
      i++;
      setTimeout(type, speed);
    }
  }
  type();
}

function getWeatherIcon(desc) {
  if (!desc) return '⛅';
  desc = desc.toLowerCase();
  if (desc.includes('despejado') || desc.includes('sol')) return '☀️';
  if (desc.includes('parcialmente')) return '🌤️';
  if (desc.includes('nublado')) return '☁️';
  if (desc.includes('lluvia') || desc.includes('llovizna')) return '🌧️';
  if (desc.includes('tormenta')) return '⛈️';
  return '⛅';
}

function showNotification(msg, type = 'info') {
  const color = type === 'error' ? '#ef4444' : type === 'warning' ? '#f59e0b' : '#38bdf8';
  const toast = document.createElement('div');
  toast.style = `position: fixed; top: 20px; right: 20px; background: ${color}; color: white; padding: 12px 24px; border-radius: 12px; z-index: 9999; box-shadow: 0 10px 30px rgba(0,0,0,0.3); animation: slideIn 0.3s ease-out;`;
  toast.textContent = msg;
  document.body.appendChild(toast);
  setTimeout(() => {
    toast.style.animation = 'slideOut 0.3s ease-in forwards';
    setTimeout(() => toast.remove(), 300);
  }, 3000);
}

// Chatbot Logic
function toggleChatbot() {
  const container = document.getElementById('chatbot-container');
  container.style.display = container.style.display === 'flex' ? 'none' : 'flex';
}

async function sendChatMessage() {
  const input = document.getElementById('chatbot-input-nasa');
  const content = input.value.trim();
  if (!content) return;

  appendMessage('user', content);
  input.value = '';

  try {
    // Check for local commands first
    const commandResponse = await handleChatCommand(content);
    if (commandResponse) {
      appendMessage('assistant', commandResponse);
      return;
    }
    
    // If not a command, call the API
    const response = await fetch('/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: content, context: currentReport })
    });
    const data = await response.json();
    appendMessage('assistant', data.response);
  } catch (e) {
    appendMessage('assistant', 'Lo siento, mi conexión con la red de Zeus se ha interrumpido.');
  }
}

function appendMessage(role, content) {
  const container = document.getElementById('chatbot-messages');
  const div = document.createElement('div');
  div.className = `msg-bubble msg-${role}`;
  div.textContent = content;
  container.appendChild(div);
  container.scrollTop = container.scrollHeight;
}

function handleChatKeyPress(e) {
  if (e.key === 'Enter') sendChatMessage();
}

// Initializing Theme
function initTheme() {
  document.body.classList.add('dark-mode');
}

// Chatbot Initialization
function initChatbot() {
  console.log('🤖 Zeus AI Chatbot inicializado');
  // Aquí se podrían cargar mensajes previos del localStorage si se desea
}

// Service Worker Registration
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js')
      .then(reg => console.log('🚀 Zeus Service Worker activo'))
      .catch(err => console.warn('⚠️ Fallo en SW:', err));
  });
}

async function searchCurrentLocation() {
  if (navigator.geolocation) {
    showLoading();
    navigator.geolocation.getCurrentPosition(async (pos) => {
      const { latitude, longitude } = pos.coords;
      try {
        const response = await fetch(`/api/weather?location=${latitude},${longitude}`);
        const data = await response.json();
        if (data.success) {
          updateCurrentWeather(data.report);
          document.getElementById('empty-state-hero').style.display = 'none';
          document.getElementById('main-content').style.display = 'grid';
        }
      } catch (e) {
        showNotification('Error al obtener ubicación', 'error');
      } finally {
        hideLoading();
      }
    });
  }
}

// ============================================
// ENHANCED WEATHER FEATURES
// ============================================

// Calculate dew point from temperature and humidity
function calculateDewPoint(temp, humidity) {
  const a = 17.27;
  const b = 237.7;
  const alpha = ((a * temp) / (b + temp)) + Math.log(humidity / 100);
  return (b * alpha) / (a - alpha);
}

// Calculate heat index (feels like for hot weather)
function calculateHeatIndex(temp, humidity) {
  const c1 = -8.78469475556;
  const c2 = 1.61139411;
  const c3 = 2.33854883889;
  const c4 = -0.14611605;
  const c5 = -0.012308094;
  const c6 = -0.0164248277778;
  const c7 = 0.002211732;
  const c8 = 0.00072546;
  const c9 = -0.000003582;
  
  const T = temp;
  const R = humidity;
  
  const HI = c1 + c2*T + c3*R + c4*T*R + c5*T*T + c6*R*R + c7*T*T*R + c8*T*R*R + c9*T*T*R*R;
  return HI;
}

// Get UV index level description
function getUVLevel(uv) {
  if (uv <= 2) return { level: 'Bajo', color: '#10B981', advice: 'Seguro para actividades al aire libre' };
  if (uv <= 5) return { level: 'Moderado', color: '#F59E0B', advice: 'Usa protector solar FPS 30+' };
  if (uv <= 7) return { level: 'Alto', color: '#F97316', advice: 'Reduce la exposición solar' };
  if (uv <= 10) return { level: 'Muy Alto', color: '#EF4444', advice: 'Evita exposición directa al sol' };
  return { level: 'Extremo', color: '#7C3AED', advice: 'Permanece en interiores' };
}

// Get AQI level description
function getAQILevel(aqi) {
  if (aqi <= 50) return { level: 'Bueno', color: '#10B981', icon: '😊' };
  if (aqi <= 100) return { level: 'Moderado', color: '#F59E0B', icon: '😐' };
  if (aqi <= 150) return { level: 'Dañino para grupos sensibles', color: '#F97316', icon: '😷' };
  if (aqi <= 200) return { level: 'Dañino', color: '#EF4444', icon: '😰' };
  if (aqi <= 300) return { level: 'Muy dañino', color: '#7C3AED', icon: '🤢' };
  return { level: 'Peligroso', color: '#7C3AED', icon: '☠️' };
}

// Update additional metrics display
function updateAdditionalMetrics(report) {
  const temp = report.temperature || 20;
  const humidity = report.humidity || 50;
  
  // Feels like (heat index for hot, wind chill for cold)
  let feelsLike = temp;
  if (temp >= 27) {
    feelsLike = calculateHeatIndex(temp, humidity);
  }
  document.getElementById('feels-like').textContent = `${Math.round(feelsLike)}°`;
  
  // Dew point
  const dewPoint = calculateDewPoint(temp, humidity);
  document.getElementById('dew-point').textContent = `${Math.round(dewPoint)}°`;
  
  // UV Index (simulated based on time of day - in production would come from API)
  const hour = new Date().getHours();
  const isDaytime = hour >= 6 && hour <= 18;
  const baseUV = isDaytime ? 5 : 0;
  const uv = Math.max(0, Math.min(11, baseUV + Math.floor(Math.random() * 3)));
  const uvInfo = getUVLevel(uv);
  document.getElementById('uv-index').textContent = `${uv} (${uvInfo.level})`;
  document.getElementById('uv-index').style.color = uvInfo.color;
  
  // Visibility
  const visibility = report.visibility || (8 + Math.random() * 4);
  document.getElementById('visibility').textContent = `${visibility.toFixed(1)} km`;
  
  // Cloud cover
  const cloudCover = report.cloudCover || Math.floor(Math.random() * 50);
  document.getElementById('cloud-cover').textContent = `${cloudCover}%`;
  
  // Gusts
  const gusts = report.windSpeed ? Math.round(report.windSpeed * 1.3) : Math.floor(10 + Math.random() * 20);
  document.getElementById('gusts').textContent = `${gusts} km/h`;
}

// Check for weather alerts based on conditions
function checkWeatherAlerts(report) {
  const alerts = [];
  const temp = report.temperature || 20;
  const humidity = report.humidity || 50;
  const windSpeed = report.windSpeed || 0;
  const description = (report.description || '').toLowerCase();
  
  // Temperature alerts
  if (temp >= 38) {
    alerts.push({
      type: 'danger',
      icon: '🌡️',
      title: 'Ola de Calor Extrema',
      description: 'Temperaturas superiores a 38°C. Mantente hidratado y evita exposición directa al sol.'
    });
  } else if (temp >= 35) {
    alerts.push({
      type: 'warning',
      icon: '🔥',
      title: 'Alerta de Calor',
      description: 'Temperaturas muy elevadas. Usa protector solar y ropa ligera.'
    });
  } else if (temp <= 0) {
    alerts.push({
      type: 'danger',
      icon: '❄️',
      title: 'Alerta de Heladas',
      description: 'Temperaturas bajo cero. Protege tuberías y plantas sensibles al frío.'
    });
  } else if (temp <= 5) {
    alerts.push({
      type: 'warning',
      icon: '🥶',
      title: 'Frío Intenso',
      description: 'Temperaturas muy bajas. Abrígate adecuadamente.'
    });
  }
  
  // Wind alerts
  if (windSpeed >= 80) {
    alerts.push({
      type: 'danger',
      icon: '💨',
      title: 'Vientos Huracanados',
      description: 'Rafagas superiores a 80 km/h. Permanece en interiores.'
    });
  } else if (windSpeed >= 50) {
    alerts.push({
      type: 'warning',
      icon: '🌬️',
      title: 'Vientos Fuertes',
      description: 'Rafagas significativas. Ten precaución al conducir.'
    });
  }
  
  // Weather condition alerts
  if (description.includes('tormenta') || description.includes('thunder')) {
    alerts.push({
      type: 'warning',
      icon: '⛈️',
      title: 'Tormenta Eléctrica',
      description: 'Tormentas previstas. Evita actividades al aire libre.'
    });
  }
  
  if (description.includes('lluvia') || description.includes('rain')) {
    alerts.push({
      type: 'info',
      icon: '🌧️',
      title: 'Precipitaciones',
      description: 'Lluvia esperada. Lleva paraguas y conduce con precaución.'
    });
  }
  
  // Humidity alerts
  if (humidity >= 85) {
    alerts.push({
      type: 'warning',
      icon: '💧',
      title: 'Alta Humedad',
      description: 'Humedad relativa muy alta. Sensación de incomodidad.'
    });
  }
  
  return alerts;
}

// Display weather alerts
function displayWeatherAlerts(report) {
  const alertsContainer = document.getElementById('alerts-container');
  const alertsSection = document.getElementById('weather-alerts');
  
  const alerts = checkWeatherAlerts(report);
  
  if (alerts.length > 0) {
    alertsSection.style.display = 'block';
    alertsContainer.innerHTML = alerts.map(alert => `
      <div class="alert-item ${alert.type}">
        <span class="alert-icon">${alert.icon}</span>
        <div class="alert-content">
          <div class="alert-title">${alert.title}</div>
          <div class="alert-description">${alert.description}</div>
        </div>
      </div>
    `).join('');
  } else {
    alertsSection.style.display = 'none';
  }
}

// Simulate air quality data (in production would come from AQI API)
function updateAirQuality(lat, lng) {
  const aqi = Math.floor(30 + Math.random() * 50);
  const aqiInfo = getAQILevel(aqi);
  
  const aqiValue = document.getElementById('aqi-value');
  aqiValue.textContent = aqi;
  aqiValue.style.background = `linear-gradient(135deg, ${aqiInfo.color}, ${aqiInfo.color}88)`;
  aqiValue.style.webkitBackgroundClip = 'text';
  aqiValue.style.backgroundClip = 'text';
  
  // Simulated pollutant levels
  document.getElementById('pm25').textContent = (Math.random() * 30).toFixed(1) + ' µg/m³';
  document.getElementById('pm10').textContent = (Math.random() * 40).toFixed(1) + ' µg/m³';
  document.getElementById('o3').textContent = (Math.random() * 60).toFixed(1) + ' µg/m³';
}

// Update data quality indicator
function updateDataQuality(source) {
  const sourceEl = document.getElementById('data-source');
  const badgeEl = document.getElementById('quality-badge');
  
  if (source === 'live' || source === 'Open-Meteo') {
    sourceEl.textContent = 'Open-Meteo (Tiempo Real)';
    badgeEl.textContent = 'EN VIVO';
    badgeEl.className = 'quality-badge live';
  } else if (source === 'cached') {
    sourceEl.textContent = 'Caché (5 min)';
    badgeEl.textContent = 'CACHÉ';
    badgeEl.className = 'quality-badge cached';
  } else {
    sourceEl.textContent = 'Datos Estimados';
    badgeEl.textContent = 'ESTIMADO';
    badgeEl.className = 'quality-badge fallback';
  }
}

// Manage recent searches
function addToRecentSearches(location, temp) {
  let recent = JSON.parse(localStorage.getItem('recent_searches') || '[]');
  
  // Remove if already exists
  recent = recent.filter(item => item.name.toLowerCase() !== location.toLowerCase());
  
  // Add to beginning
  recent.unshift({ name: location, temp: temp, time: Date.now() });
  
  // Keep only last 5
  recent = recent.slice(0, 5);
  
  localStorage.setItem('recent_searches', JSON.stringify(recent));
  renderRecentSearches();
}

function renderRecentSearches() {
  const container = document.getElementById('recent-searches');
  if (!container) return;
  
  const recent = JSON.parse(localStorage.getItem('recent_searches') || '[]');
  
  if (recent.length === 0) {
    container.innerHTML = '<p style="opacity: 0.5; font-size: 0.875rem;">No hay búsquedas recientes</p>';
    return;
  }
  
  container.innerHTML = recent.map((item, index) => `
    <div class="recent-search-item" onclick="quickSearch('${item.name}')">
      <span class="recent-search-name">📍 ${item.name}</span>
      <span class="recent-search-temp">${item.temp}°C</span>
      <button class="recent-search-remove" onclick="event.stopPropagation(); removeRecentSearch(${index})">✕</button>
    </div>
  `).join('');
}

function removeRecentSearch(index) {
  let recent = JSON.parse(localStorage.getItem('recent_searches') || '[]');
  recent.splice(index, 1);
  localStorage.setItem('recent_searches', JSON.stringify(recent));
  renderRecentSearches();
}

// Share weather to social media
async function shareWeather() {
  const city = document.getElementById('city-name').textContent;
  const temp = document.getElementById('current-temp').textContent;
  const desc = document.getElementById('weather-description').textContent;
  
  const shareData = {
    title: `Clima en ${city} - Zeus Meteo`,
    text: `🌤️ ${city}: ${temp}°C - ${desc}\n\nDatos meteorológicos de Zeus Meteo`,
    url: window.location.href
  };
  
  if (navigator.share) {
    try {
      await navigator.share(shareData);
      showNotification('¡Compartido exitosamente!', 'success');
    } catch (err) {
      if (err.name !== 'AbortError') {
        copyToClipboard(`${temp}°C en ${city} - ${desc}`);
      }
    }
  } else {
    copyToClipboard(`${temp}°C en ${city} - ${desc}`);
  }
}

function copyToClipboard(text) {
  navigator.clipboard.writeText(text).then(() => {
    showNotification('¡Copiado al portapapeles!', 'success');
  }).catch(() => {
    showNotification('Error al copiar', 'error');
  });
}

// Show notification toast
function showNotification(message, type = 'info') {
  let toast = document.querySelector('.notification-toast');
  if (!toast) {
    toast = document.createElement('div');
    toast.className = 'notification-toast';
    document.body.appendChild(toast);
  }
  
  toast.textContent = message;
  toast.className = `notification-toast ${type} show`;
  
  setTimeout(() => {
    toast.classList.remove('show');
  }, 3000);
}

// Toggle high contrast mode for accessibility
function toggleHighContrast() {
  document.body.classList.toggle('high-contrast');
  localStorage.setItem('high_contrast', document.body.classList.contains('high-contrast'));
}

// Initialize accessibility
function initAccessibility() {
  if (localStorage.getItem('high_contrast') === 'true') {
    document.body.classList.add('high-contrast');
  }
  
  // Keyboard shortcuts
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      // Close any open modals
      const chatbot = document.getElementById('chatbot-container');
      if (chatbot && chatbot.classList.contains('active')) {
        toggleChatbot();
      }
    }
    
    // Ctrl/Cmd + K for search focus
    if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
      e.preventDefault();
      document.getElementById('location-input')?.focus();
    }
  });
}

// Load all enhanced features
function loadEnhancedFeatures(report) {
  // Update additional metrics
  updateAdditionalMetrics(report);
  
  // Display weather alerts
  displayWeatherAlerts(report);
  
  // Update air quality if we have coordinates
  if (report.lat && report.lng) {
    updateAirQuality(report.lat, report.lng);
  }
  
  // Update data quality
  updateDataQuality(report.source || 'live');
  
  // Add to recent searches
  addToRecentSearches(report.location, report.temperature);
  
  // Render recent searches
  renderRecentSearches();
  
  // Update moon phase
  updateMoonPhase();
  
  // Store current report for comparison
  window.currentReport = report;
}

// ============================================
// MOON PHASE WIDGET
// ============================================
const moonPhases = [
  { name: 'Luna Nueva', icon: '🌑', illumination: 0, daysUntil: 0 },
  { name: 'Cuarto Creciente', icon: '🌓', illumination: 25, daysUntil: 7 },
  { name: 'Gibosa Creciente', icon: '🌔', illumination: 75, daysUntil: 11 },
  { name: 'Luna Llena', icon: '🌕', illumination: 100, daysUntil: 15 },
  { name: 'Gibosa Menguante', icon: '🌖', illumination: 75, daysUntil: 19 },
  { name: 'Cuarto Menguante', icon: '🌗', illumination: 25, daysUntil: 22 }
];

function calculateMoonPhase(date = new Date()) {
  const synodic = 29.53058867;
  const knownNewMoon = new Date('2023-01-21T20:53:00Z');
  const daysSinceNewMoon = (date - knownNewMoon) / (1000 * 60 * 60 * 24);
  const newMoons = daysSinceNewMoon / synodic;
  const phase = newMoons - Math.floor(newMoons);
  
  const phaseIndex = Math.floor(phase * 6) % 6;
  const daysIntoPhase = Math.floor(phase * 29.53);
  
  return moonPhases[phaseIndex];
}

function updateMoonPhase() {
  const moon = calculateMoonPhase();
  
  const moonIconEl = document.getElementById('moon-icon-large');
  const moonPhaseEl = document.getElementById('moon-phase-name');
  const moonIllumEl = document.getElementById('moon-illumination');
  const moonNextEl = document.getElementById('moon-next-phase');
  
  if (moonIconEl) moonIconEl.textContent = moon.icon;
  if (moonPhaseEl) moonPhaseEl.textContent = moon.name;
  if (moonIllumEl) moonIllumEl.textContent = `${moon.illumination}% iluminada`;
  
  // Calculate next phase
  if (moonNextEl) {
    const nextPhaseIndex = (moonPhases.indexOf(moon) + 1) % 6;
    const nextPhase = moonPhases[nextPhaseIndex];
    const daysUntilNext = nextPhase.daysUntil - (moon.daysUntil || 0);
    moonNextEl.textContent = `Próxima: ${nextPhase.name} en ${Math.abs(daysUntilNext)} días`;
  }
}

// ============================================
// COMPARE CITIES
// ============================================
let compareCitiesList = [];

async function compareCity() {
  const input = document.getElementById('compare-city-input');
  const city = input.value.trim();
  
  if (!city) return;
  
  try {
    const response = await fetch(`/api/weather?location=${encodeURIComponent(city)}`);
    const data = await response.json();
    
    if (data.success && data.report) {
      compareCitiesList.push({
        name: data.report.location,
        temp: data.report.temperature,
        description: data.report.description
      });
      
      renderCompareCities();
      input.value = '';
    } else {
      showNotification('Ciudad no encontrada', 'error');
    }
  } catch (e) {
    showNotification('Error al comparar ciudad', 'error');
  }
}

function removeCompareCity(index) {
  compareCitiesList.splice(index, 1);
  renderCompareCities();
}

function renderCompareCities() {
  const container = document.getElementById('compare-results');
  
  if (compareCitiesList.length === 0) {
    container.innerHTML = '<p style="opacity: 0.5; font-size: 0.875rem;">Agrega ciudades para comparar</p>';
    return;
  }
  
  container.innerHTML = compareCitiesList.map((city, index) => `
    <div class="compare-city-item">
      <span class="compare-city-name">
        <span>${getWeatherIcon(city.description)}</span>
        ${city.name}
      </span>
      <span class="compare-city-temp">${city.temp}°C</span>
      <button class="compare-city-remove" onclick="removeCompareCity(${index})">✕</button>
    </div>
  `).join('');
}

// ============================================
// ENHANCED CHATBOT
// ============================================
const chatbotCommands = [
  { cmd: '/help', desc: 'Ver comandos disponibles' },
  { cmd: '/clima', desc: 'Información del clima actual' },
  { cmd: '/pronostico', desc: 'Pronóstico de 7 días' },
  { cmd: '/alertas', desc: 'Ver alertas activas' },
  { cmd: '/clear', desc: 'Limpiar conversación' }
];

async function handleChatCommand(message) {
  const cmd = message.toLowerCase().trim();
  
  switch (cmd) {
    case '/help':
      return `📋 Comandos disponibles:
/clima - Información del clima actual
/pronostico - Pronóstico de 7 días
/alertas - Ver alertas activas
/clear - Limpiar conversación
/temp [ciudad] - Temperatura de otra ciudad
/aire - Calidad del aire`;
    
    case '/clima':
      if (window.currentReport) {
        return `🌤️ Clima actual en ${window.currentReport.location}:
• Temperatura: ${window.currentReport.temperature}°C
• Sensación: ${document.getElementById('feels-like')?.textContent || '--'}
• Humedad: ${window.currentReport.humidity}%
• Viento: ${window.currentReport.windSpeed} km/h
• Presión: ${window.currentReport.pressure} hPa`;
      }
      return 'Primero busca el clima de una ciudad.';
    
    case '/pronostico':
      return '📅 El pronóstico de 7 días se muestra en la sección principal. ¿Te gustaría ver algún día en particular?';
    
    case '/alertas':
      const alerts = checkWeatherAlerts(window.currentReport || {});
      if (alerts.length > 0) {
        return '⚠️ Alertas activas:\n' + alerts.map(a => `• ${a.icon} ${a.title}: ${a.description}`).join('\n');
      }
      return '✅ No hay alertas meteorológicas activas.';
    
    case '/aire':
      const aqi = document.getElementById('aqi-value')?.textContent || '--';
      return `💨 Calidad del aire (AQI): ${aqi}\n\nPM2.5: ${document.getElementById('pm25')?.textContent || '--'}\nPM10: ${document.getElementById('pm10')?.textContent || '--'}\nO₃: ${document.getElementById('o3')?.textContent || '--'}`;
    
    case '/clear':
      const container = document.getElementById('chatbot-messages');
      container.innerHTML = '<div class="msg-bubble msg-assistant">¡Hola! Soy Zeus AI. ¿En qué puedo ayudarte hoy con el clima?</div>';
      return null;
    
    default:
      if (cmd.startsWith('/temp ')) {
        const city = cmd.replace('/temp ', '').trim();
        try {
          const response = await fetch(`/api/weather?location=${encodeURIComponent(city)}`);
          const data = await response.json();
          if (data.success) {
            return `🌡️ ${data.report.location}: ${data.report.temperature}°C - ${data.report.description}`;
          }
        } catch (e) {}
        return 'No se pudo obtener la temperatura.';
      }
      return null;
  }
}

// ============================================
// INITIALIZATION
// ============================================
document.addEventListener('DOMContentLoaded', () => {
  initAccessibility();
  renderRecentSearches();
  updateMoonPhase();
  preloadCommonData();
});

// Preload common data for better performance
function preloadCommonData() {
  // Prefetch forecast for common cities
  const commonCities = ['Montevideo', 'Madrid', 'Buenos Aires'];
  
  // Only preload if we have a good connection
  if (navigator.connection && navigator.connection.saveData) {
    return; // Don't preload on data saver mode
  }
  
  // Preload after main content loads
  setTimeout(() => {
    commonCities.forEach(city => {
      const link = document.createElement('link');
      link.rel = 'prefetch';
      link.href = `/api/weather?location=${encodeURIComponent(city)}`;
    });
  }, 5000);
}

// Optimize images and data loading
function optimizeDataLoading() {
  // Lazy load non-critical data
  const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        // Load data when element is visible
        const dataSrc = entry.target.getAttribute('data-src');
        if (dataSrc) {
          entry.target.src = dataSrc;
          observer.unobserve(entry.target);
        }
      }
    });
  });
  
  // Observe elements with data-src
  document.querySelectorAll('img[data-src]').forEach(img => {
    observer.observe(img);
  });
}

// Run optimization after load
window.addEventListener('load', optimizeDataLoading);
