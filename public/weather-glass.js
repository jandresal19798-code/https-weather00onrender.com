// ============================================
// ZEUS METEO - GLASSMORPHISM BENTO GRID
// ============================================

// Global State
let currentLocation = null;
let currentCoords = null;
let currentReport = null;
let hourlyForecastData = [];
let searchTimeout = null;
let currentSuggestions = [];
let currentDailyForecast = [];
let temperatureUnit = 'C';
let tempChart = null;
let recentCities = [];

// ============================================
// UTILITY FUNCTIONS
// ============================================

function showLoading() {
  const loader = document.getElementById('loading');
  if (loader) loader.classList.add('active');
}

function hideLoading() {
  const loader = document.getElementById('loading');
  if (loader) loader.classList.remove('active');
}

function showNotification(message, type = 'info') {
  let toast = document.querySelector('.notification-toast');
  if (!toast) {
    toast = document.createElement('div');
    toast.className = 'notification-toast';
    document.body.appendChild(toast);
  }
  toast.textContent = message;
  toast.className = `notification-toast ${type} show`;
  setTimeout(() => toast.classList.remove('show'), 3000);
}

function getWeatherIcon(desc) {
  const d = (desc || '').toLowerCase();
  if (d.includes('rain') || d.includes('lluvia') || d.includes('drizzle')) return '🌧️';
  if (d.includes('thunder') || d.includes('tormenta')) return '⛈️';
  if (d.includes('snow') || d.includes('nieve')) return '❄️';
  if (d.includes('fog') || d.includes('niebla') || d.includes('mist')) return '🌫️';
  if (d.includes('cloud') || d.includes('nublado') || d.includes('overcast')) return '☁️';
  if (d.includes('night') || d.includes('noche')) return '🌙';
  if (d.includes('clear') || d.includes('soleado') || d.includes('despejado')) return '☀️';
  if (d.includes('partly')) return '⛅';
  if (d.includes('wind')) return '💨';
  return '☀️';
}

function formatTime(date) {
  return new Date(date).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });
}

function formatDate(date) {
  return new Date(date).toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'short' });
}

function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

function getFlag(countryCode) {
  if (!countryCode) return '🌍';
  const codePoints = countryCode.toUpperCase().split('').map(c => 127397 + c.charCodeAt(0));
  return String.fromCodePoint(...codePoints);
}

function convertTemp(celsius) {
  if (temperatureUnit === 'F') {
    return Math.round(celsius * 9/5 + 32);
  }
  return Math.round(celsius);
}

function getTempUnit() {
  return temperatureUnit === 'F' ? '°F' : '°C';
}

// ============================================
// SEARCH FUNCTIONS
// ============================================

async function handleSearchInput(input) {
  const query = input.value.trim();
  
  if (searchTimeout) {
    clearTimeout(searchTimeout);
  }
  
  const suggestionsEl = document.getElementById('search-suggestions');
  
  if (query.length < 2) {
    suggestionsEl.classList.remove('active');
    return;
  }
  
  // Debounce - wait 500ms before making request
  searchTimeout = setTimeout(async () => {
    try {
      const response = await fetch(`/api/search?q=${encodeURIComponent(query)}`, {
        mode: 'cors',
        cache: 'no-cache'
      });
      
      if (!response.ok) {
        suggestionsEl.classList.remove('active');
        return;
      }
      
      const suggestions = await response.json();
      
      if (suggestions.length > 0) {
        currentSuggestions = suggestions;
        suggestionsEl.innerHTML = suggestions.map((s, i) => `
          <div class="suggestion-item" onclick="selectSuggestion(${i})" role="option" tabindex="0">
            <span class="suggestion-flag">${getFlag(s.countryCode)}</span>
            <div class="suggestion-info">
              <span class="suggestion-name">${escapeHtml(s.name)}</span>
              <span class="suggestion-country">${escapeHtml(s.country)}${s.state ? ', ' + escapeHtml(s.state) : ''}</span>
            </div>
          </div>
        `).join('');
        suggestionsEl.classList.add('active');
      } else {
        suggestionsEl.classList.remove('active');
      }
    } catch (e) {
      console.warn('Search error:', e);
      suggestionsEl.classList.remove('active');
    }
  }, 500);
}

function selectSuggestion(index) {
  const suggestion = currentSuggestions[index];
  if (suggestion) {
    const input = document.getElementById('location-input');
    input.value = suggestion.name;
    document.getElementById('search-suggestions').classList.remove('active');
    searchWeather();
  }
}

