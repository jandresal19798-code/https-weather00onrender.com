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
  const mapUrl = `https://www.google.com/maps/embed/v1/place?key=REPLACE_ME_OR_USE_IFRAME_ALT&q=${encodeURIComponent(report.location)}&zoom=10`;
  // Usando una alternativa libre para el mapa
  mapFrame.src = `https://www.openstreetmap.org/export/embed.html?bbox=${report.lng - 0.1},${report.lat - 0.1},${report.lng + 0.1},${report.lat + 0.1}&layer=mapnik`;

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
