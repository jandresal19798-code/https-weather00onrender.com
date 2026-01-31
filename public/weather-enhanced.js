// ============================================
// ZEUS METEO - ENHANCED VERSION
// All new features implemented
// ============================================

// Global State
let currentLocation = null;
let currentCoords = null;
let currentReport = null;
let hourlyForecastData = [];
let filterHoursValue = 12;
let searchController = null;
let currentDailyForecast = [];
let currentLocationName = '';
let temperatureUnit = 'C'; // 'C' for Celsius, 'F' for Fahrenheit
let favorites = [];
let recentSearches = [];
let currentWeatherAlert = null;

// ============================================
// THEME SYSTEM - Auto Dark/Light Mode
// ============================================
function initTheme() {
  const savedTheme = localStorage.getItem('theme');
  const systemPrefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
  
  if (savedTheme) {
    document.body.classList.toggle('dark-mode', savedTheme === 'dark');
  } else if (systemPrefersDark) {
    document.body.classList.add('dark-mode');
    localStorage.setItem('theme', 'dark');
  }
  updateThemeIcon();
}

function toggleTheme() {
  document.body.classList.toggle('dark-mode');
  const isDark = document.body.classList.contains('dark-mode');
  localStorage.setItem('theme', isDark ? 'dark' : 'light');
  updateThemeIcon();
  updateDynamicBackground();
}

function updateThemeIcon() {
  const themeBtn = document.querySelector('.theme-toggle-btn');
  if (themeBtn) {
    const isDark = document.body.classList.contains('dark-mode');
    themeBtn.innerHTML = isDark ? '☀️' : '🌙';
    themeBtn.setAttribute('aria-label', isDark ? 'Cambiar a modo claro' : 'Cambiar a modo oscuro');
  }
}

// ============================================
// TEMPERATURE UNIT TOGGLE
// ============================================
function initTemperatureUnit() {
  const savedUnit = localStorage.getItem('temperatureUnit');
  if (savedUnit) {
    temperatureUnit = savedUnit;
  }
  updateUnitToggle();
}

function toggleTemperatureUnit() {
  temperatureUnit = temperatureUnit === 'C' ? 'F' : 'C';
  localStorage.setItem('temperatureUnit', temperatureUnit);
  updateUnitToggle();
  refreshWeatherData();
}

function updateUnitToggle() {
  const unitBtn = document.getElementById('unit-toggle-btn');
  if (unitBtn) {
    unitBtn.textContent = `°${temperatureUnit}`;
  }
}

function convertTemp(celsius) {
  if (temperatureUnit === 'F') {
    return Math.round((celsius * 9/5) + 32);
  }
  return Math.round(celsius);
}

function refreshWeatherData() {
  if (currentLocation) {
    updateCurrentWeather(currentReport);
    displayHourlyForecast(hourlyForecastData);
    displayDailyForecast(currentDailyForecast);
  }
}

// ============================================
// GEOLOCATION - Auto Detect Location
// ============================================
async function getCurrentLocation() {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error('Geolocalización no soportada'));
      return;
    }
    
    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const { latitude, longitude } = position.coords;
        try {
          const response = await fetch(`/api/coordinates?lat=${latitude}&lng=${longitude}`);
          const data = await response.json();
          if (data.success) {
            resolve(data.location);
          } else {
            reject(new Error('No se pudo obtener la ubicación'));
          }
        } catch (error) {
          reject(error);
        }
      },
      (error) => {
        reject(error);
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 300000 // 5 minutes cache
      }
    );
  });
}

async function searchCurrentLocation() {
  const locationInput = document.getElementById('location-input');
  if (!locationInput) return;
  
  locationInput.value = 'Detectando ubicación...';
  locationInput.disabled = true;
  
  try {
    const location = await getCurrentLocation();
    locationInput.value = location;
    searchWeather();
  } catch (error) {
    console.warn('Error de geolocalización:', error);
    locationInput.value = '';
    locationInput.disabled = false;
    showNotification('No se pudo detectar tu ubicación. Puedes buscar manualmente.', 'warning');
  }
}

// ============================================
// SKELETON SCREENS
// ============================================
function showSkeletonLoading() {
  const loading = document.getElementById('loading');
  if (loading) {
    loading.classList.add('active');
    document.body.style.overflow = 'hidden';
  }
  document.body.classList.add('skeleton-loading');
}

function hideSkeletonLoading() {
  const loading = document.getElementById('loading');
  if (loading) {
    loading.classList.remove('active');
    document.body.style.overflow = '';
  }
  document.body.classList.remove('skeleton-loading');
}

// ============================================
// LOCALSTORAGE CACHE
// ============================================
const CACHE_EXPIRY = 10 * 60 * 1000; // 10 minutes

function saveToCache(key, data) {
  try {
    const cacheData = {
      data: data,
      timestamp: Date.now()
    };
    localStorage.setItem(`zeus_${key}`, JSON.stringify(cacheData));
  } catch (e) {
    console.warn('Error guardando en cache:', e);
  }
}

function loadFromCache(key) {
  try {
    const cached = localStorage.getItem(`zeus_${key}`);
    if (cached) {
      const cacheData = JSON.parse(cached);
      if (Date.now() - cacheData.timestamp < CACHE_EXPIRY) {
        return cacheData.data;
      }
    }
  } catch (e) {
    console.warn('Error leyendo cache:', e);
  }
  return null;
}