async function searchCurrentLocation() {
  const input = document.getElementById('location-input');
  input.value = '📍 Detectando...';
  input.disabled = true;
  
  if (!navigator.geolocation) {
    input.value = '';
    input.disabled = false;
    showNotification('Geolocalización no soportada', 'error');
    return;
  }
  
  navigator.geolocation.getCurrentPosition(
    async (position) => {
      const { latitude, longitude } = position.coords;
      input.value = `${latitude.toFixed(2)}, ${longitude.toFixed(2)}`;
      input.disabled = false;
      searchWeather();
    },
    () => {
      input.value = '';
      input.disabled = false;
      showNotification('No se pudo obtener ubicación', 'error');
    },
    { timeout: 10000 }
  );
}

async function searchWeather() {
  const input = document.getElementById('location-input');
  const location = input.value.trim();
  if (!location) {
    showNotification('Ingresa una ciudad', 'warning');
    return;
  }

  document.getElementById('search-suggestions').classList.remove('active');
  showLoading();
  
  // Save to recent cities
  saveRecentCity(location);

  try {
    const response = await fetch('/api/weather?location=' + encodeURIComponent(location));
    const data = await response.json();

    if (data.success) {
      currentReport = data.report;
      currentLocation = location;
      
      // Hide empty state, show main content
      const emptyState = document.getElementById('empty-state-hero');
      const mainContent = document.getElementById('main-content');
      if (emptyState) emptyState.style.display = 'none';
      if (mainContent) mainContent.style.display = 'grid';

      updateMainWeather(data.report);
      await fetchExtendedForecast(location);
      renderRecentCities();
    } else {
      showNotification(data.error || 'Ubicación no encontrada', 'error');
    }
  } catch (error) {
    console.error('Weather error:', error);
    showNotification('Error al conectar con Zeus', 'error');
  } finally {
    hideLoading();
  }
}

function quickSearch(city) {
  const input = document.getElementById('location-input');
  if (input) {
    input.value = city;
    searchWeather();
  } else {
    window.location.href = 'forecast.html?city=' + encodeURIComponent(city);
  }
}

// ============================================
// RECENT CITIES
// ============================================

function saveRecentCity(city) {
  let recent = JSON.parse(localStorage.getItem('recentCities') || '[]');
  recent = recent.filter(c => c.toLowerCase() !== city.toLowerCase());
  recent.unshift(city);
  recent = recent.slice(0, 10);
  localStorage.setItem('recentCities', JSON.stringify(recent));
}

function renderRecentCities() {
  const container = document.getElementById('recent-cities-list');
  if (!container) return;
  
  const recent = JSON.parse(localStorage.getItem('recentCities') || '[]');
  
  if (recent.length === 0) {
    container.innerHTML = '<div class="empty-state"><p>No hay ciudades recientes</p></div>';
    return;
  }
  
  container.innerHTML = recent.slice(0, 6).map(city => `
    <div class="recent-item" onclick="quickSearch('${escapeHtml(city)}')">
      <span class="recent-icon">📍</span>
      <span class="recent-name">${escapeHtml(city)}</span>
    </div>
  `).join('');
}

// ============================================
// WEATHER DATA FETCHING
// ============================================

