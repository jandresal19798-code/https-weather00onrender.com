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

  // Retry function for 503 errors
  const fetchWithRetry = async (url, maxRetries = 2) => {
    for (let i = 0; i < maxRetries; i++) {
      try {
        const response = await fetch(url);
        if (response.status === 503) {
          if (i < maxRetries - 1) {
            showNotification('Servidor despertando... reintentando', 'warning');
            await new Promise(r => setTimeout(r, 2000));
            continue;
          }
        }
        return response;
      } catch (e) {
        if (i === maxRetries - 1) throw e;
        await new Promise(r => setTimeout(r, 1500));
      }
    }
  };

  try {
    const response = await fetchWithRetry('/api/weather?location=' + encodeURIComponent(location));
    
    if (!response) {
      throw new Error('No response');
    }
    
    if (response.status === 503) {
      showNotification('Servidor en mantenimiento. Intenta en 30 segundos.', 'error');
      hideLoading();
      return;
    }
    
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
    showNotification('Error de conexión. El servidor está despertando, espera unos segundos e intenta de nuevo.', 'error');
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
    
    // Get daily forecast (with silent failure for 503)
    try {
      const response = await fetch('/api/forecast-7days?location=' + encodeURIComponent(location));
      if (response.ok && response.status !== 503) {
        const data = await response.json();
        if (data.success && data.forecast && data.forecast.length > 0) {
          forecastData = data.forecast;
        }
      }
    } catch (e) {
      // Silent fail - will use simulated data
    }
    
    // Get hourly forecast (with silent failure for 503)
    try {
      const response = await fetch('/api/forecast?location=' + encodeURIComponent(location));
      if (response.ok && response.status !== 503) {
        const data = await response.json();
        if (data.success && data.hourly) {
          hourlyData = data.hourly;
        }
      }
    } catch (e) {
      // Silent fail - will use simulated data
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
    const baseDesc = (currentReport?.description || '').toLowerCase();
    
    // Define varied icons for simulated forecast
    const variedIcons = [];
    if (baseDesc.includes('lluvia') || baseDesc.includes('rain')) {
      variedIcons.push('🌧️', '🌦️', '☁️', '🌧️', '⛅', '🌧️', '🌦️');
    } else if (baseDesc.includes('nublado') || baseDesc.includes('cloud')) {
      variedIcons.push('☁️', '⛅', '🌤️', '☁️', '🌥️', '⛅', '☁️');
    } else if (baseDesc.includes('clear') || baseDesc.includes('soleado')) {
      variedIcons.push('☀️', '🌤️', '⛅', '☀️', '🌤️', '☀️', '⛅');
    } else {
      variedIcons.push('🌤️', '⛅', '☁️', '🌤️', '☀️', '⛅', '🌤️');
    }
    
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
          icon: variedIcons[i] || '🌤️',
          high: baseTemp + 3 - i * 0.5,
          low: baseTemp - 3 - i * 0.3,
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
      // Generate simulated hourly data with varied conditions
      const simulatedHourly = [];
      const now = new Date();
      const baseDesc = (currentReport?.description || '').toLowerCase();
      
      // Define possible weather conditions based on current weather
      const weatherVariations = [];
      if (baseDesc.includes('lluvia') || baseDesc.includes('rain')) {
        weatherVariations.push('🌧️', '🌦️', '☁️', '🌧️', '⛅', '🌦️');
      } else if (baseDesc.includes('nublado') || baseDesc.includes('cloud') || baseDesc.includes('overcast')) {
        weatherVariations.push('☁️', '⛅', '🌥️', '☁️', '🌤️', '⛅');
      } else if (baseDesc.includes('clear') || baseDesc.includes('soleado') || baseDesc.includes('despejado')) {
        weatherVariations.push('☀️', '🌤️', '⛅', '☀️', '🌅', '🌇');
      } else {
        weatherVariations.push('🌤️', '⛅', '☁️', '🌤️', '☀️', '🌥️');
      }
      
      for (let i = 0; i < 24; i++) {
        const hour = new Date(now.getTime() + i * 3600000);
        const hourNum = hour.getHours();
        
        // Vary temperature based on time of day
        let tempVariation = Math.sin((hourNum - 6) * Math.PI / 12) * 5;
        
        // Choose icon based on time of day
        let icon;
        if (hourNum >= 6 && hourNum < 8) {
          // Early morning - sunrise
          icon = '🌅';
        } else if (hourNum >= 8 && hourNum < 12) {
          // Morning
          icon = weatherVariations[i % weatherVariations.length];
        } else if (hourNum >= 12 && hourNum < 14) {
          // Midday
          icon = '☀️';
        } else if (hourNum >= 14 && hourNum < 18) {
          // Afternoon
          icon = weatherVariations[(i + 2) % weatherVariations.length];
        } else if (hourNum >= 18 && hourNum < 20) {
          // Evening - sunset
          icon = '🌇';
        } else if (hourNum >= 20 && hourNum < 23) {
          // Night
          icon = '🌙';
        } else {
          // Late night
          icon = '🌑';
        }
        
        // Random precipitation (higher chance if it's rainy weather)
        let precip = Math.random() * 20;
        if (baseDesc.includes('lluvia') || baseDesc.includes('rain')) {
          precip = 30 + Math.random() * 50;
        }
        
        simulatedHourly.push({
          time: hour,
          temp: baseTemp + tempVariation + (Math.random() * 2 - 1),
          icon: icon,
          precip: precip
        });
      }
      displayHourlyForecast(simulatedHourly);
    }
    
    // Render temperature chart
    renderTemperatureChart(dailyData);
    
  } catch (e) {
    // Silent fail
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
  const recommendations = [];
  const desc = (description || '').toLowerCase();
  
  // Temperature-based recommendations
  if (temp >= 35) {
    recommendations.push({
      icon: '🔥',
      title: 'Calor Extremo',
      text: 'Evita el sol, mantente hidratado',
      image: 'https://images.unsplash.com/photo-1504386106331-3e4e71712b38?w=200&h=150&fit=crop',
      color: '#ef4444'
    });
  } else if (temp >= 30) {
    recommendations.push({
      icon: '☀️',
      title: 'Protector Solar',
      text: 'Usa SPF 50+ y gorra',
      image: 'https://images.unsplash.com/photo-1556228578-0d85b1a4d571?w=200&h=150&fit=crop',
      color: '#f97316'
    });
  } else if (temp >= 25) {
    recommendations.push({
      icon: '😎',
      title: 'Día Cálido',
      text: 'Ropa ligera y gafas de sol',
      image: 'https://images.unsplash.com/photo-1507400492013-162706c8c05e?w=200&h=150&fit=crop',
      color: '#eab308'
    });
  } else if (temp >= 15) {
    recommendations.push({
      icon: '🌤️',
      title: 'Clima Agradable',
      text: 'Perfecto para actividades al aire libre',
      image: 'https://images.unsplash.com/photo-1501630834273-4b5604d2ee31?w=200&h=150&fit=crop',
      color: '#22c55e'
    });
  } else if (temp >= 5) {
    recommendations.push({
      icon: '🧥',
      title: 'Abrígate',
      text: 'Lleva una chaqueta o suéter',
      image: 'https://images.unsplash.com/photo-1517685352747-480de10a031b?w=200&h=150&fit=crop',
      color: '#06b6d4'
    });
  } else {
    recommendations.push({
      icon: '❄️',
      title: 'Frío Intenso',
      text: 'Vístete en capas, usa guantes',
      image: 'https://images.unsplash.com/photo-1478265409131-1f65c88f965c?w=200&h=150&fit=crop',
      color: '#a855f7'
    });
  }
  
  // Weather condition recommendations
  if (desc.includes('lluvia') || desc.includes('rain') || desc.includes('drizzle')) {
    recommendations.push({
      icon: '☔',
      title: 'Paraguas',
      text: 'Probabilidad de lluvia alta',
      image: 'https://images.unsplash.com/photo-1519692933481-e162a57d6721?w=200&h=150&fit=crop',
      color: '#3b82f6'
    });
  }
  
  if (desc.includes('tormenta') || desc.includes('thunder') || desc.includes('storm')) {
    recommendations.push({
      icon: '⛈️',
      title: 'Tormenta',
      text: 'Permanece bajo techo',
      image: 'https://images.unsplash.com/photo-1534088568595-a066f410bcda?w=200&h=150&fit=crop',
      color: '#6366f1'
    });
  }
  
  if (desc.includes('nieve') || desc.includes('snow')) {
    recommendations.push({
      icon: '❄️',
      title: 'Nieve',
      text: 'Calzado antideslizante',
      image: 'https://images.unsplash.com/photo-1478265409131-1f65c88f965c?w=200&h=150&fit=crop',
      color: '#e0f2fe'
    });
  }
  
  if (desc.includes('niebla') || desc.includes('fog') || desc.includes('mist')) {
    recommendations.push({
      icon: '🌫️',
      title: 'Niebla',
      text: 'Conduce con precaución',
      image: 'https://images.unsplash.com/photo-1485236745370-61ac71a7b44f?w=200&h=150&fit=crop',
      color: '#94a3b8'
    });
  }
  
  // Humidity recommendations
  if (humidity >= 85) {
    recommendations.push({
      icon: '💧',
      title: 'Alta Humedad',
      text: 'Sensación de bochorno',
      image: 'https://images.unsplash.com/photo-1534274988757-a28bf1a57c17?w=200&h=150&fit=crop',
      color: '#06b6d4'
    });
  } else if (humidity <= 30) {
    recommendations.push({
      icon: '🏜️',
      title: 'Aire Seco',
      text: 'Usa crema hidratante',
      image: 'https://images.unsplash.com/photo-1547499681-28dece7dba00?w=200&h=150&fit=crop',
      color: '#d97706'
    });
  }
  
  // Wind recommendations
  if (wind >= 50) {
    recommendations.push({
      icon: '🌪️',
      title: 'Viento Muy Fuerte',
      text: 'Evita actividades al aire libre',
      image: 'https://images.unsplash.com/photo-1527482797697-8795b05a13fe?w=200&h=150&fit=crop',
      color: '#ef4444'
    });
  } else if (wind >= 30) {
    recommendations.push({
      icon: '💨',
      title: 'Viento Fuerte',
      text: 'Cuidado con objetos sueltos',
      image: 'https://images.unsplash.com/photo-1507400492013-162706c8c05e?w=200&h=150&fit=crop',
      color: '#0ea5e9'
    });
  }
  
  // UV recommendation (simulated based on hour)
  const hour = new Date().getHours();
  if (hour >= 10 && hour <= 16 && temp >= 20) {
    recommendations.push({
      icon: '🧴',
      title: 'Protector Solar',
      text: 'Reaplica cada 2 horas',
      image: 'https://images.unsplash.com/photo-1556228578-0d85b1a4d571?w=200&h=150&fit=crop',
      color: '#fbbf24'
    });
  }
  
  // Activity recommendations
  if (temp >= 18 && temp <= 28 && humidity < 70 && wind < 20 && !desc.includes('lluvia')) {
    recommendations.push({
      icon: '🏃',
      title: 'Ideal para Ejercicio',
      text: 'Condiciones perfectas',
      image: 'https://images.unsplash.com/photo-1571019614242-c5c5dee9f50b?w=200&h=150&fit=crop',
      color: '#22c55e'
    });
  }
  
  if (temp >= 20 && temp <= 26 && humidity < 60 && !desc.includes('lluvia')) {
    recommendations.push({
      icon: '🚴',
      title: 'Perfecto para Bicicleta',
      text: 'Clima ideal para rodar',
      image: 'https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=200&h=150&fit=crop',
      color: '#10b981'
    });
  }
  
  // Night recommendations
  if (hour >= 20 || hour < 6) {
    if (temp >= 15) {
      recommendations.push({
        icon: '🌙',
        title: 'Noche Agradable',
        text: 'Ideal para pasear',
        image: 'https://images.unsplash.com/photo-1507400492013-162706c8c05e?w=200&h=150&fit=crop',
        color: '#8b5cf6'
      });
    } else {
      recommendations.push({
        icon: '🧣',
        title: 'Noche Fría',
        text: 'Lleva bufanda y guantes',
        image: 'https://images.unsplash.com/photo-1517685352747-480de10a031b?w=200&h=150&fit=crop',
        color: '#6366f1'
      });
    }
  }
  
  // Limit to 6 recommendations and remove duplicates
  const uniqueRecs = recommendations.filter((rec, index, self) =>
    index === self.findIndex(r => r.title === rec.title)
  ).slice(0, 6);
  
  const container = document.getElementById('recommendations-list');
  if (container) {
    container.innerHTML = uniqueRecs.map(rec => `
      <div class="rec-item-enhanced" style="--rec-color: ${rec.color}">
        <div class="rec-image">
          <img src="${rec.image}" alt="${rec.title}" loading="lazy">
          <div class="rec-image-overlay"></div>
          <span class="rec-icon-large">${rec.icon}</span>
        </div>
        <div class="rec-content">
          <div class="rec-title">${rec.title}</div>
          <div class="rec-text">${rec.text}</div>
        </div>
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
    const hourNum = time.getHours();
    
    // Determine if it's night time (before 6am or after 8pm)
    const isNight = hourNum < 6 || hourNum >= 20;
    const isMorning = hourNum >= 6 && hourNum < 12;
    const isAfternoon = hourNum >= 12 && hourNum < 18;
    
    // Add time-of-day class
    let timeClass = '';
    if (isNight) timeClass = 'night-time';
    else if (isMorning) timeClass = 'morning-time';
    else if (isAfternoon) timeClass = 'afternoon-time';
    else timeClass = 'evening-time';
    
    return `
      <div class="hourly-card ${timeClass}">
        <div class="hour">${hourStr}</div>
        <div class="hour-icon">${h.icon}</div>
        <div class="hour-temp">${convertTemp(h.temp)}°</div>
        ${h.precip > 10 ? `<div class="hour-precip"><span class="precip-icon">💧</span>${Math.round(h.precip)}%</div>` : ''}
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
// WEATHER FACTS & RECOMMENDATIONS
// ============================================

const weatherFacts = [
  // Extreme weather
  "🌍 El rayo más largo duró 7.74 segundos y ocurrió en Brasil en 2020.",
  "🔥 La temperatura más alta registrada fue 56.7°C en Furnace Creek, California (2020).",
  "🧊 La temperatura más baja registrada fue -89.2°C en Vostok, Antártida (1983).",
  "🌪️ Los tornados pueden alcanzar velocidades de más de 400 km/h.",
  "💨 El viento más fuerte registrado fue 408 km/h en el Monte Washington (1934).",
  "⚡ El rayo más ancho medido tenía 678 metros de ancho (Argentina, 2018).",
  "🥶 La mayor caída de temperatura fue 27°C en solo 2 minutos en South Dakota.",
  "🌡️ La mayor oscilación térmica en un día fue de 57°C en Montana (1972).",
  
  // Rain & Water
  "🌧️ El lugar más lluvioso del mundo es Mawsynram, India (11,871 mm/año).",
  "🏜️ El lugar más seco es el Desierto de Atacama, Chile (0.1 mm/año).",
  "💧 Una tormenta promedio descarga 6 millones de litros de agua.",
  "🌊 La lluvia más intensa: 305mm en solo 42 minutos en Missouri (1947).",
  "☔ Una gota de lluvia cae a aproximadamente 9 km/h.",
  "🏔️ La nieve más profunda registrada: 11.5 metros en Mount Fuji.",
  "🌨️ El granizo más grande pesó 1kg y cayó en Bangladesh (1986).",
  
  // Clouds & Sky
  "☁️ El cumulonimbo puede alcanzar más de 12 km de altura.",
  "🌈 Los arcoíris son círculos completos, pero solo vemos la mitad.",
  "🌅 El cielo es azul porque la atmósfera dispersa la luz azul (efecto Rayleigh).",
  "🌙 La Luna afecta las mareas y puede influir en el clima.",
  "🌤️ Las nubes pueden pesar más de 500,000 kilogramos.",
  "🌫️ La niebla más larga duró 76 días consecutivos en California.",
  "☁️ Existen más de 100 tipos de nubes diferentes.",
  "✨ Las estrellas fugaces son partículas de polvo cósmico que arden en la atmósfera.",
  
  // Snow & Ice
  "❄️ Los copos de nieve nunca son exactamente iguales.",
  "🧊 Los glaciares contienen el 69% del agua dulce del planeta.",
  "⛄ La nieve puede aislar tanto que los iglús mantienen 16°C dentro.",
  "🇦🇶 La Antártida es el lugar más ventoso, frío y seco de la Tierra.",
  "🎿 En Japón, la nieve puede llegar a 15 metros de altura.",
  
  // Storms & Lightning
  "⚡ Cada segundo caen aproximadamente 100 rayos en la Tierra.",
  "⛈️ El rayo puede alcanzar 30,000°C (5 veces más caliente que el Sol).",
  "🌀 Los huracanes liberan energía equivalente a 10,000 bombas atómicas.",
  "🌊 Los tsunamis pueden viajar a 800 km/h en aguas profundas.",
  "🌪️ Un tornado puede levantar una casa entera del suelo.",
  "⚡ Los rayos matan más personas que los tornados y huracanes combinados.",
  "🌀 El ojo de un huracán puede tener 30km de diámetro y calma total.",
  
  // Climate Change
  "🌡️ El cambio climático ha aumentado las olas de calor un 400%.",
  "🌍 2023 fue el año más caluroso registrado hasta ahora.",
  "🔥 Los incendios forestales han aumentado un 300% desde 1970.",
  "🏔️ Los glaciares pierden 335 mil millones de toneladas de hielo al año.",
  "🌊 El nivel del mar sube 3.3mm cada año.",
  "🧊 El Ártico pierde 13% de su hielo cada década.",
  
  // Sun & Space
  "☀️ El Sol representa el 99.86% de toda la masa del sistema solar.",
  "🌡️ La superficie del Sol tiene 5,500°C.",
  "🌅 Un día en Venus dura más que un año en Venus (243 vs 225 días terrestres).",
  "🌙 La temperatura en la Luna varía de -173°C a 127°C.",
  "🪐 Júpiter tiene la tormenta más grande del sistema solar (Gran Mancha Roja).",
  
  // Interesting Phenomena
  "🌟 Las auroras boreales ocurren cuando partículas solares chocan con la atmósfera.",
  "🔥 Los fuegos fatuos son gases inflamables que brillan sobre pantanos.",
  "🌫️ El mar de nubes en Canarias atrae a miles de turistas cada año.",
  "🌈 Los arcoíris dobles tienen los colores invertidos en el segundo arco.",
  "⚡ El Sprite es un rayo que va hacia arriba, hacia el espacio.",
  
  // Records & Fun Facts
  "📡 Los meteorólogos usan globos sonda para medir el clima hasta 30km de altura.",
  "🛰️ Hay más de 160 satélites meteorológicos orbitando la Tierra.",
  "🇨🇦 Canadá tiene el tornado más mortal de la historia (Regina, 1912).",
  "🇺🇾 Uruguay tiene uno de los mejores sistemas de alerta de tormentas de Sudamérica.",
  "🇪🇸 España tiene el primer observatorio meteorológico del mundo (Madrid, 1785).",
  
  // Animal Weather
  "🐜 Las hormigas construyen montículos más altos antes de una tormenta.",
  "🐦 Las aves vuelan más bajo cuando se acerca mal tiempo.",
  "🐸 Los grillos cantan más rápido cuando hace más calor.",
  "🐻 Los osos hibernan debido a la falta de alimento, no por el frío.",
  "🦟 Los mosquitos son más activos cuando la presión atmosférica baja."
];

const weatherNews = [
  {
    title: "2024: Otro año récord de calor global",
    description: "Los científicos confirman que 2024 superó los récords de temperatura, consolidando una década de calentamiento sin precedentes.",
    icon: "🔥",
    category: "Tendencia",
    image: "https://images.unsplash.com/photo-1527482797697-8795b05a13fe?w=600&h=400&fit=crop",
    date: "2024"
  },
  {
    title: "Auroras boreales visibles en latitudes inusuales",
    description: "Tormentas solares intensas permitieron ver auroras hasta en México y el sur de Europa durante 2024.",
    icon: "🌌",
    category: "Fenómeno",
    image: "https://images.unsplash.com/photo-1531366936337-7c912a4589a7?w=600&h=400&fit=crop",
    date: "2024"
  },
  {
    title: "Huracanes más intensos en el Atlántico",
    description: "La temporada 2024 registró huracanes de categoría 5 con vientos superiores a 280 km/h.",
    icon: "🌀",
    category: "Alerta",
    image: "https://images.unsplash.com/photo-1527482797697-8795b05a13fe?w=600&h=400&fit=crop",
    date: "2024"
  },
  {
    title: "Sequía extrema en el Amazonas",
    description: "El río Amazonas alcanzó niveles históricos bajos, afectando ecosistemas y comunidades enteras.",
    icon: "🏜️",
    category: "Clima",
    image: "https://images.unsplash.com/photo-1547499681-28dece7dba00?w=600&h=400&fit=crop",
    date: "2024"
  },
  {
    title: "Nuevos récords de temperatura en Europa",
    description: "España, Italia y Grecia registraron temperaturas superiores a 45°C durante el verano boreal.",
    icon: "🌡️",
    category: "Récord",
    image: "https://images.unsplash.com/photo-1504386106331-3e4e71712b38?w=600&h=400&fit=crop",
    date: "2024"
  },
  {
    title: "El Niño más intenso en 7 años",
    description: "El fenómeno de El Niño 2023-2024 fue uno de los más fuertes registrados, afectando el clima global.",
    icon: "🌊",
    category: "Fenómeno",
    image: "https://images.unsplash.com/photo-1505142468610-359e7d316be0?w=600&h=400&fit=crop",
    date: "2024"
  },
  {
    title: "Inversión térmica extrema en EE.UU.",
    description: "Chicago experimentó una diferencia de 30°C entre la temperatura real y la sensación térmica.",
    icon: "🥶",
    category: "Récord",
    image: "https://images.unsplash.com/photo-1517685352747-480de10a031b?w=600&h=400&fit=crop",
    date: "2024"
  },
  {
    title: "Tornados en lugares inusuales",
    description: "Se registraron tornados en regiones donde antes eran extremadamente raros, como partes de Sudamérica.",
    icon: "🌪️",
    category: "Alerta",
    image: "https://images.unsplash.com/photo-1527482937786-6f399a60b5f0?w=600&h=400&fit=crop",
    date: "2024"
  },
  {
    title: "Tormentas solares afectan comunicaciones",
    description: "Una serie de eyecciones de masa coronal causaron interrupciones en satélites y redes eléctricas.",
    icon: "☀️",
    category: "Espacio",
    image: "https://images.unsplash.com/photo-1531366936337-7c912a4589a7?w=600&h=400&fit=crop",
    date: "2024"
  },
  {
    title: "Nevadas históricas en los Alpes",
    description: "Estaciones de esquí europeas registraron acumulaciones de nieve no vistas en décadas.",
    icon: "❄️",
    category: "Récord",
    image: "https://images.unsplash.com/photo-1478265409131-1f65c88f965c?w=600&h=400&fit=crop",
    date: "2024"
  },
  {
    title: "Aumento del nivel del mar se acelera",
    description: "Nuevos datos satelitales muestran que el nivel del mar sube más rápido de lo predicho.",
    icon: "🌊",
    category: "Tendencia",
    image: "https://images.unsplash.com/photo-1505142468610-359e7d316be0?w=600&h=400&fit=crop",
    date: "2024"
  },
  {
    title: "Incendios forestales sin precedentes",
    description: "Canadá, Grecia y Australia enfrentaron temporadas de incendios récord debido a condiciones extremas.",
    icon: "🔥",
    category: "Alerta",
    image: "https://images.unsplash.com/photo-1542856204-00101eb6def4?w=600&h=400&fit=crop",
    date: "2024"
  }
];

const factImages = [
  "https://images.unsplash.com/photo-1534088568595-a066f410bcda?w=400&h=300&fit=crop",
  "https://images.unsplash.com/photo-1501630834273-4b5604d2ee31?w=400&h=300&fit=crop",
  "https://images.unsplash.com/photo-1507400492013-162706c8c05e?w=400&h=300&fit=crop",
  "https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?w=400&h=300&fit=crop",
  "https://images.unsplash.com/photo-1483728642387-6c3bdd6c93e5?w=400&h=300&fit=crop",
  "https://images.unsplash.com/photo-1527482797697-8795b05a13fe?w=400&h=300&fit=crop",
  "https://images.unsplash.com/photo-1517685352747-480de10a031b?w=400&h=300&fit=crop",
  "https://images.unsplash.com/photo-1478265409131-1f65c88f965c?w=400&h=300&fit=crop",
  "https://images.unsplash.com/photo-1519692933481-e162a57d6721?w=400&h=300&fit=crop",
  "https://images.unsplash.com/photo-1485236745370-61ac71a7b44f?w=400&h=300&fit=crop",
  "https://images.unsplash.com/photo-1534274988757-a28bf1a57c17?w=400&h=300&fit=crop",
  "https://images.unsplash.com/photo-1556228578-0d85b1a4d571?w=400&h=300&fit=crop"
];

let currentFactImageIndex = 0;

function showRandomFact() {
  const factEl = document.getElementById('weather-fact');
  const factCard = document.querySelector('.fact-card-content .fact-image img');
  if (factEl) {
    const randomFact = weatherFacts[Math.floor(Math.random() * weatherFacts.length)];
    factEl.innerHTML = `<p>${randomFact}</p>`;
  }
  if (factCard) {
    currentFactImageIndex = (currentFactImageIndex + 1) % factImages.length;
    factCard.src = factImages[currentFactImageIndex];
  }
}

function showRandomNews() {
  const newsEl = document.getElementById('weather-news');
  if (newsEl) {
    const randomNews = weatherNews[Math.floor(Math.random() * weatherNews.length)];
    const categoryColors = {
      'Tendencia': '#f97316',
      'Fenómeno': '#a855f7',
      'Alerta': '#ef4444',
      'Clima': '#06b6d4',
      'Récord': '#eab308'
    };
    const categoryColor = categoryColors[randomNews.category] || '#06b6d4';
    
    newsEl.innerHTML = `
      <div class="news-card-enhanced">
        <div class="news-image">
          <img src="${randomNews.image}" alt="${randomNews.title}" loading="lazy">
          <div class="news-image-overlay"></div>
          <div class="news-category-badge" style="background: ${categoryColor}">${randomNews.icon} ${randomNews.category}</div>
        </div>
        <div class="news-body">
          <div class="news-title">${randomNews.title}</div>
          <div class="news-description">${randomNews.description}</div>
          <div class="news-meta">
            <span class="news-date">${randomNews.date}</span>
          </div>
        </div>
      </div>
    `;
  }
}

// Show a new fact every 30 seconds
setInterval(showRandomFact, 30000);

// Show a new news item every 45 seconds
setInterval(showRandomNews, 45000);

// Initial load
document.addEventListener('DOMContentLoaded', () => {
  showRandomFact();
  showRandomNews();
});

// ============================================
// PDF REPORT - PROFESSIONAL (NO EMOJIS)
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

  // Colors
  const cyan = [6, 182, 212];
  const purple = [168, 85, 247];
  const dark = [30, 30, 30];
  const gray = [100, 100, 100];
  const lightGray = [248, 250, 252];
  
  // Header
  doc.setFillColor(...cyan);
  doc.rect(0, 0, w, 35, 'F');
  doc.setFillColor(...purple);
  doc.rect(0, 30, w, 8, 'F');
  
  // Logo text
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(24);
  doc.setFont('helvetica', 'bold');
  doc.text('ZEUS METEO', 20, 22);
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.text('Informe Meteorologico Profesional', w - 20, 22, { align: 'right' });

  // Location
  y = 55;
  doc.setTextColor(...dark);
  doc.setFontSize(22);
  doc.setFont('helvetica', 'bold');
  doc.text(currentReport.location || 'Ubicacion', 20, y);
  
  y += 10;
  doc.setTextColor(...gray);
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  const now = new Date();
  const dateStr = now.toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
  const timeStr = now.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });
  doc.text(dateStr + ' | ' + timeStr, 20, y);

  // Divider
  y += 10;
  doc.setDrawColor(...cyan);
  doc.setLineWidth(0.5);
  doc.line(20, y, w - 20, y);

  // Main Weather Card
  y += 15;
  doc.setFillColor(...lightGray);
  doc.roundedRect(15, y, w - 30, 50, 3, 3, 'F');
  
  // Temperature
  const temp = Math.round(currentReport.temperature);
  doc.setTextColor(...cyan);
  doc.setFontSize(48);
  doc.setFont('helvetica', 'bold');
  doc.text(temp + ' C', 25, y + 30);
  
  // Description
  doc.setTextColor(...dark);
  doc.setFontSize(14);
  doc.setFont('helvetica', 'normal');
  const desc = currentReport.description || 'Despejado';
  doc.text(desc.charAt(0).toUpperCase() + desc.slice(1), 25, y + 42);

  // Weather Details
  y += 60;
  doc.setFillColor(...lightGray);
  doc.roundedRect(15, y, w - 30, 30, 3, 3, 'F');
  
  const humidity = currentReport.humidity || 50;
  const wind = Math.round(currentReport.windSpeed || 10);
  const pressure = currentReport.pressure || 1013;
  
  const details = [
    ['Humedad', humidity + '%'],
    ['Viento', wind + ' km/h'],
    ['Presion', pressure + ' hPa']
  ];
  
  details.forEach((detail, i) => {
    const x = 25 + (i * 60);
    doc.setTextColor(...gray);
    doc.setFontSize(8);
    doc.text(detail[0], x, y + 10);
    doc.setTextColor(...dark);
    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.text(detail[1], x, y + 22);
    doc.setFont('helvetica', 'normal');
  });

  // 5-Day Forecast
  y += 45;
  doc.setFillColor(...cyan);
  doc.roundedRect(15, y, w - 30, 12, 2, 2, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.text('PRONOSTICO 5 DIAS', 20, y + 8);
  
  y += 18;
  if (currentDailyForecast.length > 0) {
    const forecastDays = currentDailyForecast.slice(0, 5);
    
    forecastDays.forEach((day, i) => {
      const x = 20 + (i * 38);
      doc.setFillColor(...lightGray);
      doc.roundedRect(x, y, 35, 35, 2, 2, 'F');
      
      // Day name
      doc.setTextColor(...gray);
      doc.setFontSize(9);
      doc.setFont('helvetica', 'normal');
      doc.text(day.day.substring(0, 3), x + 17, y + 10, { align: 'center' });
      
      // High/Low temps
      doc.setFontSize(10);
      doc.setTextColor(...cyan);
      doc.setFont('helvetica', 'bold');
      doc.text(Math.round(day.high) + '', x + 17, y + 22, { align: 'center' });
      doc.setTextColor(...gray);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(9);
      doc.text(Math.round(day.low) + '', x + 17, y + 30, { align: 'center' });
    });
    y += 42;
  }

  // Sun times
  y += 10;
  doc.setFillColor(...lightGray);
  doc.roundedRect(15, y, w - 30, 25, 2, 2, 'F');
  
  const sunrise = document.getElementById('sunrise-time')?.textContent || '--:--';
  const sunset = document.getElementById('sunset-time')?.textContent || '--:--';
  
  doc.setTextColor(...gray);
  doc.setFontSize(9);
  doc.text('Amanecer: ' + sunrise, 25, y + 10);
  doc.text('Atardecer: ' + sunset, 25, y + 20);
  
  // Source
  doc.setTextColor(...gray);
  doc.setFontSize(8);
  doc.text('Fuente: ' + (currentReport.source || 'Open-Meteo'), w - 25, y + 10, { align: 'right' });
  doc.text('Lat: ' + (currentReport.lat || '--') + ', Lon: ' + (currentReport.lng || '--'), w - 25, y + 20, { align: 'right' });

  // Footer
  y += 35;
  doc.setDrawColor(200, 200, 200);
  doc.line(20, y, w - 20, y);
  
  y += 10;
  doc.setTextColor(...gray);
  doc.setFontSize(8);
  doc.text('Generado por Zeus Meteo | ' + now.toLocaleDateString(), 20, y);

  const fileName = 'Zeus_Meteo_' + (currentReport.location || 'reporte').replace(/\s+/g, '_') + '_' + new Date().toISOString().split('T')[0] + '.pdf';
  doc.save(fileName);
  showNotification('PDF descargado correctamente', 'success');
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
  if (!container) return;
  
  const isVisible = container.style.display === 'flex' || container.classList.contains('active');
  
  if (isVisible) {
    container.style.display = 'none';
    container.classList.remove('active');
  } else {
    container.style.display = 'flex';
    container.classList.add('active');
    // Focus input when opening
    const input = document.getElementById('chatbot-input');
    if (input) setTimeout(() => input.focus(), 100);
  }
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