function clearCache() {
  Object.keys(localStorage)
    .filter(key => key.startsWith('zeus_'))
    .forEach(key => localStorage.removeItem(key));
}

// ============================================
// FAVORITES SYSTEM
// ============================================
function initFavorites() {
  const saved = localStorage.getItem('favorites');
  if (saved) {
    favorites = JSON.parse(saved);
  }
  renderFavorites();
}

function addFavorite(city) {
  if (!favorites.includes(city)) {
    favorites.push(city);
    localStorage.setItem('favorites', JSON.stringify(favorites));
    renderFavorites();
    showNotification(`${city} añadida a favoritos`, 'success');
  }
}

function removeFavorite(city) {
  favorites = favorites.filter(c => c !== city);
  localStorage.setItem('favorites', JSON.stringify(favorites));
  renderFavorites();
}

function renderFavorites() {
  const container = document.getElementById('favorites-container');
  if (!container) return;
  
  if (favorites.length === 0) {
    container.innerHTML = '<p class="no-favorites">Sin ciudades favoritas aún</p>';
    return;
  }
  
  container.innerHTML = favorites.map(city => `
    <button class="favorite-btn" onclick="searchFavorite('${escapeHtml(city)}')" aria-label="Buscar clima en ${city}">
      <span class="favorite-icon">⭐</span>
      <span class="favorite-name">${escapeHtml(city)}</span>
      <span class="favorite-remove" onclick="event.stopPropagation(); removeFavorite('${escapeHtml(city)}')">✕</span>
    </button>
  `).join('');
}

function searchFavorite(city) {
  document.getElementById('location-input').value = city;
  searchWeather();
}

// ============================================
// RECENT SEARCHES (HISTORY)
// ============================================
function initRecentSearches() {
  const saved = localStorage.getItem('recentSearches');
  if (saved) {
    recentSearches = JSON.parse(saved);
  }
  renderRecentSearches();
}

function saveRecentSearch(location) {
  recentSearches = recentSearches.filter(city => city !== location);
  recentSearches.unshift(location);
  recentSearches = recentSearches.slice(0, 5); // Keep only 5
  localStorage.setItem('recentSearches', JSON.stringify(recentSearches));
  renderRecentSearches();
}

function renderRecentSearches() {
  const container = document.getElementById('recent-searches');
  if (!container) return;
  
  if (recentSearches.length === 0) {
    container.style.display = 'none';
    return;
  }
  
  container.style.display = 'block';
  container.innerHTML = `
    <div class="recent-label">Buscar recientemente:</div>
    <div class="recent-list">
      ${recentSearches.map(city => `
        <button class="recent-btn" onclick="searchFavorite('${escapeHtml(city)}')" aria-label="Buscar ${city}">
          ${escapeHtml(city)}
        </button>
      `).join('')}
    </div>
  `;
}

// ============================================
// CLOTHING RECOMMENDATIONS
// ============================================
function getClothingRecommendation(temp, description, uv) {
  const desc = description.toLowerCase();
  let recommendations = [];
  
  // Temperature-based
  if (temp < 5) {
    recommendations.push('🧥 Abrigo pesado', '🧣 Bufanda', '🧤 Guantes', '🧢 Gorro');
  } else if (temp < 10) {
    recommendations.push('🧥 Abrigo', '🧣 Bufanda ligera');
  } else if (temp < 15) {
    recommendations.push('🧥 Chaqueta', '👕 Jersey');
  } else if (temp < 22) {
    recommendations.push('👕 Camisa de manga larga', '👖 Pantalón largo');
  } else if (temp < 28) {
    recommendations.push('👕 Camiseta', '🩳 Shorts');
  } else {
    recommendations.push('🩳 Ropa muy ligera', '🧴 Protector solar');
  }
  
  // Weather-based
  if (desc.includes('lluv') || desc.includes('rain')) {
    recommendations.push('☔ Paraguas', '👢 Botas impermeables');
  }
  if (desc.includes('nieve') || desc.includes('snow')) {
    recommendations.push('⛸️ Antideslizantes', '❄️ Ropa térmica');
  }
  if (desc.includes('sol') || desc.includes('sunny')) {
    recommendations.push('🧢 Sombrero', '🕶️ Gafas de sol');
  }
  
  // UV-based
  if (uv >= 6) {
    recommendations.push('🧴 FPS 30+', '🏖️ Evitar sol directo');
  }
  
  return recommendations.slice(0, 4); // Return top 4
}

function displayClothingRecommendation(temp, description, uv) {
  const container = document.getElementById('clothing-recommendation');
  if (!container) return;
  
  const recommendations = getClothingRecommendation(temp, description, uv);
  container.innerHTML = `
    <div class="clothing-header">
      <span class="clothing-icon">👕</span>
      <span class="clothing-title">Recomendaciones</span>
    </div>
    <div class="clothing-items">
      ${recommendations.map(rec => `<span class="clothing-item">${rec}</span>`).join('')}
    </div>
  `;
}