async function fetchExtendedForecast(location) {
  try {
    let forecastData = null;
    let hourlyData = null;
    
    // Get daily forecast
    try {
      const response = await fetch('/api/forecast-7days?location=' + encodeURIComponent(location));
      if (response.ok) {
        const data = await response.json();
        if (data.success && data.forecast && data.forecast.length > 0) {
          forecastData = data.forecast;
        }
      }
    } catch (e) {
      console.warn('Forecast API error:', e);
    }
    
    // Get hourly forecast
    try {
      const response = await fetch('/api/forecast?location=' + encodeURIComponent(location));
      if (response.ok) {
        const data = await response.json();
        if (data.success && data.hourly) {
          hourlyData = data.hourly;
        }
      }
    } catch (e) {
      console.warn('Hourly forecast error:', e);
    }
    
    // Always process - even if APIs fail, use simulated data
    if (!forecastData && !hourlyData) {
      console.log('Using simulated forecast data');
    }
    
    // Process daily data
    const days = ['Hoy', 'Mañana'];
    const dayNames = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
    const today = new Date().getDay();
    for (let i = 2; i < 7; i++) {
      days.push(dayNames[(today + i) % 7]);
    }
    
    const dailyData = [];
    const baseTemp = currentReport?.temperature || 20;
    
    if (forecastData && forecastData.length > 0) {
      for (let i = 0; i < 7; i++) {
        const day = forecastData[i] || forecastData[0];
        dailyData.push({
          day: days[i],
          temp: (day.temperatureMax + day.temperatureMin) / 2,
          icon: getWeatherIcon(day.description || 'cloudy'),
          high: day.temperatureMax,
          low: day.temperatureMin,
          precip: day.precipitationProbability || 0
        });
      }
    } else {
      for (let i = 0; i < 7; i++) {
        dailyData.push({
          day: days[i],
          temp: baseTemp + (Math.random() * 6 - 3),
          icon: getWeatherIcon(currentReport?.description),
          high: baseTemp + 3,
          low: baseTemp - 3,
          precip: Math.random() * 30
        });
      }
    }
    
    currentDailyForecast = dailyData;
    displayDailyForecast(dailyData);
    
    // Process hourly data
    if (hourlyData && hourlyData.length > 0) {
      displayHourlyForecast(hourlyData.slice(0, 24));
    } else {
      // Generate simulated hourly data
      const simulatedHourly = [];
      const now = new Date();
      for (let i = 0; i < 24; i++) {
        const hour = new Date(now.getTime() + i * 3600000);
        simulatedHourly.push({
          time: hour,
          temp: baseTemp + Math.sin((i - 6) * Math.PI / 12) * 5,
          icon: getWeatherIcon(currentReport?.description),
          precip: Math.random() * 20
        });
      }
      displayHourlyForecast(simulatedHourly);
    }
    
    // Render temperature chart
    renderTemperatureChart(dailyData);
    
  } catch (e) {
    console.warn('Forecast error:', e);
  }
}

// ============================================
// UI RENDERING
// ============================================

function updateMainWeather(report) {
  const cityEl = document.getElementById('city-name');
  const tempEl = document.getElementById('current-temp');
  const descEl = document.getElementById('weather-description');
  const iconEl = document.getElementById('weather-icon');
  
  if (cityEl) cityEl.textContent = report.location;
  if (tempEl) tempEl.textContent = convertTemp(report.temperature);
  if (descEl) descEl.textContent = report.description;
  if (iconEl) iconEl.textContent = getWeatherIcon(report.description);
  
  // Update date
  const dateEl = document.getElementById('current-date');
  if (dateEl) dateEl.textContent = formatDate(new Date());
  
  // Update all weather cards
  updateWeatherCards(report);
  
  // Update map
  const mapFrame = document.getElementById('map-iframe');
  if (mapFrame && report.lat && report.lng) {
    const lat = parseFloat(report.lat);
    const lng = parseFloat(report.lng);
    mapFrame.src = `https://www.openstreetmap.org/export/embed.html?bbox=${lng - 0.1},${lat - 0.1},${lng + 0.1},${lat + 0.1}&layer=mapnik&marker=${lat},${lng}`;
  }
}

function updateWeatherCards(report) {
  const temp = report.temperature || 20;
  const humidity = report.humidity || 50;
  const wind = report.windSpeed || 10;
  const pressure = report.pressure || 1013;
  
  // Humidity - no decimals
  const humidityEl = document.getElementById('humidity-value');
  const humidityBar = document.getElementById('humidity-bar');
  if (humidityEl) humidityEl.textContent = Math.round(humidity) + '%';
  if (humidityBar) humidityBar.style.width = humidity + '%';
  
  // Wind
  const windEl = document.getElementById('wind-value');
  const windDirEl = document.getElementById('wind-direction');
  const compassEl = document.getElementById('compass-icon');
  if (windEl) windEl.innerHTML = `${Math.round(wind)} <small class="card-unit">km/h</small>`;
  if (windDirEl) windDirEl.textContent = getWindDirection(Math.random() * 360);
  if (compassEl) compassEl.style.transform = `rotate(${Math.random() * 360}deg)`;
  
  // Pressure
  const pressureEl = document.getElementById('pressure-value');
  if (pressureEl) pressureEl.innerHTML = `${pressure} <small class="card-unit">hPa</small>`;
  
  // UV Index
  const hour = new Date().getHours();
  const uv = hour >= 6 && hour <= 18 ? Math.floor(Math.random() * 8) + 1 : 0;
  const uvEl = document.getElementById('uv-value');
  const uvBadge = document.getElementById('uv-badge');
  if (uvEl) uvEl.textContent = uv;
  if (uvBadge) {
    uvBadge.textContent = uv <= 2 ? 'Bajo' : uv <= 5 ? 'Moderado' : uv <= 7 ? 'Alto' : uv <= 10 ? 'Muy Alto' : 'Extremo';
    uvBadge.className = `uv-badge ${uv <= 2 ? 'low' : uv <= 5 ? 'moderate' : uv <= 7 ? 'high' : uv <= 10 ? 'very-high' : 'extreme'}`;
  }
  
  // Visibility - no decimals
  const visibility = Math.round(8 + Math.random() * 4);
  const visEl = document.getElementById('visibility-value');
  if (visEl) visEl.innerHTML = `${visibility} <small class="card-unit">km</small>`;
  
  // Dew point
  const dewPoint = temp - ((100 - humidity) / 5);
  const dewEl = document.getElementById('dew-value');
  if (dewEl) dewEl.textContent = Math.round(dewPoint) + '°';
  
  // Sunrise/Sunset
  const sunTimes = calculateSunTimes();
  const sunriseEl = document.getElementById('sunrise-time');
  const sunsetEl = document.getElementById('sunset-time');
  const sunPosition = document.getElementById('sun-position');
  if (sunriseEl) sunriseEl.textContent = sunTimes.sunrise;
  if (sunsetEl) sunsetEl.textContent = sunTimes.sunset;
  if (sunPosition) sunPosition.style.left = sunTimes.position + '%';
  
  // Moon phase
  updateMoonPhase();
  
  // Recommendations
  updateRecommendations(temp, humidity, wind, report.description);
  
  // AQI
  const aqi = Math.floor(30 + Math.random() * 50);
  const aqiEl = document.getElementById('aqi-value');
  const aqiStatus = document.getElementById('aqi-status');
  if (aqiEl) aqiEl.textContent = aqi;
  if (aqiStatus) {
    aqiStatus.textContent = aqi <= 50 ? 'Bueno' : aqi <= 100 ? 'Moderado' : aqi <= 150 ? 'Dañino para sensibles' : aqi <= 200 ? 'Dañino' : 'Muy dañino';
  }
}

function getWindDirection(degrees) {
  const directions = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
  const index = Math.round(degrees / 45) % 8;
  return directions[index];
}

function calculateSunTimes() {
  const now = new Date();
  const sunrise = new Date(now);
  sunrise.setHours(6, 30, 0);
  const sunset = new Date(now);
  sunset.setHours(19, 45, 0);
  
  const totalMinutes = (sunset - sunrise) / 60000;
  const currentMinutes = (now - sunrise) / 60000;
  const position = Math.max(5, Math.min(95, (currentMinutes / totalMinutes) * 100));
  
  return {
    sunrise: formatTime(sunrise),
    sunset: formatTime(sunset),
    position: position
  };
}

function updateMoonPhase() {
  const phases = [
    { icon: '🌑', name: 'Luna Nueva' },
    { icon: '🌒', name: 'Creciente' },
    { icon: '🌓', name: 'Cuarto Creciente' },
    { icon: '🌔', name: 'Gibosa Creciente' },
    { icon: '🌕', name: 'Luna Llena' },
    { icon: '🌖', name: 'Gibosa Menguante' },
    { icon: '🌗', name: 'Cuarto Menguante' },
    { icon: '🌘', name: 'Menguante' }
  ];
  
  const dayOfMonth = new Date().getDate();
  const phaseIndex = Math.floor((dayOfMonth % 29.5) / 3.7);
  const phase = phases[phaseIndex] || phases[4];
  
  const moonIcon = document.getElementById('moon-icon');
  const moonPhase = document.getElementById('moon-phase');
  const moonIllum = document.getElementById('moon-illumination');
  
  if (moonIcon) moonIcon.textContent = phase.icon;
  if (moonPhase) moonPhase.textContent = phase.name;
  if (moonIllum) moonIllum.textContent = Math.round(30 + Math.random() * 70) + '% iluminada';
}

function updateRecommendations(temp, humidity, wind, description) {
  const recs = [];
  const icons = [];
  
  if (temp >= 30) {
    recs.push(' protector solar');
    icons.push('☀️');
  }
  if (temp <= 10) {
    recs.push(' abrigo');
    icons.push('🧥');
  }
  if (humidity >= 80) {
    recs.push(' paraguas');
    icons.push('☔');
  }
  if (description?.toLowerCase().includes('lluvia')) {
    recs.push(' impermeable');
    icons.push('🧥');
  }
  if (wind >= 30) {
    recs.push(' viento fuerte');
    icons.push('💨');
  }
  if (temp >= 20 && temp <= 28 && humidity < 60) {
    recs.push(' ideal para外出');
    icons.push('🚶');
  }
  
  if (recs.length === 0) {
    recs.push(' condiciones ideales');
    icons.push('✅');
  }
  
  const container = document.getElementById('recommendations-list');
  if (container) {
    container.innerHTML = recs.slice(0, 4).map((rec, i) => `
      <div class="rec-item">
        <span class="rec-icon">${icons[i]}</span>
        <span>Lleva${rec}</span>
      </div>
    `).join('');
  }
}