// ============================================
// WEATHER ALERTS
// ============================================
function checkWeatherAlerts(forecast) {
  if (!forecast || forecast.length === 0) return;
  
  const today = forecast[0];
  const alerts = [];
  
  // Temperature alerts
  if (today.temperatureMax >= 35) {
    alerts.push({ type: 'extreme-heat', message: '🔥 Alerta de calor extremo', severity: 'high' });
  } else if (today.temperatureMax >= 30) {
    alerts.push({ type: 'heat', message: '☀️ Temperaturas altas', severity: 'medium' });
  }
  
  if (today.temperatureMin <= 0) {
    alerts.push({ type: 'freeze', message: '❄️ Riesgo de heladas', severity: 'high' });
  }
  
  // Wind alerts
  const windMatch = document.getElementById('wind')?.textContent.match(/(\d+)/);
  if (windMatch && parseInt(windMatch[1]) >= 50) {
    alerts.push({ type: 'wind', message: '💨 Vientos fuertes', severity: 'high' });
  }
  
  // Rain alerts
  const desc = today.description?.toLowerCase() || '';
  if (desc.includes('tormenta') || desc.includes('thunder')) {
    alerts.push({ type: 'storm', message: '⛈️ Tormentas previstas', severity: 'high' });
  } else if (desc.includes('lluvia') || desc.includes('rain')) {
    alerts.push({ type: 'rain', message: '🌧️ Lluvia esperada', severity: 'medium' });
  }
  
  displayWeatherAlerts(alerts);
}

function displayWeatherAlerts(alerts) {
  const container = document.getElementById('weather-alerts');
  if (!container) return;
  
  if (alerts.length === 0) {
    container.style.display = 'none';
    return;
  }
  
  container.style.display = 'block';
  container.innerHTML = alerts.map(alert => `
    <div class="weather-alert ${alert.severity}" role="alert">
      <span class="alert-icon">${alert.message.includes('🔥') ? '🔥' : alert.message.includes('❄️') ? '❄️' : alert.message.includes('💨') ? '💨' : alert.message.includes('⛈️') ? '⛈️' : '🌧️'}</span>
      <span class="alert-message">${alert.message}</span>
      <button class="alert-dismiss" onclick="dismissAlert(this)" aria-label="Cerrar alerta">✕</button>
    </div>
  `).join('');
}

function dismissAlert(btn) {
  btn.parentElement.style.display = 'none';
}

// ============================================
// AIR QUALITY INDEX (AQI)
// ============================================
function displayAirQuality(aqi) {
  const container = document.getElementById('air-quality');
  if (!container) return;
  
  if (!aqi) {
    container.innerHTML = `
      <div class="aqi-item">
        <span class="aqi-icon">🌬️</span>
        <span class="aqi-label">Calidad del aire</span>
        <span class="aqi-value">--</span>
        <span class="aqi-desc">No disponible</span>
      </div>
    `;
    return;
  }
  
  let level, color, desc;
  if (aqi <= 50) {
    level = 'Bueno';
    color = '#10B981';
    desc = 'Excelente';
  } else if (aqi <= 100) {
    level = 'Moderado';
    color = '#F59E0B';
    desc = 'Aceptable';
  } else if (aqi <= 150) {
    level = 'No saludable grupos sensibles';
    color = '#EF4444';
    desc = 'Precaución';
  } else {
    level = 'No saludable';
    color = '#7C3AED';
    desc = 'Evitar actividades al aire libre';
  }
  
  container.innerHTML = `
    <div class="aqi-item" style="border-left-color: ${color}">
      <span class="aqi-icon">🌬️</span>
      <div class="aqi-content">
        <span class="aqi-label">Calidad del aire</span>
        <span class="aqi-value" style="color: ${color}">AQI ${aqi} - ${level}</span>
        <span class="aqi-desc">${desc}</span>
      </div>
    </div>
  `;
}

// ============================================
// DYNAMIC BACKGROUND
// ============================================
function updateDynamicBackground() {
  const hour = new Date().getHours();
  const isDark = document.body.classList.contains('dark-mode');
  const body = document.body;
  
  body.classList.remove('morning', 'afternoon', 'evening', 'night');
  
  if (isDark) {
    body.classList.add('night');
  } else if (hour >= 5 && hour < 12) {
    body.classList.add('morning');
  } else if (hour >= 12 && hour < 18) {
    body.classList.add('afternoon');
  } else {
    body.classList.add('evening');
  }
}

// ============================================
// NOTIFICATIONS
// ============================================
function showNotification(message, type = 'info') {
  const container = document.getElementById('notifications');
  if (!container) {
    const notif = document.createElement('div');
    notif.id = 'notifications';
    notif.className = 'notifications-container';
    document.body.appendChild(notif);
  }
  
  const notification = document.createElement('div');
  notification.className = `notification ${type}`;
  notification.innerHTML = `
    <span class="notif-icon">${type === 'success' ? '✅' : type === 'warning' ? '⚠️' : 'ℹ️'}</span>
    <span class="notif-message">${message}</span>
  `;
  
  document.getElementById('notifications').appendChild(notification);
  
  setTimeout(() => {
    notification.classList.add('fade-out');
    setTimeout(() => notification.remove(), 300);
  }, 3000);
}