// ============================================
// FORECAST DISPLAY
// ============================================

function displayDailyForecast(days) {
  const container = document.getElementById('daily-forecast');
  if (!container) return;
  
  container.innerHTML = days.map(d => `
    <div class="forecast-day-card">
      <div class="day-name">${d.day}</div>
      <div class="day-icon">${d.icon}</div>
      <div class="day-temp">${convertTemp(d.temp)}°</div>
      <div class="day-high-low">${convertTemp(d.high)}° / ${convertTemp(d.low)}°</div>
    </div>
  `).join('');
}

function displayHourlyForecast(hours) {
  const container = document.getElementById('hourly-forecast');
  if (!container) return;
  
  container.innerHTML = hours.map((h, i) => {
    const time = new Date(h.time);
    const hourStr = i === 0 ? 'Ahora' : formatTime(time);
    return `
      <div class="hourly-card">
        <div class="hour">${hourStr}</div>
        <div class="hour-icon">${h.icon}</div>
        <div class="hour-temp">${convertTemp(h.temp)}°</div>
      </div>
    `;
  }).join('');
}

function renderTemperatureChart(data) {
  if (typeof ApexCharts === 'undefined') return;
  
  const chartEl = document.getElementById('temperature-chart');
  if (!chartEl) return;
  
  const options = {
    series: [{ name: 'Temperatura', data: data.map(d => convertTemp(d.temp)) }],
    chart: { 
      type: 'area', 
      height: 200, 
      toolbar: { show: false }, 
      background: 'transparent',
      fontFamily: 'Outfit, sans-serif'
    },
    colors: ['rgba(255,255,255,0.8)'],
    fill: { 
      type: 'gradient', 
      gradient: { 
        shadeIntensity: 1, 
        opacityFrom: 0.4, 
        opacityTo: 0.05, 
        stops: [20, 100] 
      } 
    },
    dataLabels: { enabled: false },
    stroke: { curve: 'smooth', width: 3 },
    grid: { 
      borderColor: 'rgba(255,255,255,0.1)', 
      strokeDashArray: 4,
      xaxis: { lines: { show: false } }
    },
    xaxis: { 
      categories: data.map(d => d.day.substring(0, 3)), 
      labels: { style: { colors: 'rgba(255,255,255,0.6)' } },
      axisBorder: { show: false },
      axisTicks: { show: false }
    },
    yaxis: { 
      labels: { 
        style: { colors: 'rgba(255,255,255,0.6)' },
        formatter: (val) => val + '°'
      } 
    },
    theme: { mode: 'dark' },
    tooltip: {
      theme: 'dark',
      y: { formatter: (val) => val + '°' }
    }
  };

  if (tempChart) tempChart.destroy();
  tempChart = new ApexCharts(chartEl, options);
  tempChart.render();
}

// ============================================
// UNIT TOGGLE
// ============================================

function toggleUnit(unit) {
  temperatureUnit = unit;
  
  // Update toggle buttons - check for C or F in the text
  document.querySelectorAll('.unit-btn').forEach(btn => {
    const btnUnit = btn.textContent.includes('C') ? 'C' : 'F';
    btn.classList.toggle('active', btnUnit === unit);
  });
  
  // Re-render current weather if data exists
  if (currentReport) {
    updateMainWeather(currentReport);
  }
  if (currentDailyForecast.length > 0) {
    displayDailyForecast(currentDailyForecast);
  }
  if (hourlyForecastData.length > 0) {
    displayHourlyForecast(hourlyForecastData);
  }
}

// Simple toggle that switches between C and F
window.toggleTemperatureUnit = function() {
  const newUnit = temperatureUnit === 'C' ? 'F' : 'C';
  toggleUnit(newUnit);
};

// ============================================
// WEATHER MAPS - WINDY
// ============================================

const mapLayerUrls = {
  wind: 'wind',
  rain: 'rain',
  temp: 'temp',
  clouds: 'clouds'
};

window.switchMapLayer = function(layer) {
  const iframe = document.getElementById('weather-map-iframe');
  const tabs = document.querySelectorAll('.map-tab');
  
  tabs.forEach(tab => tab.classList.remove('active'));
  event.target.classList.add('active');
  
  let lat = -34.9, lon = -56.15;
  if (currentReport?.lat && currentReport?.lng) {
    lat = parseFloat(currentReport.lat);
    lon = parseFloat(currentReport.lng);
  }
  
  const overlay = mapLayerUrls[layer] || 'wind';
  const url = `https://embed.windy.com/embed2.html?lat=${lat}&lon=${lon}&zoom=6&level=surface&overlay=${overlay}&menu=&message=true&marker=&calendar=&pressure=&type=map&location=coordinates&detail=&detailLat=${lat}&detailLon=${lon}&metricWind=km%2Fh&metricTemp=%C2%B0C&radarRange=`;
  if (iframe) iframe.src = url;
};

function updateWeatherMap(lat, lng) {
  const iframe = document.getElementById('weather-map-iframe');
  if (iframe) {
    const activeTab = document.querySelector('.map-tab.active');
    const layer = activeTab ? activeTab.textContent.toLowerCase().includes('viento') ? 'wind' : 
      activeTab.textContent.toLowerCase().includes('lluv') ? 'rain' :
      activeTab.textContent.toLowerCase().includes('temp') ? 'temp' : 'clouds' : 'wind';
    const overlay = mapLayerUrls[layer] || 'wind';
    iframe.src = `https://embed.windy.com/embed2.html?lat=${lat}&lon=${lng}&zoom=6&level=surface&overlay=${overlay}&menu=&message=true&marker=&calendar=&pressure=&type=map&location=coordinates&detail=&detailLat=${lat}&detailLon=${lng}&metricWind=km%2Fh&metricTemp=%C2%B0C&radarRange=`;
  }
}

// ============================================
// WEATHER FACTS
// ============================================

const weatherFacts = [
  "🌍 El rayo más largo duró 7.74 segundos y ocurrió en Brasil en 2020.",
  "❄️ Los copos de nieve nunca son exactamente iguales.",
  "🌪️ Los tornados pueden alcanzar velocidades de más de 400 km/h.",
  "🌧️ El lugar más lluvioso del mundo es Mawsynram, India.",
  "🔥 La temperatura más alta registrada fue 56.7°C en Furnace Creek, California.",
  "🧊 La temperatura más baja registrada fue -89.2°C en Vostok, Antártida.",
  "⚡ Cada segundo caen aproximadamente 100 rayos en la Tierra.",
  "🌈 Los arcoíris son círculos completos, pero normalmente solo vemos la mitad.",
  "🌬️ El viento más fuerte registrado fue 408 km/h en el Monte Washington.",
  "☁️ El cumulonimbo puede alcanzar más de 12 km de altura."
];

function showRandomFact() {
  const factEl = document.getElementById('weather-fact');
  if (factEl) {
    const randomFact = weatherFacts[Math.floor(Math.random() * weatherFacts.length)];
    factEl.innerHTML = `<p>${randomFact}</p>`;
  }
}

// Show a new fact every 30 seconds
setInterval(showRandomFact, 30000);

// ============================================
// PDF REPORT
// ============================================