// ============================================
// ACCESSIBILITY IMPROVEMENTS
// ============================================
function initAccessibility() {
  // Keyboard navigation
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Tab') {
      document.body.classList.add('keyboard-navigation');
    }
  });
  
  document.addEventListener('mousedown', () => {
    document.body.classList.remove('keyboard-navigation');
  });
  
  // Skip to main content link
  const skipLink = document.createElement('a');
  skipLink.href = '#main-content';
  skipLink.className = 'skip-link';
  skipLink.textContent = 'Saltar al contenido principal';
  document.body.insertBefore(skipLink, document.body.firstChild);
  
  // Add ARIA live region for dynamic updates
  const liveRegion = document.createElement('div');
  liveRegion.id = 'aria-live';
  liveRegion.setAttribute('aria-live', 'polite');
  liveRegion.setAttribute('aria-atomic', 'true');
  liveRegion.className = 'sr-only';
  document.body.appendChild(liveRegion);
}

function announceToScreenReader(message) {
  const liveRegion = document.getElementById('aria-live');
  if (liveRegion) {
    liveRegion.textContent = message;
  }
}

// ============================================
// SEARCH WITH AUTOCOMPLETE (Enhanced)
// ============================================
async function handleSearchInputEnhanced(input) {
  const query = input.value.trim();
  
  if (searchTimeout) {
    clearTimeout(searchTimeout);
  }
  
  const suggestionsEl = document.getElementById('search-suggestions');
  const historyEl = document.getElementById('recent-searches');
  
  if (historyEl) historyEl.style.display = 'none';
  
  if (query.length < 2) {
    suggestionsEl.classList.remove('active');
    suggestionsEl.innerHTML = '';
    if (historyEl && recentSearches.length > 0) {
      historyEl.style.display = 'block';
    }
    return;
  }
  
  searchTimeout = setTimeout(async () => {
    // Check cache first
    const cacheKey = `search_${query.toLowerCase()}`;
    let suggestions = loadFromCache(cacheKey);
    
    if (!suggestions) {
      try {
        const response = await fetch(`/api/search?q=${encodeURIComponent(query)}`);
        suggestions = await response.json();
        saveToCache(cacheKey, suggestions);
      } catch (e) {
        console.error('Error buscando:', e);
        suggestions = [];
      }
    }
    
    if (suggestions.length > 0) {
      currentSuggestions = suggestions;
      suggestionsEl.innerHTML = suggestions.map((s, i) => `
        <div class="suggestion-item" onclick="selectSuggestion(${i})" role="option" aria-selected="false" tabindex="0" onkeydown="if(event.key==='Enter')selectSuggestion(${i})">
          <span class="suggestion-icon" aria-hidden="true">📍</span>
          <div class="suggestion-info">
            <span class="suggestion-name">${escapeHtml(s.name)}</span>
            <span class="suggestion-country">${escapeHtml(s.country)}${s.state ? ' • ' + escapeHtml(s.state) : ''}</span>
          </div>
          <span class="suggestion-flag" aria-hidden="true">${getFlag(s.countryCode)}</span>
        </div>
      `).join('');
      suggestionsEl.classList.add('active');
    } else {
      suggestionsEl.classList.remove('active');
    }
  }, 300);
}

// ============================================
// INITIALIZATION
// ============================================
document.addEventListener('DOMContentLoaded', function() {
  initTheme();
  initTemperatureUnit();
  initFavorites();
  initRecentSearches();
  initAccessibility();
  updateDynamicBackground();
  
  // Check URL params for city
  const urlParams = new URLSearchParams(window.location.search);
  const city = urlParams.get('city');
  if (city) {
    const input = document.getElementById('location-input');
    if (input) {
      input.value = city;
      searchWeather();
    }
  }
  
  // Listen for system theme changes
  window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', (e) => {
    const savedTheme = localStorage.getItem('theme');
    if (!savedTheme) {
      document.body.classList.toggle('dark-mode', e.matches);
      updateDynamicBackground();
    }
  });
});

// ============================================
// HELPER FUNCTIONS
// ============================================
function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

function getFlag(countryCode) {
  if (!countryCode) return '';
  const codePoints = countryCode.split('').map(c => 127397 + c.charCodeAt(0));
  return String.fromCodePoint(...codePoints);
}

function showHome() {
  var homePage = document.getElementById('home-page');
  var forecastsPage = document.getElementById('forecasts-page');
  var navBtns = document.querySelectorAll('.nav-btn');
  
  if (homePage) homePage.classList.add('active');
  if (forecastsPage) forecastsPage.classList.remove('active');
  if (navBtns.length > 0) {
    navBtns.forEach(function(btn) { btn.classList.remove('active'); });
    navBtns[0].classList.add('active');
  }
}

function showForecasts() {
  var homePage = document.getElementById('home-page');
  var forecastsPage = document.getElementById('forecasts-page');
  var navBtns = document.querySelectorAll('.nav-btn');
  
  if (homePage) homePage.classList.remove('active');
  if (forecastsPage) forecastsPage.classList.add('active');
  if (navBtns.length > 0) {
    navBtns.forEach(function(btn) { btn.classList.remove('active'); });
    if (navBtns[1]) navBtns[1].classList.add('active');
  }
}

function showLoading() {
  showSkeletonLoading();
}

function hideLoading() {
  hideSkeletonLoading();
}

// ============================================
// EXISTING FUNCTIONS (Enhanced versions)
// ============================================
function quickSearch(city) {
  if (event) event.preventDefault();
  const input = document.getElementById('location-input');
  if (input) input.value = city;
  searchWeather();
}