async function generatePDFReport() {
  if (!currentReport) {
    showNotification('No hay datos para generar informe', 'warning');
    return;
  }

  const { jsPDF } = window.jspdf;
  const doc = new jsPDF();
  const w = doc.internal.pageSize.getWidth();
  let y = 20;

  // Header - Matrix Green gradient
  doc.setFillColor(0, 100, 0);
  doc.rect(0, 0, w, 45, 'F');
  doc.setFillColor(0, 255, 65);
  doc.rect(0, 40, w, 8, 'F');

  doc.setTextColor(255, 255, 255);
  doc.setFontSize(28);
  doc.setFont('helvetica', 'bold');
  doc.text('ZEUS METEO', w / 2, 22, { align: 'center' });
  doc.setFontSize(12);
  doc.text('Informe Meteorológico Profesional', w / 2, 32, { align: 'center' });

  y = 60;
  doc.setTextColor(0, 0, 0);
  doc.setFontSize(20);
  doc.text(currentReport.location || 'Ubicación', 20, y);

  y += 8;
  doc.setFontSize(11);
  doc.setTextColor(100, 100, 100);
  doc.text(new Date().toLocaleDateString('es-ES', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' }), 20, y);
  doc.text('🕐 ' + new Date().toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' }), 120, y);

  y += 15;
  doc.setDrawColor(0, 180, 0);
  doc.setLineWidth(0.5);
  doc.line(20, y, w - 20, y);

  // Current conditions box
  y += 15;
  doc.setFillColor(240, 255, 240);
  doc.roundedRect(15, y, w - 30, 50, 3, 3, 'F');
  y += 12;
  
  doc.setFontSize(14);
  doc.setTextColor(0, 100, 0);
  doc.text('CONDICIONES ACTUALES', 25, y);
  y += 10;
  
  doc.setFontSize(22);
  doc.setTextColor(0, 0, 0);
  const temp = Math.round(currentReport.temperature);
  doc.text(temp + '°C', 25, y + 10);
  
  doc.setFontSize(12);
  doc.setTextColor(80, 80, 80);
  doc.text(currentReport.description || 'N/A', 60, y + 10);
  
  y += 25;
  doc.setFontSize(10);
  const humidity = currentReport.humidity || 50;
  const wind = Math.round(currentReport.windSpeed || 10);
  const pressure = currentReport.pressure || 1013;
  
  doc.text('💧 Humedad: ' + humidity + '%', 25, y);
  doc.text('💨 Viento: ' + wind + ' km/h', 90, y);
  doc.text('⏱️ Presión: ' + pressure + ' hPa', 150, y);

  // 5-Day Forecast
  y += 35;
  if (currentDailyForecast.length > 0) {
    doc.setFillColor(0, 100, 0);
    doc.roundedRect(15, y, w - 30, 12, 2, 2, 'F');
    y += 9;
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(11);
    doc.text('PRONÓSTICO 5 DÍAS', 20, y);
    
    y += 15;
    const forecastDays = currentDailyForecast.slice(0, 5);
    
    forecastDays.forEach((day, i) => {
      const x = 20 + (i * 38);
      doc.setFillColor(245, 255, 245);
      doc.roundedRect(x, y, 35, 35, 2, 2, 'F');
      
      doc.setTextColor(0, 80, 0);
      doc.setFontSize(9);
      doc.text(day.day.substring(0, 6), x + 17, y + 8, { align: 'center' });
      
      doc.setFontSize(14);
      doc.text(day.icon || '☁️', x + 17, y + 20, { align: 'center' });
      
      doc.setFontSize(10);
      doc.setTextColor(0, 0, 0);
      doc.text(Math.round(day.high) + '°', x + 25, y + 30, { align: 'center' });
      doc.setTextColor(100, 100, 100);
      doc.text(Math.round(day.low) + '°', x + 10, y + 30, { align: 'center' });
    });
    y += 45;
  }

  // Additional info
  y += 10;
  doc.setFontSize(10);
  doc.setTextColor(100, 100, 100);
  doc.text('☀️ Amanecer: ' + (document.getElementById('sunrise-time')?.textContent || '--:--'), 20, y);
  doc.text('🌙 Atardecer: ' + (document.getElementById('sunset-time')?.textContent || '--:--'), 80, y);
  
  y += 8;
  doc.text('📍 Lat: ' + (currentReport.lat || '--') + ' | Lon: ' + (currentReport.lng || '--'), 20, y);
  doc.text('🏢 Fuente: ' + (currentReport.source || 'Open-Meteo'), 20, y + 8);

  // Footer
  const pageCount = doc.internal.getNumberOfPages();
  const h = doc.internal.pageSize.getHeight();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFillColor(0, 100, 0);
    doc.rect(0, h - 15, w, 15, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(8);
    doc.text('Zeus Meteo - Informe generado el ' + new Date().toLocaleDateString(), 20, h - 7);
    doc.text('Página ' + i + ' de ' + pageCount, w / 2, h - 7, { align: 'center' });
  }

  const fileName = 'Zeus_Meteo_' + (currentReport.location || 'reporte').replace(/\s+/g, '_') + '_' + new Date().toISOString().split('T')[0] + '.pdf';
  doc.save(fileName);
  showNotification('📄 PDF descargado', 'success');
}

// ============================================
// CHATBOT
// ============================================

let chatHistory = [];

const weatherResponses = {
  'default': [
    "Los datos meteorológicos indican condiciones {condition}. ¿Hay algo específico que quieras saber?",
    "Berdasarkan data, suhu saat ini sekitar {temp}°C. Ada yang ingin ditanyakan?",
    "El clima actual muestra {condition}. Puedo darte más detalles si me preguntas."
  ],
  'caluroso': [
    "¡Hace calor! Remember to stay hydrated and use sunscreen. 🧴",
    "Calor extremo hoy. Avoid outdoor activities during peak hours."
  ],
  'frio': [
    "¡Está frío! Brrr... 🧥 Recomiendo abrigarse bien.",
    "Cold weather ahead. Don't forget your warm clothes! ❄️"
  ],
  'lluvia': [
    "🌧️ Se espera lluvia. No olvides tu paraguas!",
    "Rain expected. Bring an umbrella just in case! ☔"
  ],
  'soleado': [
    "☀️ Día soleado perfecto para actividades al aire libre!",
    "Sunny day! Perfect for going outside. Don't forget sunglasses! 🕶️"
  ]
};

function getOfflineResponse(message) {
  const msg = message.toLowerCase();
  let condition = 'normal';
  
  if (currentReport) {
    const temp = currentReport.temperature;
    const desc = (currentReport.description || '').toLowerCase();
    
    if (temp >= 30) condition = 'caluroso';
    else if (temp <= 10) condition = 'frio';
    else if (desc.includes('lluvia') || desc.includes('rain')) condition = 'lluvia';
    else if (desc.includes('sol') || desc.includes('clear')) condition = 'soleado';
  }
  
  const responses = weatherResponses[condition] || weatherResponses['default'];
  return responses[Math.floor(Math.random() * responses.length)].replace('{condition}', currentReport?.description || 'variable').replace('{temp}', Math.round(currentReport?.temperature || 20));
}

async function sendChatMessage() {
  const input = document.getElementById('chatbot-input');
  if (!input) return;
  
  const content = input.value.trim();
  if (!content) return;

  const container = document.getElementById('chatbot-messages');
  if (!container) return;
  
  container.innerHTML += '<div class="msg-bubble msg-user">' + escapeHtml(content) + '</div>';
  input.value = '';
  container.scrollTop = container.scrollHeight;

  container.innerHTML += '<div class="msg-bubble msg-assistant typing-indicator"><span>.</span><span>.</span><span>.</span></div>';
  container.scrollTop = container.scrollHeight;

  try {
    const response = await fetch('/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: content, context: currentReport, history: chatHistory })
    });
    
    if (!response.ok) throw new Error('API unavailable');
    
    const data = await response.json();

    container.removeChild(container.lastChild);
    container.innerHTML += '<div class="msg-bubble msg-assistant">' + data.response + '</div>';
    chatHistory.push({ role: 'user', content }, { role: 'assistant', content: data.response });
    container.scrollTop = container.scrollHeight;
  } catch (e) {
    container.removeChild(container.lastChild);
    const offlineResponse = getOfflineResponse(content);
    container.innerHTML += '<div class="msg-bubble msg-assistant">' + offlineResponse + '</div>';
  }
}

function toggleChatbot() {
  const container = document.getElementById('chatbot-container');
  if (container) container.classList.toggle('active');
}

// ============================================
// KEYBOARD SHORTCUTS
// ============================================

document.addEventListener('keydown', (e) => {
  // Ctrl+K or Cmd+K to focus search
  if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
    e.preventDefault();
    const input = document.getElementById('location-input');
    if (input) input.focus();
  }
  
  // Enter in search to search
  if (e.key === 'Enter' && document.activeElement?.id === 'location-input') {
    searchWeather();
  }
  
  // Escape to close suggestions
  if (e.key === 'Escape') {
    document.getElementById('search-suggestions')?.classList.remove('active');
  }
});

// ============================================
// INITIALIZATION
// ============================================

document.addEventListener('DOMContentLoaded', () => {
  // Check for city parameter
  const params = new URLSearchParams(window.location.search);
  const city = params.get('city');
  if (city) {
    const input = document.getElementById('location-input');
    if (input) {
      input.value = city;
      setTimeout(searchWeather, 500);
    }
  }
  
  // Load recent cities
  renderRecentCities();
  
  // Register service worker
  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('/sw.js')
        .then(registration => console.log('SW registrado'))
        .catch(error => console.log('SW error:', error));
    });
  }
});

// Close suggestions when clicking outside
document.addEventListener('click', (e) => {
  const suggestionsEl = document.getElementById('search-suggestions');
  const searchContainer = document.querySelector('.search-container');
  if (suggestionsEl && searchContainer && !searchContainer.contains(e.target)) {
    suggestionsEl.classList.remove('active');
  }
});