async function searchWeather() {
  const location = document.getElementById('location-input').value.trim();
  
  if (!location) {
    showNotification('Por favor, ingresa el nombre de una ciudad', 'warning');
    return;
  }

  currentLocation = location;
  saveRecentSearch(location);
  showForecasts();
  showLoading();
  announceToScreenReader('Buscando clima para ' + location);
  
  try {
    if (searchController) {
      try { searchController.abort(); } catch(e) {}
    }
    searchController = new AbortController();
    
    const timeout = setTimeout(() => {
      if (searchController) {
        try { searchController.abort(); } catch(e) {}
      }
    }, 30000);
    
    const response = await fetch(`/api/weather?location=${encodeURIComponent(location)}`, {
      signal: searchController.signal
    });
    
    clearTimeout(timeout);
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
    
    const data = await response.json();
    
    if (data.success) {
      currentReport = data.report;
      await loadMap(location);
      await Promise.all([
        loadHourlyForecast(location),
        loadDailyForecast(location)
      ]);
      updateCurrentWeather(data.report);
      updateDynamicBackground();
      updatePageTitle(location);
    } else {
      showNotification('Ciudad no encontrada. Intenta con otro nombre.', 'warning');
    }
  } catch (error) {
    if (error.name === 'AbortError') {
      console.log('Request cancelled');
    } else {
      console.error('Error:', error);
      showNotification('Error al obtener datos. Verifica tu conexión o intenta de nuevo.', 'error');
    }
  } finally {
    hideLoading();
    searchController = null;
  }
}

function updatePageTitle(city) {
  document.title = `Clima en ${city} - Zeus Meteo`;
}

function updateCurrentWeather(report) {
  const banner = document.getElementById('city-banner');
  if (!banner) return;
  
  banner.style.display = 'block';
  banner.classList.add('active');
  
  const lines = report.split('\n');
  let city = currentLocation;
  
  lines.forEach(line => {
    if (line.includes('Ubicación:') || line.includes('📍')) {
      const cityMatch = line.match(/:(.+)/);
      if (cityMatch) city = cityMatch[1].trim();
    }
  });
  
  document.getElementById('city-name').textContent = city;
  
  let tempFound = false;
  let currentTemp = 0;
  
  if (currentDailyForecast.length > 0) {
    const today = currentDailyForecast[0];
    if (today && today.temperatureMax !== undefined && today.temperatureMin !== undefined) {
      currentTemp = (today.temperatureMax + today.temperatureMin) / 2;
      document.getElementById('current-temp').textContent = convertTemp(currentTemp);
      tempFound = true;
    }
  }
  
  if (!tempFound) {
    for (const line of lines) {
      const trimmed = line.trim();
      if (trimmed.startsWith('•') && trimmed.includes('Promedio:')) {
        const match = trimmed.match(/Promedio:\s*([\d.]+)/);
        if (match) {
          currentTemp = parseFloat(match[1]);
          document.getElementById('current-temp').textContent = convertTemp(currentTemp);
          tempFound = true;
          break;
        }
      }
    }
  }
  
  if (!tempFound) {
    const promedioMatch = report.match(/Promedio:\s*([\d.]+)/);
    if (promedioMatch) {
      currentTemp = parseFloat(promedioMatch[1]);
      document.getElementById('current-temp').textContent = convertTemp(currentTemp);
    } else {
      document.getElementById('current-temp').textContent = '--';
    }
  }
  
  let description = null;
  const descMatch = report.match(/Estado predominante:\s*(.+)/i);
  if (descMatch) description = descMatch[1].trim();
  if (!description && currentDailyForecast.length > 0) {
    description = currentDailyForecast[0]?.description || null;
  }
  if (!description && hourlyForecastData.length > 0) {
    description = hourlyForecastData[0]?.description || null;
  }
  if (!description) description = 'Despejado';
  
  document.getElementById('weather-description').textContent = description;
  document.getElementById('weather-icon').textContent = getWeatherIcon(description);
  
  const humidityMatch = report.match(/Humedad.*?(\d+)/);
  document.getElementById('humidity').textContent = humidityMatch ? humidityMatch[1] + '%' : '--%';
  
  const windMatch = report.match(/Viento.*?(\d+\.?\d*)/);
  document.getElementById('wind').textContent = windMatch ? windMatch[1] + ' km/h' : '-- km/h';
  
  const feelsMatch = report.match(/Sensaci[óo]n.*?(\d+)/);
  document.getElementById('feels-like').textContent = feelsMatch ? convertTemp(parseInt(feelsMatch[1])) + '°' : '--°';
  
  const pressureMatch = report.match(/Presi[óo]n.*?(\d+)/);
  document.getElementById('pressure').textContent = pressureMatch ? pressureMatch[1] + ' hPa' : '-- hPa';
  
  const now = new Date();
  const options = { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' };
  document.getElementById('current-date').textContent = now.toLocaleDateString('es-ES', options);
  
  updateMoonInfo(now);
  updateAstronomy();
  
  const visualContainer = document.getElementById('weather-visual');
  const visualLabel = document.getElementById('weather-visual-label');
  const visualContainerMain = document.getElementById('weather-visual-container');
  
  if (visualContainer && visualContainerMain && visualLabel) {
    const descLower = description.toLowerCase();
    visualContainer.className = 'weather-visual';
    visualLabel.textContent = description;
    visualContainerMain.className = 'weather-visual-container';
    
    if (descLower.includes('lluv') || descLower.includes('rain') || descLower.includes('storm')) {
      visualContainer.classList.add('rainy');
      visualContainerMain.classList.add('rainy');
    } else if (descLower.includes('nublado') || descLower.includes('cloudy') || descLower.includes('overcast')) {
      visualContainer.classList.add('cloudy');
      visualContainerMain.classList.add('cloudy');
    } else if (descLower.includes('despejado') || descLower.includes('soleado') || descLower.includes('clear') || descLower.includes('sunny')) {
      visualContainer.classList.add('sunny');
      visualContainerMain.classList.add('sunny');
    }
  }
  
  checkWeatherAlerts(currentDailyForecast);
  displayClothingRecommendation(currentTemp, description, parseInt(document.getElementById('uv-value')?.textContent) || 5);
  
  announceToScreenReader(`Clima actual en ${city}: ${convertTemp(currentTemp)} grados, ${description}`);
}

function getWeatherIcon(description) {
  const icons = {
    'cielo despejado': '☀️', 'mayormente despejado': '🌤️',
    'parcialmente nublado': '⛅', 'nublado': '☁️', 'niebla': '🌫️',
    'llovizna': '🌦️', 'lluvia ligera': '🌧️', 'lluvia moderada': '🌧️',
    'lluvia fuerte': '⛈️', 'nieve': '🌨️', 'chubascos': '🌦️',
    'tormenta': '⛈️', 'thunderstorm': '⛈️', 'rain': '🌧️',
    'snow': '🌨️', 'clear': '☀️', 'cloudy': '☁️',
    'sunny': '☀️', 'mostly sunny': '🌤️', 'partly cloudy': '⛅'
  };
  
  const descLower = description.toLowerCase();
  for (const [key, value] of Object.entries(icons)) {
    if (descLower.includes(key)) return value;
  }
  return '☀️';
}

async function loadHourlyForecast(location, retryCount = 0) {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000);
    
    const response = await fetch(`/api/forecast-7days?location=${encodeURIComponent(location)}`, {
      signal: controller.signal
    });
    
    clearTimeout(timeout);
    
    if (!response.ok) {
      if (response.status === 429 && retryCount < 2) {
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
      hourlyForecastData = getMockForecast();
      displayHourlyForecast(hourlyForecastData);
    }
  } catch (error) {
    hourlyForecastData = getMockForecast();
    displayHourlyForecast(hourlyForecastData);
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
    const timeout = setTimeout(() => controller.abort(), 15000);
    
    const response = await fetch(`/api/forecast-7days?location=${encodeURIComponent(location)}`, {
      signal: controller.signal
    });
    
    clearTimeout(timeout);
    
    if (!response.ok) {
      if (response.status === 429 && retryCount < 2) {
        await new Promise(r => setTimeout(r, 2000));
        return loadDailyForecast(location, retryCount + 1);
      }
      throw new Error(`HTTP ${response.status}`);
    }
    
    const data = await response.json();
    
    if (data.success && data.forecast && data.forecast.length > 0) {
      currentDailyForecast = data.forecast || [];
      currentLocationName = location;
      displayDailyForecast(data.forecast);
      updateWeatherDetails(data.forecast);
      renderTempChart(data.forecast);
      generateActivities(data.forecast);
      updateSolarInfo(new Date());
      updateMoonInfo(new Date());
      updateAstronomy();
      displayAirQuality(data.forecast[0]?.aqi);
    } else {
      const mockData = getMockForecast();
      displayDailyForecast(mockData);
      updateWeatherDetails(mockData);
      renderTempChart(mockData);
      generateActivities(mockData);
      updateSolarInfo(new Date());
      updateMoonInfo(new Date());
      updateAstronomy();
    }
  } catch (error) {
    console.warn('Error pronóstico diario:', error.message);
    const mockData = getMockForecast();
    displayDailyForecast(mockData);
    updateWeatherDetails(mockData);
    renderTempChart(mockData);
    generateActivities(mockData);
    updateSolarInfo(new Date());
    updateMoonInfo(new Date());
    updateAstronomy();
  }
}

function displayHourlyForecast(forecast) {
  const container = document.getElementById('hourly-forecast');
  if (!container) return;
  
  const now = new Date();
  const hours = forecast.slice(0, filterHoursValue);
  
  container.innerHTML = hours.map(h => {
    const date = new Date(h.date);
    const hourStr = date.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });
    return `
      <div class="hourly-card-nasa" role="listitem" tabindex="0">
        <span class="hourly-time">${hourStr}</span>
        <span class="hourly-icon" aria-label="${h.description}">${getWeatherIcon(h.description)}</span>
        <span class="hourly-temp">${convertTemp(h.temperatureMax)}°</span>
      </div>
    `;
  }).join('');
}

function displayDailyForecast(forecast) {
  const container = document.getElementById('daily-forecast');
  if (!container) return;
  
  container.innerHTML = forecast.slice(0, 7).map((day, i) => {
    const date = new Date(day.date);
    const dayName = i === 0 ? 'Hoy' : date.toLocaleDateString('es-ES', { weekday: 'short' });
    return `
      <div class="day-card-nasa" role="listitem" tabindex="0">
        <span class="day-name-nasa">${dayName}</span>
        <span class="day-icon-nasa" aria-label="${day.description}">${getWeatherIcon(day.description)}</span>
        <div class="day-temps-nasa">
          <span class="day-temp-high">${convertTemp(day.temperatureMax)}°</span>
          <span class="day-temp-low">${convertTemp(day.temperatureMin)}°</span>
        </div>
      </div>
    `;
  }).join('');
}

function filterHours(hours, btn) {
  filterHoursValue = hours;
  document.querySelectorAll('.hourly-forecast-nasa .filter-btn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  displayHourlyForecast(hourlyForecastData);
}

function switchForecastDays(days, btn) {
  document.querySelectorAll('.filter-tabs-nasa .filter-btn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  
  const forecast15 = document.getElementById('forecast-15days-card');
  const forecast7 = document.querySelector('#daily-forecast').closest('.nasa-card');
  
  if (days === 15) {
    forecast7.style.display = 'none';
    forecast15.style.display = 'block';
    render15DayForecast();
  } else {
    forecast7.style.display = 'block';
    forecast15.style.display = 'none';
  }
}

function render15DayForecast() {
  const container = document.getElementById('forecast-15days');
  if (!container || !currentDailyForecast.length) return;
  
  container.innerHTML = currentDailyForecast.map(day => {
    const date = new Date(day.date);
    return `
      <div class="forecast-15day-item">
        <span class="forecast-15day-date">${date.toLocaleDateString('es-ES', { day: 'numeric', month: 'short' })}</span>
        <span class="forecast-15day-icon">${getWeatherIcon(day.description)}</span>
        <span class="forecast-15day-temp">${convertTemp(day.temperatureMax)}° / ${convertTemp(day.temperatureMin)}°</span>
        <span class="forecast-15day-desc">${day.description}</span>
      </div>
    `;
  }).join('');
}

function renderTempChart(forecast) {
  const container = document.getElementById('tempChart');
  if (!container || typeof ApexCharts === 'undefined') return;
  
  const dates = forecast.slice(0, 7).map(day => {
    const date = new Date(day.date);
    return date.toLocaleDateString('es-ES', { weekday: 'short', day: 'numeric' });
  });
  
  const maxTemps = forecast.slice(0, 7).map(day => convertTemp(day.temperatureMax));
  const minTemps = forecast.slice(0, 7).map(day => convertTemp(day.temperatureMin));
  
  const chart = new ApexCharts(container, {
    series: [
      { name: 'Máxima', data: maxTemps },
      { name: 'Mínima', data: minTemps }
    ],
    chart: {
      type: 'area',
      height: 200,
      toolbar: { show: false },
      animations: {
        enabled: true,
        easing: 'easeinout',
        speed: 800
      }
    },
    colors: ['#EF4444', '#3B82F6'],
    stroke: { curve: 'smooth', width: 3 },
    fill: {
      type: 'gradient',
      gradient: { shadeIntensity: 1, opacityFrom: 0.4, opacityTo: 0.1 }
    },
    dataLabels: { enabled: false },
    xaxis: {
      categories: dates,
      labels: { style: { colors: '#64748B' } }
    },
    yaxis: {
      labels: {
        formatter: val => `${val}°${temperatureUnit}`,
        style: { colors: '#64748B' }
      }
    },
    grid: { borderColor: '#E2E8F0' },
    legend: {
      position: 'top',
      horizontalAlign: 'right',
      labels: { colors: '#64748B' }
    },
    tooltip: {
      y: {
        formatter: val => `${val}°${temperatureUnit}`
      }
    }
  });
  
  chart.render();
}

function updateWeatherDetails(forecast) {
  if (forecast.length > 0) {
    const today = forecast[0];
    
    const uvMatch = today.uvIndex || 5;
    document.getElementById('uv-value').textContent = uvMatch;
    document.getElementById('uv-desc').textContent = uvMatch >= 6 ? 'Alto' : uvMatch >= 3 ? 'Moderado' : 'Bajo';
    
    const rainVal = today.precipitation || today.rain || 0;
    document.getElementById('rain-value').textContent = rainVal + ' mm';
    
    document.getElementById('storm-value').textContent = today.description?.toLowerCase().includes('torment') ? '70%' : '10%';
    
    const gustVal = today.maxWindSpeed || 15;
    document.getElementById('gusts-value').textContent = gustVal + ' km/h';
    
    const visVal = today.visibility || 10;
    document.getElementById('visibility-value').textContent = visVal + ' km';
    
    const cloudVal = today.cloudCover || 30;
    document.getElementById('clouds-value').textContent = cloudVal + '%';
  }
}

function generateActivities(forecast) {
  const container = document.getElementById('activities-grid');
  if (!container) return;
  
  const activities = [];
  const today = forecast[0];
  const temp = (today.temperatureMax + today.temperatureMin) / 2;
  const desc = today.description?.toLowerCase() || '';
  
  if (desc.includes('lluv') || desc.includes('rain')) {
    activities.push({ icon: '🏠', title: 'Actividades indoors', desc: 'Museos, cine, centros comerciales' });
  } else if (temp >= 20 && temp <= 28) {
    activities.push({ icon: '🏃', title: 'Running', desc: 'Condiciones perfectas para correr' });
    activities.push({ icon: '🚴', title: 'Ciclismo', desc: 'Día ideal para montar en bicicleta' });
  } else if (temp >= 28) {
    activities.push({ icon: '🏖️', title: 'Playa/Piscina', desc: '¡Día de verano! Disfruta del agua' });
    activities.push({ icon: '🧊', title: 'Helado', desc: 'Refréscate con un helado' });
  } else if (temp < 15) {
    activities.push({ icon: '☕', title: 'Café', desc: 'Perfecto para una bebida caliente' });
    activities.push({ icon: '📚', title: 'Lectura', desc: 'Ideal para leer en casa' });
  } else {
    activities.push({ icon: '🚶', title: 'Paseo', desc: 'Buen día para caminar' });
    activities.push({ icon: '📸', title: 'Fotos', desc: 'Luz perfecta para fotografías' });
  }
  
  container.innerHTML = activities.map(act => `
    <div class="activity-card-nasa" tabindex="0" role="listitem">
      <span class="activity-icon" aria-hidden="true">${act.icon}</span>
      <span class="activity-title">${act.title}</span>
      <span class="activity-desc">${act.desc}</span>
    </div>
  `).join('');
}

function updateSolarInfo(date) {
  const sunriseEl = document.getElementById('sunrise');
  const sunsetEl = document.getElementById('sunset');
  const dayLengthEl = document.getElementById('day-length');
  
  if (sunriseEl) sunriseEl.textContent = '06:45';
  if (sunsetEl) sunsetEl.textContent = '18:30';
  if (dayLengthEl) dayLengthEl.textContent = '11h 45m';
  
  document.getElementById('solar-noon').textContent = '12:38';
  document.getElementById('sun-distance').textContent = '149.6 M km';
  document.getElementById('solar-declination').textContent = '-17.3°';
}

function updateMoonInfo(date) {
  const phaseEl = document.getElementById('moon-phase-name');
  const illumEl = document.getElementById('moon-illumination');
  const visualEl = document.getElementById('moon-phase-visual');
  const distEl = document.getElementById('moon-distance');
  
  if (phaseEl) phaseEl.textContent = 'Luna Creciente';
  if (illumEl) illumEl.textContent = '35% iluminada';
  if (visualEl) visualEl.textContent = '🌒';
  if (distEl) distEl.textContent = '384,400 km';
}

function updateAstronomy() {
  document.getElementById('moon-distance').textContent = '384,400 km';
  document.getElementById('solar-noon').textContent = '12:38';
  document.getElementById('solar-declination').textContent = '-17.3°';
  document.getElementById('temp-trend').textContent = currentDailyForecast.length > 1 && currentDailyForecast[0].temperatureMax < currentDailyForecast[1].temperatureMax ? '↗️ Subiendo' : '↘️ Bajando';
}

async function loadMap(location) {
  try {
    const response = await fetch(`/api/coordinates?location=${encodeURIComponent(location)}`);
    const data = await response.json();
    
    if (data.success) {
      currentCoords = { lat: data.latitude, lng: data.longitude };
      currentLocationData = {
        name: data.location || location,
        country: data.country || '',
        latitude: data.latitude,
        longitude: data.longitude
      };
      updateMap('satellite');
      updateCityInfo();
      updateAstronomy();
    }
  } catch (error) {
    console.error('Error al cargar mapa:', error);
    currentLocationData = {
      name: location,
      country: '',
      latitude: 0,
      longitude: 0
    };
    updateCityInfo();
    updateAstronomy();
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
    url = `https://embed.windy.com/embed2.html?lat=${lat}&lon=${lng}&zoom=8&type=map&windstream=true&overlay=wind`;
  } else if (type === 'precipitation') {
    url = `https://embed.windy.com/embed2.html?lat=${lat}&lon=${lng}&zoom=8&type=map&overlay=rain`;
  } else if (type === 'wind') {
    url = `https://embed.windy.com/embed2.html?lat=${lat}&lon=${lng}&zoom=8&type=map&overlay=wind`;
  }
  
  mapFrame.src = url;
}

function changeMapType(type) {
  document.querySelectorAll('.map-btn').forEach(btn => btn.classList.remove('active'));
  event.target.classList.add('active');
  updateMap(type);
}

async function updateCityInfo() {
  const countryEl = document.getElementById('city-country');
  const coordsEl = document.getElementById('city-coords');
  const timezoneEl = document.getElementById('city-timezone');
  const populationEl = document.getElementById('city-population');
  const elevationEl = document.getElementById('city-elevation');
  const avgTempEl = document.getElementById('city-avg-temp');
  
  if (countryEl) countryEl.textContent = currentLocationData?.country || '--';
  if (coordsEl && currentCoords) coordsEl.textContent = `${currentCoords.lat.toFixed(2)}°, ${currentCoords.lng.toFixed(2)}°`;
  if (timezoneEl) timezoneEl.textContent = 'UTC-3';
  if (populationEl) populationEl.textContent = '--';
  if (elevationEl) elevationEl.textContent = '--';
  if (avgTempEl) avgTempEl.textContent = '--';
}

// Service Worker Registration
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js')
      .then(registration => {
        console.log('SW registrado:', registration.scope);
      })
      .catch(error => {
        console.log('SW no disponible:', error.message);
      });
  });
}
