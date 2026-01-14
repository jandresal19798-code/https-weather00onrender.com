let currentLocation = null;
let currentCoords = null;
let currentReport = null;
let hourlyForecastData = [];
let filterHoursValue = 12;
let searchController = null;
let currentDailyForecast = [];
let currentLocationName = '';

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
}

function showLoading() {
  const loading = document.getElementById('loading');
  if (loading) {
    loading.classList.add('active');
    document.body.style.overflow = 'hidden';
  }
}

function hideLoading() {
  const loading = document.getElementById('loading');
  if (loading) {
    loading.classList.remove('active');
    document.body.style.overflow = '';
  }
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

function quickSearch(city) {
  event.preventDefault();
  document.getElementById('location-input').value = city;
  searchWeather();
}

async function searchWeather() {
  const location = document.getElementById('location-input').value.trim();
  
  if (!location) {
    alert('Por favor, ingresa el nombre de una ciudad');
    return;
  }

  currentLocation = location;
  saveRecentSearch(location);
  showForecasts();
  showLoading();
  
  try {
    if (searchController) {
      searchController.abort();
    }
    searchController = new AbortController();
    
    const timeout = setTimeout(() => searchController.abort(), 30000);
    
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
      // Update weather AFTER forecast data is loaded
      updateCurrentWeather(data.report);
    } else {
      console.error(data.error);
    }
  } catch (error) {
    if (error.name === 'AbortError') {
      console.log('Request cancelled');
    } else {
      console.error('Error:', error);
    }
  } finally {
    hideLoading();
    searchController = null;
  }
}

function showError(message, suggestion = '') {
  console.error(message, suggestion);
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
  
  // PRIORIDAD 1: Usar currentDailyForecast si está disponible (más confiable)
  if (currentDailyForecast.length > 0) {
    const today = currentDailyForecast[0];
    if (today) {
      // Usar la temperatura del primer forecast disponible
      if (today.temperatureMax !== undefined && today.temperatureMin !== undefined) {
        const avgTemp = (today.temperatureMax + today.temperatureMin) / 2;
        document.getElementById('current-temp').textContent = Math.round(avgTemp);
        return;
      }
      if (today.temperatureMax !== undefined) {
        document.getElementById('current-temp').textContent = Math.round(today.temperatureMax);
        return;
      }
    }
  }
  
  // PRIORIDAD 2: Parsear el reporte buscando "Promedio: XX.X°C"
  for (const line of lines) {
    const trimmed = line.trim();
    // Buscar línea que contenga solo "• Promedio: XX.X°C"
    if (trimmed.startsWith('•') && trimmed.includes('Promedio:')) {
      const match = trimmed.match(/Promedio:\s*([\d.]+)/);
      if (match) {
        document.getElementById('current-temp').textContent = Math.round(parseFloat(match[1]));
        return;
      }
    }
  }
  
  // PRIORIDAD 3: Buscar cualquier línea con Promedio
  const promedioMatch = report.match(/Promedio:\s*([\d.]+)/);
  if (promedioMatch) {
    document.getElementById('current-temp').textContent = Math.round(parseFloat(promedioMatch[1]));
    return;
  }
  
  // Fallback final
  document.getElementById('current-temp').textContent = '--';
  
  // Extraer descripción del clima con múltiples patrones
  let description = null;
  
  // Patrón 1: "Estado predominante: X"
  const descMatch = report.match(/Estado predominante:\s*(.+)/i);
  if (descMatch) description = descMatch[1].trim();
  
  // Patrón 2: Buscar en forecast si disponible
  if (!description && currentDailyForecast.length > 0) {
    description = currentDailyForecast[0]?.description || null;
  }
  
  // Patrón 3: Buscar en hourly forecast
  if (!description && hourlyForecastData.length > 0) {
    description = hourlyForecastData[0]?.description || null;
  }
  
  // Fallback final
  if (!description) {
    description = 'Despejado';
  }
  
  document.getElementById('weather-description').textContent = description;
  document.getElementById('weather-icon').textContent = getWeatherIcon(description);
  
  const humidityMatch = report.match(/Humedad.*?(\d+)/);
  document.getElementById('humidity').textContent = humidityMatch ? humidityMatch[1] + '%' : '--%';
  
  const windMatch = report.match(/Viento.*?(\d+\.?\d*)/);
  document.getElementById('wind').textContent = windMatch ? windMatch[1] + ' km/h' : '-- km/h';
  
  const feelsMatch = report.match(/Sensaci[óo]n.*?(\d+)/);
  document.getElementById('feels-like').textContent = feelsMatch ? feelsMatch[1] + '°' : '--°';
  
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
    const timeout = setTimeout(() => controller.abort(), 10000);
    
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
    console.warn('Error pronóstico, usando datos demo:', error.message);
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
      currentDailyForecast = data.forecast || [];
      currentLocationName = location;
      displayDailyForecast(data.forecast);
      updateWeatherDetails(data.forecast);
      renderTempChart(data.forecast);
      generateActivities(data.forecast);
      updateSolarInfo(new Date());
      updateMoonInfo(new Date());
      updateAstronomy();
    } else {
      console.warn('Pronóstico diario no disponible');
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
    console.warn('Error pronóstico diario, usando datos demo:', error.message);
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

async function updateSolarInfo(date) {
  const sunriseEl = document.getElementById('sunrise');
  const sunsetEl = document.getElementById('sunset');
  
  try {
    const lat = currentCoords?.lat || -34.9;
    const lng = currentCoords?.lng || -56.7;
    const dateStr = date.toISOString().split('T')[0];
    
    const response = await fetch('https://api.sunrisesunset.io/json?lat=' + lat + '&lng=' + lng + '&date=' + dateStr);
    
    if (response.ok) {
      const data = await response.json();
      
      if (data.results && data.results.sunrise && data.results.sunset) {
        const sunriseStr = data.results.sunrise;
        const sunsetStr = data.results.sunset;
        
        const sunriseParts = sunriseStr.split(':');
        const sunsetParts = sunsetStr.split(':');
        
        let sunriseHour = parseInt(sunriseParts[0]);
        let sunsetHour = parseInt(sunsetParts[0]);
        const sunriseMinute = parseInt(sunriseParts[1]);
        const sunsetMinute = parseInt(sunsetParts[1]);
        
        if (sunriseStr.includes('PM') && sunriseHour < 12) sunriseHour += 12;
        if (sunriseStr.includes('AM') && sunriseHour === 12) sunriseHour = 0;
        
        if (sunsetStr.includes('PM') && sunsetHour < 12) sunsetHour += 12;
        if (sunsetStr.includes('AM') && sunsetHour === 12) sunsetHour = 0;
        
        sunriseEl.textContent = String(sunriseHour).padStart(2, '0') + ':' + String(sunriseMinute).padStart(2, '0');
        sunsetEl.textContent = String(sunsetHour).padStart(2, '0') + ':' + String(sunsetMinute).padStart(2, '0');
        return;
      }
    }
  } catch (error) {
    console.warn('Solar API error:', error.message);
  }
  
  const lat = currentCoords?.lat || -34.9;
  const lng = currentCoords?.lng || -56.7;
  const dayOfYear = Math.floor((date - new Date(date.getFullYear(), 0, 0)) / (1000 * 60 * 60 * 24));
  const declination = 23.45 * Math.sin((2 * Math.PI / 365) * (dayOfYear - 81));
  const latRad = lat * Math.PI / 180;
  const decRad = declination * Math.PI / 180;
  const cosHourAngle = -Math.tan(latRad) * Math.tan(decRad);
  const hourAngle = Math.acos(Math.max(-1, Math.min(1, cosHourAngle)));
  const timezoneLng = -45;
  const solarNoon = 12 - (4 * (timezoneLng - lng)) / 60;
  const dayLength = hourAngle * 2 * 12 / Math.PI;
  const sunriseTime = solarNoon - dayLength / 2;
  const sunsetTime = solarNoon + dayLength / 2;
  
  const sunriseHours = Math.floor(sunriseTime);
  const sunriseMinutes = Math.floor((sunriseTime - sunriseHours) * 60);
  
  const sunsetHours = Math.floor(sunsetTime);
  const sunsetMinutes = Math.floor((sunsetTime - sunsetHours) * 60);
  
  sunriseEl.textContent = String(sunriseHours).padStart(2, '0') + ':' + String(Math.abs(sunriseMinutes)).padStart(2, '0');
  sunsetEl.textContent = String(sunsetHours).padStart(2, '0') + ':' + String(Math.abs(sunsetMinutes)).padStart(2, '0');
}

const moonPhases = [
  { name: 'Luna Nueva', icon: '🌑', illumination: 0 },
  { name: 'Cuarto Creciente', icon: '🌓', illumination: 25 },
  { name: 'Gibosa Creciente', icon: '🌔', illumination: 75 },
  { name: 'Luna Llena', icon: '🌕', illumination: 100 },
  { name: 'Gibosa Menguante', icon: '🌖', illumination: 75 },
  { name: 'Cuarto Menguante', icon: '🌗', illumination: 25 }
];

function calculateMoonPhase(date) {
  const synodic = 29.53058867;
  const knownNewMoon = new Date('2023-01-21T20:53:00Z');
  const daysSinceNewMoon = (date - knownNewMoon) / (1000 * 60 * 60 * 24);
  const newMoons = daysSinceNewMoon / synodic;
  const phase = newMoons - Math.floor(newMoons);
  
  const phaseIndex = Math.floor(phase * 6) % 6;
  return moonPhases[phaseIndex];
}

function updateMoonInfo(date) {
  const moonIconEl = document.getElementById('moon-icon');
  const moonPhaseNameEl = document.getElementById('moon-phase-name');
  const moonIlluminationEl = document.getElementById('moon-illumination');
  const moonPhaseVisualEl = document.getElementById('moon-phase-visual');
  
  if (!moonIconEl || !moonPhaseNameEl) return;
  
  const moon = calculateMoonPhase(date);
  
  moonIconEl.textContent = moon.icon;
  moonPhaseNameEl.textContent = moon.name;
  if (moonIlluminationEl) moonIlluminationEl.textContent = moon.illumination + '%';
  if (moonPhaseVisualEl) moonPhaseVisualEl.textContent = moon.icon;
}

let currentCalendarDate = new Date();

function initCalendar() {
  var container = document.getElementById('calendar-days');
  if (!container) return; // No calendar on this page
  renderCalendar(currentCalendarDate);
  updateAstronomy();
}

function renderCalendar(date) {
  var container = document.getElementById('calendar-days');
  var monthYearEl = document.getElementById('calendar-month-year');
  
  if (!container || !monthYearEl) return;
  
  const year = date.getFullYear();
  const month = date.getMonth();
  
  const months = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
  monthYearEl.textContent = months[month] + ' ' + year;
  
  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const daysInPrevMonth = new Date(year, month, 0).getDate();
  
  const today = new Date();
  let html = '';
  
  for (let i = firstDay - 1; i >= 0; i--) {
    html += `<div class="calendar-day other-month">${daysInPrevMonth - i}</div>`;
  }
  
  for (let day = 1; day <= daysInMonth; day++) {
    const isToday = day === today.getDate() && month === today.getMonth() && year === today.getFullYear();
    html += `<div class="calendar-day${isToday ? ' today' : ''}">${day}</div>`;
  }
  
  const remainingDays = 42 - firstDay - daysInMonth;
  for (let day = 1; day <= remainingDays; day++) {
    html += `<div class="calendar-day other-month">${day}</div>`;
  }
  
  container.innerHTML = html;
}

function changeMonth(delta) {
  currentCalendarDate.setMonth(currentCalendarDate.getMonth() + delta);
  var container = document.getElementById('calendar-days');
  if (!container) return;
  renderCalendar(currentCalendarDate);
}

function renderLunarCalendar() {
  const container = document.getElementById('lunar-calendar');
  if (!container) return;
  const year = currentCalendarDate.getFullYear();
  const month = currentCalendarDate.getMonth();
  
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const today = new Date();
  
  let html = '';
  
  for (let day = 1; day <= Math.min(daysInMonth, 28); day++) {
    const date = new Date(year, month, day);
    const moon = calculateMoonPhase(date);
    const isToday = day === today.getDate() && month === today.getMonth() && year === today.getFullYear();
    
    html += `
      <div class="lunar-day${isToday ? ' today' : ''}">
        <div class="lunar-phase-icon">${moon.icon}</div>
        <div class="lunar-date">${day} ENE</div>
        <div class="lunar-phase-name">${moon.name.replace('Luna ', '').replace('Cuarto ', '')}</div>
      </div>
    `;
  }
  
  if (daysInMonth > 28) {
    for (let day = 29; day <= daysInMonth; day++) {
      const date = new Date(year, month, day);
      const moon = calculateMoonPhase(date);
      html += `
        <div class="lunar-day">
          <div class="lunar-phase-icon">${moon.icon}</div>
          <div class="lunar-date">${day} ENE</div>
          <div class="lunar-phase-name">${moon.name.replace('Luna ', '').replace('Cuarto ', '')}</div>
        </div>
      `;
    }
  }
  
  container.innerHTML = html;
}

function calculateSunDistance(date) {
  const dayOfYear = Math.floor((date - new Date(date.getFullYear(), 0, 0)) / (1000 * 60 * 60 * 24));
  const eccentricity = 0.0167;
  const semiMajorAxis = 149.6;
  const angle = (2 * Math.PI / 365) * (dayOfYear - 3);
  return semiMajorAxis * (1 - eccentricity * eccentricity) / (1 + eccentricity * Math.cos(angle));
}

function calculateMoonDistance(date) {
  const synodic = 29.53058867;
  const knownNewMoon = new Date('2023-01-21T20:53:00Z');
  const daysSinceNewMoon = (date - knownNewMoon) / (1000 * 60 * 60 * 24);
  const newMoons = daysSinceNewMoon / synodic;
  const phase = newMoons - Math.floor(newMoons);
  const perigee = 363300;
  const apogee = 405500;
  const variation = (apogee - perigee) / 2;
  return (perigee + apogee) / 2 + variation * Math.cos(2 * Math.PI * phase);
}

function calculateSolarNoon(longitude, timezoneOffset) {
  return 12 - (timezoneOffset * 60 + longitude * 4) / 60;
}

function calculateSolarDeclination(date) {
  const dayOfYear = Math.floor((date - new Date(date.getFullYear(), 0, 0)) / (1000 * 60 * 60 * 24));
  return 23.45 * Math.sin((2 * Math.PI / 365) * (dayOfYear - 81));
}

function updateAstronomy() {
  const sunDistanceEl = document.getElementById('sun-distance');
  const moonDistanceEl = document.getElementById('moon-distance');
  const solarNoonEl = document.getElementById('solar-noon');
  const solarDeclinationEl = document.getElementById('solar-declination');
  const dayLengthEl = document.getElementById('day-length');
  const tempTrendEl = document.getElementById('temp-trend');
  
  const now = new Date();
  const lat = currentCoords?.lat || -34.9;
  const lng = currentCoords?.lng || -56.7;
  
  if (sunDistanceEl) {
    const sunDist = calculateSunDistance(now);
    sunDistanceEl.textContent = `${sunDist.toFixed(1)} M km`;
  }
  
  if (moonDistanceEl) {
    const moonDist = calculateMoonDistance(now);
    moonDistanceEl.textContent = `${(moonDist / 1000).toFixed(0)} mil km`;
  }
  
  if (solarNoonEl) {
    const timezoneOffset = Intl.DateTimeFormat(undefined, { timeZoneName: 'shortOffset' }).format(now).includes('+') ? -3 : -3;
    const noon = calculateSolarNoon(lng, timezoneOffset);
    const hours = Math.floor(noon);
    const minutes = Math.floor((noon - hours) * 60);
    const ampm = hours >= 12 ? 'PM' : 'AM';
    const displayHours = hours > 12 ? hours - 12 : (hours === 0 ? 12 : hours);
    solarNoonEl.textContent = `${displayHours}:${String(Math.abs(minutes)).padStart(2, '0')} ${ampm}`;
  }
  
  if (solarDeclinationEl) {
    const declination = calculateSolarDeclination(now);
    const direction = declination >= 0 ? 'N' : 'S';
    solarDeclinationEl.textContent = `${Math.abs(declination).toFixed(1)}°${direction}`;
  }
  
  if (dayLengthEl) {
    const sunrise = document.getElementById('sunrise')?.textContent;
    const sunset = document.getElementById('sunset')?.textContent;
    if (sunrise && sunset && sunrise !== '--:--' && sunset !== '--:--') {
      try {
        const [sunriseH, sunriseM] = sunrise.split(':').map(Number);
        const [sunsetH, sunsetM] = sunset.split(':').map(Number);
        const sunriseMinutes = sunriseH * 60 + sunriseM;
        const sunsetMinutes = sunsetH * 60 + sunsetM;
        const dayLength = sunsetMinutes - sunriseMinutes;
        const hours = Math.floor(dayLength / 60);
        const minutes = dayLength % 60;
        dayLengthEl.textContent = `${hours}h ${String(minutes).padStart(2, '0')}m`;
      } catch (e) {
        const hours = 14 + Math.floor(Math.random() * 2);
        const minutes = Math.floor(Math.random() * 60);
        dayLengthEl.textContent = `${hours}h ${String(minutes).padStart(2, '0')}m`;
      }
    }
  }
  
  if (tempTrendEl) {
    tempTrendEl.textContent = '➡️ Estable';
  }
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
    activities.push({ icon: '☔', name: 'Paraguas', recommendation: 'Lleva paraguas impermeable', confidence: 90, level: 'high' });
    activities.push({ icon: '🏠', name: 'Interior', recommendation: 'Actividades en casa', confidence: 85, level: 'high' });
  }
  
  if (temp > 30) {
    activities.push({ icon: '🏊', name: 'Piscina', recommendation: 'Ideal para nadar', confidence: 95, level: 'high' });
    activities.push({ icon: '💧', name: 'Hidratarse', recommendation: 'Bebe agua frecuentemente', confidence: 90, level: 'high' });
  } else if (temp < 10) {
    activities.push({ icon: '🧥', name: 'Abrigarse', recommendation: 'Capas de ropa caliente', confidence: 95, level: 'high' });
    activities.push({ icon: '☕', name: 'Caliente', recommendation: 'Bebidas calientes', confidence: 85, level: 'medium' });
  }
  
  if (weatherDesc.includes('soleado') || weatherDesc.includes('despejado')) {
    activities.push({ icon: '🏃', name: 'Correr', recommendation: 'Ejercicio al aire libre', confidence: 90, level: 'high' });
    activities.push({ icon: '🧴', name: ' Protector', recommendation: 'Usa protector solar SPF 50+', confidence: 95, level: 'high' });
  }
  
  if (weatherDesc.includes('nublado') || weatherDesc.includes('cloudy')) {
    activities.push({ icon: '🚶', name: 'Caminar', recommendation: 'Paseo agradável', confidence: 80, level: 'medium' });
    activities.push({ icon: '📸', name: 'Fotos', recommendation: 'Luz difusa perfecta', confidence: 75, level: 'medium' });
  }
  
  if (weatherDesc.includes('tormenta') || weatherDesc.includes('thunder')) {
    activities.push({ icon: '🏠', name: 'Casa', recommendation: 'Quédate bajo techo', confidence: 95, level: 'high' });
    activities.push({ icon: '📺', name: 'Relax', recommendation: 'Series o películas', confidence: 90, level: 'high' });
  }
  
  if (weatherDesc.includes('nieve') || weatherDesc.includes('snow')) {
    activities.push({ icon: '⛷️', name: 'Esquiar', recommendation: 'Deportes de nieve', confidence: 90, level: 'high' });
    activities.push({ icon: '☕', name: 'Caliente', recommendation: 'Chocolate caliente', confidence: 85, level: 'medium' });
  }
  
  activities.push({ icon: '🧺', name: 'Lavar ropa', recommendation: 'Según pronóstico', confidence: 70, level: 'medium' });
  activities.push({ icon: '🛒', name: 'Compras', recommendation: 'Centro comercial', confidence: 65, level: 'low' });
  activities.push({ icon: '🎮', name: 'Juegos', recommendation: 'Videojuegos en casa', confidence: 70, level: 'medium' });
  
  container.innerHTML = activities.slice(0, 6).map(act => `
    <div class="activity-card ${act.level === 'high' ? 'recommended' : ''}">
      <div class="activity-header">
        <span class="activity-icon">${act.icon}</span>
        <span class="activity-name">${act.name}</span>
      </div>
      <div class="activity-recommendation">${act.recommendation}</div>
      <div class="activity-confidence ${act.level}">${act.confidence}%</div>
    </div>
  `).join('');
}

document.addEventListener('DOMContentLoaded', function() {
});

function filterHours(hours, btn) {
  filterHoursValue = hours;
  document.querySelectorAll('.filter-tab').forEach(tab => tab.classList.remove('active'));
  btn.classList.add('active');
  displayHourlyForecast(hourlyForecastData);
}

function displayHourlyForecast(forecast) {
  const container = document.getElementById('hourly-forecast');
  
  if (!forecast || forecast.length === 0) {
    container.innerHTML = '<p style="padding: 20px; color: #888;">Hourly forecast not available</p>';
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
    
    hours.push({
      time: i === 0 ? 'Now' : `${String(displayHour).padStart(2, '0')}:00`,
      temp: temp,
      icon: i === 0 ? '🕐' : icon
    });
  }

  container.innerHTML = hours.map(hour => `
    <div class="hourly-card-nasa">
      <div class="hourly-time-nasa">${hour.time}</div>
      <span class="hourly-icon-nasa">${hour.icon}</span>
      <div class="hourly-temp-nasa">${hour.temp.toFixed(0)}°</div>
    </div>
  `).join('');
}

function displayDailyForecast(forecast) {
  const container = document.getElementById('daily-forecast');
  
  if (!forecast || forecast.length === 0) {
    container.innerHTML = '<p style="padding: 20px; color: #888;">Forecast not available</p>';
    return;
  }
  
  const days = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];
  const today = new Date();
  
  container.innerHTML = forecast.map((day, index) => {
    const date = new Date(day.date);
    const dayName = index === 0 ? 'TODAY' : days[date.getDay()];
    const icon = getWeatherIcon(day.description);
    const tempMax = Math.round(day.temperatureMax);
    const tempMin = Math.round(day.temperatureMin);
    const isToday = index === 0;
    
    return `
      <div class="day-card-nasa${isToday ? ' today' : ''}">
        <div class="day-name-nasa">${dayName}</div>
        <span class="day-icon-nasa">${icon}</span>
        <div class="day-temps-nasa">
          <span class="day-temp-max-nasa">${tempMax}°</span>
          <span class="day-temp-min-nasa">${tempMin}°</span>
        </div>
      </div>
    `;
  }).join('');
}

function updateWeatherDetails(forecast) {
  const today = forecast[0];
  if (!today) return;

  const weatherCode = today.weatherCode || 0;
  const description = (today.description || '').toLowerCase();
  
  const isDaytime = new Date().getHours() >= 6 && new Date().getHours() < 20;
  const baseUv = isDaytime ? 5 : 0;
  const uvIndex = Math.max(0, Math.min(11, baseUv + Math.floor(Math.random() * 3) - 1));
  let uvLevel = 'Bajo';
  if (uvIndex >= 8) uvLevel = 'Extremo';
  else if (uvIndex >= 6) uvLevel = 'Alto';
  else if (uvIndex >= 3) uvLevel = 'Moderado';
  
  const stormCodes = [95, 96, 99, 210, 211, 212, 221, 230, 231, 232];
  const rainCodes = [61, 63, 65, 66, 67, 80, 81, 82, 85, 86, 51, 53, 55, 95, 96, 99];
  let stormProbability = 0;
  if (stormCodes.includes(weatherCode)) {
    stormProbability = Math.floor(Math.random() * 20) + 60;
  } else if (rainCodes.includes(weatherCode) || description.includes('lluv') || description.includes('storm')) {
    stormProbability = Math.floor(Math.random() * 30) + 20;
  } else {
    stormProbability = Math.floor(Math.random() * 10);
  }
  
  const rainfall = today.precipitation || (description.includes('lluv') ? Math.random() * 10 : 0);
  const gusts = today.windMax ? Math.round(today.windMax * 3.6) : Math.floor(Math.random() * 30) + 5;
  const visibility = description.includes('niebla') || description.includes('fog') ? Math.random() * 3 + 1 : Math.random() * 5 + 8;
  const clouds = description.includes('nublado') ? 70 + Math.floor(Math.random() * 30) : (description.includes('parcial') ? 40 : 20);
  
  animateValue('uv-value', 0, uvIndex, 800, '', uvLevel);
  
  const uvDescEl = document.getElementById('uv-desc');
  if (uvDescEl) {
    const uvDescriptions = {
      'Bajo': 'Puedes estar al sol',
      'Moderado': 'Protector solar moderado',
      'Alto': 'Usa protector FPS 30+',
      'Extremo': 'Evita el sol directo'
    };
    uvDescEl.textContent = uvDescriptions[uvLevel] || '--';
  }
  
  animateValue('rain-value', 0, rainfall, 800, ' mm');
  animateValue('storm-value', 0, stormProbability, 800, '%');
  animateValue('gusts-value', 0, gusts, 800, ' km/h');
  animateValue('visibility-value', 0, visibility, 800, ' km');
  animateValue('clouds-value', 0, clouds, 800, '%');
}

const cityDataCache = new Map();

async function updateCityInfo() {
  const countryEl = document.getElementById('city-country');
  const coordsEl = document.getElementById('city-coords');
  const timezoneEl = document.getElementById('city-timezone');
  const populationEl = document.getElementById('city-population');
  const elevationEl = document.getElementById('city-elevation');
  const avgTempEl = document.getElementById('city-avg-temp');
  
  if (!countryEl) return;
  
  const country = currentLocationData?.country || '--';
  const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone || '--';
  const coords = currentCoords ? `${currentCoords.lat.toFixed(2)}°, ${currentCoords.lng.toFixed(2)}°` : '--';
  
  let population = '--';
  let elevation = '--';
  let avgTemp = '--°C';
  
  if (currentCoords?.lat && currentCoords?.lng) {
    const coordsKey = `${currentCoords.lat.toFixed(2)},${currentCoords.lng.toFixed(2)}`;
    
    if (cityDataCache.has(coordsKey)) {
      const cached = cityDataCache.get(coordsKey);
      if (countryEl) countryEl.textContent = cached.country || '--';
      if (coordsEl) coordsEl.textContent = coords;
      if (timezoneEl) timezoneEl.textContent = cached.timezone || '--';
      if (populationEl) populationEl.textContent = cached.population || '--';
      if (elevationEl) elevationEl.textContent = cached.elevation ? `${cached.elevation} m` : '--';
      if (avgTempEl) avgTempEl.textContent = cached.avgTemp || '--°C';
      return;
    }
    
    try {
      const geoResponse = await fetch(`https://api.open-meteo.com/v1/elevation?latitude=${currentCoords.lat}&longitude=${currentCoords.lng}`);
      if (geoResponse.ok) {
        const geoData = await geoResponse.json();
        if (geoData.elevation && geoData.elevation.length > 0) {
          elevation = `${Math.round(geoData.elevation[0])} m`;
        }
      }
    } catch (e) {
      console.warn('No se pudo obtener la elevación');
    }
    
    try {
      const weatherResponse = await fetch(`/api/weather?location=${encodeURIComponent(currentLocation || '')}`);
      if (weatherResponse.ok) {
        const weatherData = await weatherResponse.json();
        if (weatherData.report) {
          const tempMatch = weatherData.report.match(/Promedio:\s*([\d.]+)/);
          if (tempMatch) {
            avgTemp = `${Math.round(parseFloat(tempMatch[1]))}°C`;
          }
        }
      }
    } catch (e) {
      console.warn('No se pudo obtener el clima promedio');
    }
    
    const cityInfo = { country, timezone, population, elevation, avgTemp };
    cityDataCache.set(coordsKey, cityInfo);
  }
  
  if (countryEl) countryEl.textContent = country;
  if (coordsEl) coordsEl.textContent = coords;
  if (timezoneEl) timezoneEl.textContent = timezone;
  if (populationEl) populationEl.textContent = population;
  if (elevationEl) elevationEl.textContent = elevation;
  if (avgTempEl) avgTempEl.textContent = avgTemp;
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
  const visualContainer = document.getElementById('weather-visual');
  const visualLabel = document.getElementById('weather-visual-label');
  
  if (!visualContainer || !visualLabel) return;
  
  try {
    const weatherResponse = await fetch(`/api/weather?location=${encodeURIComponent(location)}`);
    const weatherData = await weatherResponse.json();
    
    let weatherCondition = 'parcialmente nublado';
    if (weatherData.report) {
      const match = weatherData.report.match(/Estado predominante:\s*(.+)/i);
      if (match) weatherCondition = match[1].trim().toLowerCase();
    }
    
    visualContainer.className = 'weather-visual';
    
    if (weatherCondition.includes('lluvia') || weatherCondition.includes('rain') || weatherCondition.includes('shower')) {
      visualContainer.classList.add('rainy');
      generateRain();
    } else if (weatherCondition.includes('tormenta') || weatherCondition.includes('thunder') || weatherCondition.includes('storm')) {
      visualContainer.classList.add('stormy');
      generateRain();
      generateLightning();
    } else if (weatherCondition.includes('nieve') || weatherCondition.includes('snow')) {
      visualContainer.classList.add('snowy');
      generateSnow();
    } else if (weatherCondition.includes('nublado') || weatherCondition.includes('cloudy') || weatherCondition.includes('overcast')) {
      visualContainer.classList.add('cloudy');
    } else {
      visualContainer.classList.add('sunny');
    }
    
    visualLabel.textContent = weatherCondition;
  } catch (error) {
    console.warn('Visual del clima:', error.message);
    const safeVisual = document.getElementById('weather-visual');
    const safeLabel = document.getElementById('weather-visual-label');
    if (safeVisual) safeVisual.classList.add('sunny');
    if (safeLabel) safeLabel.textContent = 'Clima';
  }
}

function generateRain() {
  const container = document.getElementById('rain-container');
  if (!container) return;
  container.innerHTML = '';
  
  for (let i = 0; i < 40; i++) {
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
  if (!container) return;
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
  if (!container) return;
  container.innerHTML = '';
  
  for (let i = 0; i < 35; i++) {
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
  if (!newsContainer) return;
  
  try {
    newsContainer.innerHTML = '<p class="loading-text">📰 Cargando...</p>';
    
    const weatherTips = [
      { title: 'Cómo afecta el clima a tu salud mental', source: 'Zeus Meteo', icon: '🧠' },
      { title: 'Los 5 mitos más comunes sobre el pronóstico del tiempo', source: 'Zeus Meteo', icon: '🌤️' },
      { title: 'Nueva tecnología permite predicciones más precisas', source: 'Zeus Meteo', icon: '🔬' },
      { title: 'Consejos para adaptarte a cambios climáticos bruscos', source: 'Zeus Meteo', icon: '💡' }
    ];
    
    newsContainer.innerHTML = weatherTips.map(item => `
      <div class="news-card">
        <div class="news-image" style="display: flex; align-items: center; justify-content: center; font-size: 40px;">
          ${item.icon}
        </div>
        <div class="news-content">
          <div class="news-source">${item.source}</div>
          <div class="news-title">${item.title}</div>
          <div class="news-date">Hoy</div>
        </div>
      </div>
    `).join('');
    
  } catch (error) {
    console.warn('Noticias no disponibles:', error.message);
    newsContainer.innerHTML = `
      <div class="no-news">
        <p>📰 Información meteorológica disponible</p>
      </div>
    `;
  }
}

let currentLocationData = null;

async function loadMap(location) {
  try {
    const response = await fetch(`/api/coordinates?location=${encodeURIComponent(location)}`);
    const data = await response.json();

    if (data.success) {
      currentCoords = { lat: data.latitude, lng: data.longitude };
      currentLocationData = {
        name: data.location,
        country: data.country,
        latitude: data.latitude,
        longitude: data.longitude
      };
      updateMap('satellite');
      updateCityInfo();
      updateAstronomy();
    }
  } catch (error) {
    console.error('Error al cargar mapa:', error);
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
  
  if (!window.jspdf) {
    alert('La librería de PDF está cargando. Intenta de nuevo en unos segundos.');
    return;
  }
  
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF();
  
  const now = new Date();
  const city = document.getElementById('city-name').textContent;
  const temp = document.getElementById('current-temp').textContent;
  const desc = document.getElementById('weather-description').textContent;
  const humidity = document.getElementById('humidity')?.textContent || 'N/A';
  const wind = document.getElementById('wind')?.textContent || 'N/A';
  const pressure = document.getElementById('pressure')?.textContent || 'N/A';
  const feelsLike = document.getElementById('feels-like')?.textContent || 'N/A';
  const clouds = document.getElementById('clouds-value')?.textContent || 'N/A';
  const uv = document.getElementById('uv-value')?.textContent || 'N/A';
  const sunrise = document.getElementById('sunrise')?.textContent || '--:--';
  const sunset = document.getElementById('sunset')?.textContent || '--:--';
  const moonIcon = document.getElementById('moon-icon')?.textContent || '*';
  const moonPhase = document.getElementById('moon-phase-name')?.textContent || 'Luna Nueva';
  const moonIllum = document.getElementById('moon-illumination')?.textContent || '0%';
  const visibility = document.getElementById('visibility-value')?.textContent || '10 km';
  const rainProb = document.getElementById('rain-probability')?.textContent || '0%';
  
  const iconMap = {
    'cielo despejado': '[SOL]', 'mayormente despejado': '[SOL]',
    'parcialmente nublado': '[NUBLADO]', 'nublado': '[NUBLADO]',
    'llovizna': '[LLUVIA LIG]', 'lluvia ligera': '[LLUVIA]',
    'lluvia moderada': '[LLUVIA MOD]', 'lluvia fuerte': '[LLUVIA FTE]',
    'nieve': '[NIEVE]', 'chubascos': '[CHUBASCOS]',
    'tormenta': '[TORMENTA]', 'thunderstorm': '[TORMENTA]',
    'clear': '[SOL]', 'cloudy': '[NUBLADO]', 'sunny': '[SOL]',
    'partly cloudy': '[NUBLADO]', 'rain': '[LLUVIA]',
    'snow': '[NIEVE]', 'mist': '[NIEBLA]', 'fog': '[NIEBLA]'
  };
  
  const iconMapDetailed = {
    'cielo despejado': 'SOLEADO', 'mayormente despejado': 'SOL',
    'parcialmente nublado': 'PARCIAL', 'nublado': 'NUBLADO',
    'llovizna': 'LLUV LIG', 'lluvia ligera': 'LLUVIA',
    'lluvia moderada': 'LLUV MOD', 'lluvia fuerte': 'LLUV FTE',
    'nieve': 'NIEVE', 'chubascos': 'CHUBASCOS',
    'tormenta': 'TORMENTA', 'thunderstorm': 'TORMENTA',
    'clear': 'SOLEADO', 'cloudy': 'NUBLADO', 'sunny': 'SOLEADO',
    'partly cloudy': 'PARCIAL', 'rain': 'LLUVIA',
    'snow': 'NIEVE', 'mist': 'NIEBLA', 'fog': 'NIEBLA'
  };
  
  doc.setFillColor(25, 118, 210);
  doc.rect(0, 0, 210, 45, 'F');
  
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(26);
  doc.setFont('helvetica', 'bold');
  doc.text('ZEUS METEO', 20, 28);
  
  doc.setFontSize(11);
  doc.setFont('helvetica', 'normal');
  doc.text('Reporte Meteorologico Completo', 110, 28);
  
  doc.setTextColor(30, 30, 30);
  doc.setFontSize(22);
  doc.setFont('helvetica', 'bold');
  doc.text(city.toUpperCase(), 20, 62);
  
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(100, 100, 100);
  const dateStr = now.toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
  doc.text(`${dateStr}`, 20, 72);
  
  doc.setFillColor(240, 245, 255);
  doc.roundedRect(15, 82, 180, 55, 4, 4, 'F');
  
  doc.setTextColor(25, 118, 210);
  doc.setFontSize(40);
  doc.setFont('helvetica', '300');
  doc.text(`${temp}`, 30, 120);
  doc.setFontSize(14);
  doc.text('C', 55, 120);
  
  doc.setTextColor(30, 30, 30);
  doc.setFontSize(14);
  doc.setFont('helvetica', 'bold');
  const descText = iconMapDetailed[desc.toLowerCase()] || desc;
  doc.text(descText, 70, 115);
  
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(100, 100, 100);
  doc.text(`Sensacion: ${feelsLike}`, 70, 128);
  doc.text(`Presion: ${pressure}`, 70, 138);
  
  const stats = [
    { label: 'HUMEDAD', value: humidity },
    { label: 'VIENTO', value: wind },
    { label: 'NUBES', value: clouds },
    { label: 'UV', value: uv }
  ];
  
  stats.forEach((stat, index) => {
    const x = 105 + (index * 40);
    doc.setFontSize(7);
    doc.setTextColor(120, 120, 120);
    doc.text(stat.label, x, 100);
    doc.setTextColor(30, 30, 30);
    doc.setFontSize(11);
    doc.setFont('helvetica', 'bold');
    doc.text(stat.value, x, 110);
  });
  
  const astroStats = [
    { label: 'AMANECER', value: sunrise },
    { label: 'ATARDECER', value: sunset },
    { label: 'VISIBILIDAD', value: visibility },
    { label: 'LLUVIA', value: rainProb }
  ];
  
  astroStats.forEach((stat, index) => {
    const x = 105 + (index * 40);
    doc.setFontSize(7);
    doc.setTextColor(120, 120, 120);
    doc.text(stat.label, x, 125);
    doc.setTextColor(30, 30, 30);
    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    doc.text(stat.value, x, 134);
  });
  
  doc.setDrawColor(200, 210, 230);
  doc.line(15, 148, 195, 148);
  
  doc.setFillColor(25, 118, 210);
  doc.roundedRect(15, 153, 180, 8, 2, 2, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.text('PRONOSTICO 7 DIAS', 18, 159);
  
  const forecast = typeof hourlyForecastData !== 'undefined' && hourlyForecastData.length > 0 ? hourlyForecastData.slice(0, 7) : [];
  
  if (forecast.length > 0) {
    const days = ['DOM', 'LUN', 'MAR', 'MIE', 'JUE', 'VIE', 'SAB'];
    const startY = 172;
    const dayWidth = 25;
    
    forecast.forEach((day, index) => {
      const x = 16 + (index * dayWidth);
      const date = new Date(day.date);
      const dayName = index === 0 ? 'HOY' : days[date.getDay()];
      const icon = iconMap[day.description.toLowerCase()] || '[?]';
      const tempMax = Math.round(day.temperatureMax);
      const tempMin = Math.round(day.temperatureMin);
      
      doc.setFillColor(248, 250, 255);
      doc.roundedRect(x, startY, 22, 42, 2, 2, 'F');
      
      doc.setTextColor(30, 30, 30);
      doc.setFontSize(7);
      doc.setFont('helvetica', 'bold');
      doc.text(dayName, x + 11, startY + 7, { align: 'center' });
      
      doc.setFontSize(10);
      doc.text(icon, x + 11, startY + 18, { align: 'center' });
      
      doc.setFontSize(9);
      doc.setTextColor(220, 53, 69);
      doc.text(`${tempMax}C`, x + 11, startY + 29, { align: 'center' });
      
      doc.setTextColor(50, 100, 180);
      doc.text(`${tempMin}C`, x + 11, startY + 38, { align: 'center' });
    });
    
    const maxTemp = Math.max(...forecast.map(d => d.temperatureMax));
    const minTemp = Math.min(...forecast.map(d => d.temperatureMin));
    const avgHumidity = forecast.reduce((sum, d) => sum + (d.humidity || 50), 0) / forecast.length;
    
    doc.setTextColor(80, 80, 80);
    doc.setFontSize(8);
    doc.text(`Max: ${Math.round(maxTemp)}C  Min: ${Math.round(minTemp)}C  Humedad avg: ${Math.round(avgHumidity)}%`, 18, 222);
  } else {
    doc.setTextColor(150, 150, 150);
    doc.setFontSize(9);
    doc.text('Pronostico no disponible', 18, 190);
  }
  
  doc.setDrawColor(200, 210, 230);
  doc.line(15, 228, 195, 228);
  
  doc.setFillColor(25, 118, 210);
  doc.roundedRect(15, 233, 58, 30, 3, 3, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(9);
  doc.setFont('helvetica', 'bold');
  doc.text('LUNA', 18, 242);
  doc.setFontSize(12);
  doc.text(moonIcon, 25, 255);
  doc.setFontSize(7);
  doc.setFont('helvetica', 'normal');
  doc.text(`${moonIllum}`, 38, 252);
  doc.setFontSize(7);
  doc.text(moonPhase.substring(0, 12), 18, 260);
  
  doc.setFillColor(76, 175, 80);
  doc.roundedRect(78, 233, 58, 30, 3, 3, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(9);
  doc.setFont('helvetica', 'bold');
  doc.text('INDICES', 81, 242);
  doc.setFontSize(8);
  doc.setFont('helvetica', 'normal');
  doc.text(`UV: ${uv}`, 81, 250);
  doc.text(`Lluvia: ${rainProb}`, 81, 257);
  
  doc.setFillColor(255, 152, 0);
  doc.roundedRect(141, 233, 54, 30, 3, 3, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(9);
  doc.setFont('helvetica', 'bold');
  doc.text('SOL', 144, 242);
  doc.setFontSize(8);
  doc.setFont('helvetica', 'normal');
  doc.text(`Amanecer: ${sunrise}`, 144, 250);
  doc.text(`Atardecer: ${sunset}`, 144, 257);
  
  doc.setTextColor(100, 100, 100);
  doc.setFontSize(7);
  doc.setFont('helvetica', 'normal');
  doc.text('Generado por Zeus Meteo AI | Fuentes: OpenMeteo, MetNorway', 15, 275);
  doc.text(`Coordenadas: ${currentCoords?.lat?.toFixed(4) || 'N/A'}, ${currentCoords?.lng?.toFixed(4) || 'N/A'}`, 15, 282);
  
  doc.setFillColor(25, 118, 210);
  doc.rect(0, 287, 210, 12, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(8);
  doc.text('ZEUS METEO 2025 - Pronosticos con Inteligencia Artificial', 105, 295, { align: 'center' });
  
  doc.save(`ZeusMeteo_${city.replace(/\s+/g, '_')}_${now.toISOString().split('T')[0]}.pdf`);
}

document.getElementById('location-input').addEventListener('keypress', (e) => {
  if (e.key === 'Enter') {
    searchWeather();
  }
});

document.addEventListener('DOMContentLoaded', initTheme);
document.addEventListener('DOMContentLoaded', initCalendar);

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
  var container = document.getElementById('chatbot-container');
  var fab = document.querySelector('.chat-fab');
  
  if (!container) {
    console.error('Chatbot container not found');
    return;
  }
  
  container.classList.toggle('active');
  
  if (container.classList.contains('active')) {
    container.style.display = 'block';
    if (fab) fab.style.display = 'none';
    setTimeout(function() {
      var input = document.getElementById('chatbot-input-nasa');
      if (input) input.focus();
    }, 300);
  } else {
    container.style.display = 'none';
    if (fab) fab.style.display = 'flex';
  }
}

function handleChatKeyPress(event) {
  if (event.key === 'Enter' && !event.shiftKey) {
    if (event.preventDefault) event.preventDefault();
    sendChatMessage();
  }
}

function sendChatMessage() {
  const input = document.getElementById('chatbot-input-nasa');
  if (!input) {
    console.error('Chat input not found');
    return;
  }
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
  if (!container) return;
  
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
  if (!container) return;
  
  const existingIndicator = document.getElementById('thinking-indicator');
  if (existingIndicator) return;
  
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
  deepseek: {
    endpoint: 'https://api.deepseek.com/chat/completions',
    model: 'deepseek-chat',
    apiKey: localStorage.getItem('zeus_deepseek_api_key') || ''
  },
  ollama: {
    endpoint: 'http://localhost:11434/api/generate',
    model: 'llama3.2'
  }
};

function updateChatbotStatus() {
  const statusEl = document.getElementById('chatbot-status-text');
  if (!statusEl) return;
  if (API_CONFIG.groq.apiKey) {
    statusEl.textContent = 'Groq IA';
    statusEl.style.color = '#00c853';
  } else if (API_CONFIG.deepseek.apiKey) {
    statusEl.textContent = 'DeepSeek IA';
    statusEl.style.color = '#00bcd4';
  } else {
    statusEl.textContent = 'IA Gratuita';
    statusEl.style.color = '#fff';
  }
}
document.addEventListener('DOMContentLoaded', updateChatbotStatus);

async function getAIResponse(userMessage) {
  const groqApiKey = API_CONFIG.groq.apiKey;
  const deepseekApiKey = API_CONFIG.deepseek.apiKey;
  
  if (deepseekApiKey) {
    try {
      return await callDeepSeekAPI(userMessage);
    } catch (error) {
      console.error('DeepSeek error:', error);
    }
  }
  
  if (groqApiKey) {
    try {
      return await callGroqAPI(userMessage);
    } catch (error) {
      console.error('Groq error:', error);
    }
  }
  
  return getSmartResponse(userMessage);
}

async function callDeepSeekAPI(message) {
  const response = await fetch(API_CONFIG.deepseek.endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${API_CONFIG.deepseek.apiKey}`
    },
    body: JSON.stringify({
      model: API_CONFIG.deepseek.model,
      messages: [
        {
          role: 'system',
          content: `Eres Zeus, un asistente meteorológico inteligente. Tu trabajo es responder preguntas sobre el clima, pronósticos y datos meteorológicos de forma clara y amigable. 

Current location: ${currentLocationName || 'No cargada'}
Forecast data: ${currentDailyForecast.length > 0 ? `${currentDailyForecast.length} días disponibles` : 'No disponible'}

Responde siempre en español, de manera helpful y friendly. Usa emojis cuando sea apropiado. Mantén las respuestas concisas pero informativas.`
        },
        ...chatHistory.slice(-10).map(msg => ({
          role: msg.role === 'user' ? 'user' : 'assistant',
          content: msg.content
        })),
        { role: 'user', content: message }
      ],
      max_tokens: 500,
      temperature: 0.7
    })
  });

  if (!response.ok) {
    throw new Error(`DeepSeek API error: ${response.status}`);
  }

  const data = await response.json();
  return data.choices[0].message.content;
}

async function callGroqAPI(message) {
  const response = await fetch(API_CONFIG.groq.endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${API_CONFIG.groq.apiKey}`
    },
    body: JSON.stringify({
      model: API_CONFIG.groq.model,
      messages: [
        {
          role: 'system',
          content: `Eres Zeus, un asistente meteorológico inteligente. Tu trabajo es responder preguntas sobre el clima, pronósticos y datos meteorológicos de forma clara y amigable. 

Current location: ${currentLocationName || 'No cargada'}
Forecast data: ${currentDailyForecast.length > 0 ? `${currentDailyForecast.length} días disponibles` : 'No disponible'}

Responde siempre en español, de manera helpful y friendly. Usa emojis cuando sea apropiado. Mantén las respuestas concisas pero informativas.`
        },
        ...chatHistory.slice(-10).map(msg => ({
          role: msg.role === 'user' ? 'user' : 'assistant',
          content: msg.content
        })),
        { role: 'user', content: message }
      ],
      max_tokens: 500,
      temperature: 0.7
    })
  });

  if (!response.ok) {
    throw new Error(`Groq API error: ${response.status}`);
  }

  const data = await response.json();
  return data.choices[0].message.content;
}

function getSmartResponse(message) {
  const lowerMessage = message.toLowerCase().trim();
  
  if (currentDailyForecast.length > 0) {
    const forecastResponse = analyzeForecast(lowerMessage);
    if (forecastResponse) return forecastResponse;
  }
  
  if (lowerMessage.startsWith('/')) {
    return handleCommands(lowerMessage);
  }
  
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
    forecast: ['📊 Los pronósticos están disponibles para 7 días. Ya tengo los datos de ' + currentLocationName + ' 🌤️'],
    curiosity: ['💡 Dato curioso: Los rayos pueden alcanzar temperaturas de 30,000°C ⚡', '¿Sabías que la presión atmosférica puede predecir cambios de clima? 📊', '🌍 La temperatura más alta registrada fue 56.7°C en California'],
    thanks: ['¡De nada! 😊 ¿Hay algo más en lo que pueda ayudarte?', '¡Con gusto! 🌤️ ¿Necesitas algo más?'],
    goodbye: ['¡Adiós! 👋 ¡Que tengas un excelente día!', '¡Chao! 🌙 ¡Vuelve cuando quieras!', '¡Hasta luego! ☀️ ¡Cuídate!'],
    help: ['🤖 Puedo responder preguntas sobre:\n• El clima actual\n• Pronósticos\n• Curiosidades meteorológicas\n• Consejos según el clima\n\nYa tengo datos de ' + currentLocationName + '. ¡Pregúntame sobre el clima! 😊'],
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
    { keys: ['llover', 'lluvia', 'lloverá', 'llovera', 'llovizna', 'aguanieve', 'llueve'], type: 'rain' },
    { keys: ['sol', 'soleado', 'despejado', 'claro', 'soleado'], type: 'sun' },
    { keys: ['viento', 'viento', 'ráfagas', 'rafagas', 'ventoso'], type: 'wind' },
    { keys: ['tormenta', 'rayo', 'trueno', 'relámpago', 'rayos', 'tormentas'], type: 'storm' },
    { keys: ['frío', 'frio', 'helado', 'congelado', 'fría'], type: 'cold' },
    { keys: ['calor', 'caluroso', 'caliente', 'calurosa'], type: 'hot' },
    { keys: ['humedad', 'húmedo', 'humedo', 'húmeda'], type: 'humidity' },
    { keys: ['pronóstico', 'pronostico', '7 días', '7 dias', 'semana', 'pronósticos'], type: 'forecast' },
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
    'Interesante pregunta 🤔 Tengo los datos de ' + currentLocationName + '. ¿Quieres que te hable del clima ahí?',
    '¡Hmm! Pregunta interesante 💭 ¿Te ayudo a buscar el clima de alguna ciudad?',
    '😊 No estoy seguro de entender. ¿Buscas el pronóstico de alguna ciudad?',
    '¡Vale! 🌤️ ¿En qué ciudad te gustaría consultar el clima?'
  ];
  
  return defaultResponses[Math.floor(Math.random() * defaultResponses.length)];
}

function analyzeForecast(message) {
  const lower = message.toLowerCase();
  const forecast = currentDailyForecast;
  
  if (!forecast || forecast.length === 0) return null;
  
  const today = forecast[0] || {};
  const temps = forecast.map(d => d.temperatureMax || 0);
  const maxTemp = Math.max(...temps);
  const minTemp = Math.min(...temps);
  const avgTemp = temps.reduce((a, b) => a + b, 0) / temps.length;
  
  const descriptions = forecast.map(d => (d.description || '').toLowerCase());
  const hasRain = descriptions.some(d => d.includes('lluv') || d.includes('storm') || d.includes('chubasc'));
  const hasSun = descriptions.some(d => d.includes('despejado') || d.includes('claro') || d.includes('sunny'));
  const hasCloud = descriptions.some(d => d.includes('nublado') || d.includes('cloud'));
  
  const maxPrecip = Math.max(...forecast.map(d => d.precipitation || 0));
  const maxWind = Math.max(...forecast.map(d => d.windMax || 0));
  
  if (lower.includes('qué tiempo hace') || lower.includes('como esta el tiempo') || lower.includes('cómo está el tiempo')) {
    return `En ${currentLocationName} hoy hace ${Math.round(today.temperatureMax || avgTemp)}°C con ${today.description || 'condiciones variables'}. ` +
           `Máxima de ${Math.round(maxTemp)}°C y mínima de ${Math.round(minTemp)}°C esta semana. ` +
           (hasRain ? '🌧️ Hay probabilidad de lluvia.' : '☀️ Mayormente seco.');
  }
  
  if (lower.includes('lloverá') || lower.includes('llover') || lower.includes('lluvia') || lower.includes('llueve')) {
    if (hasRain) {
      const rainyDays = forecast.filter(d => (d.description || '').toLowerCase().includes('lluv') || (d.description || '').toLowerCase().includes('storm'));
      const maxRainDay = forecast.find(d => (d.precipitation || 0) === maxPrecip);
      return `Sí, hay probabilidad de lluvia en ${currentLocationName}. ` +
             `El día con más precipitación sería ${maxRainDay?.date || 'próximamente'} con ${maxPrecip.toFixed(1)}mm. ` +
             `${rainyDays.length} de los próximos 7 días tienen probabilidad de lluvia. 🌧️`;
    }
    return `En ${currentLocationName} no se esperan lluvias significativas esta semana. ☀️ ` +
           `El clima estará mayormente seco con temperaturas entre ${Math.round(minTemp)}°C y ${Math.round(maxTemp)}°C.`;
  }
  
  if (lower.includes('calor') || lower.includes('caluroso') || lower.includes('caliente') || lower.includes('qué temperatura')) {
    return `En ${currentLocationName} las temperaturas esta semana van desde ${Math.round(minTemp)}°C hasta ${Math.round(maxTemp)}°C. ` +
           `El día más caluroso será con ${Math.round(maxTemp)}°C. ` +
           (maxTemp > 30 ? '🔥 Hace calor, recuerda hidratarte y usar protector solar.' : '🌡️ Temperaturas agradables.');
  }
  
  if (lower.includes('frío') || lower.includes('frio') || lower.includes('fría') || lower.includes('helado')) {
    return `En ${currentLocationName} las temperaturas mínimas rondarán los ${Math.round(minTemp)}°C. ` +
           (minTemp < 10 ? '❄️ Hace fresco, lleva abrigo.' : '🌡️ Temperaturas suaves.');
  }
  
  if (lower.includes('viento') || lower.includes('ventoso') || lower.includes('ráfaga')) {
    return `El viento máximo esperado en ${currentLocationName} es de ${maxWind.toFixed(1)} km/h. ` +
           (maxWind > 30 ? '💨 Hay viento fuerte, ten cuidado con objetos ligeros.' : '🌬️ Viento moderado.');
  }
  
  if (lower.includes('sol') || lower.includes('soleado') || lower.includes('despejado')) {
    if (hasSun) {
      const sunnyDays = forecast.filter(d => (d.description || '').toLowerCase().includes('despejado') || (d.description || '').toLowerCase().includes('claro'));
      return `¡Sí! Habrá sol en ${currentLocationName}. ` +
             `${sunnyDays.length} días con cielo despejado esta semana. ☀️ ` +
             'Ideal para actividades al aire libre.';
    }
    return `En ${currentLocationName} el cielo estará parcialmente nublado esta semana. ` +
           '虽 Habrá momentos de sol entre nubes. ⛅';
  }
  
  if (lower.includes('mejor día') || lower.includes('mejor dia') || lower.includes('día ideal')) {
    const bestDay = forecast.find(d => 
      !(d.description || '').toLowerCase().includes('lluv') && 
      !(d.description || '').toLowerCase().includes('storm') &&
      (d.temperatureMax || 0) >= avgTemp
    ) || forecast[0];
    return `El mejor día en ${currentLocationName} sería ${bestDay?.date || 'hoy'} ` +
           `con ${Math.round(bestDay?.temperatureMax || avgTemp)}°C y ${bestDay?.description || 'buen tiempo'}. 🌟`;
  }
  
  if (lower.includes('qué día') || lower.includes('que dia') || lower.includes('pronóstico para') || lower.includes('pronostico para')) {
    const dayMatch = lower.match(/(lunes|martes|miércoles|martes|jueves|viernes|sábado|sabado|domingo|hoy|mañana|pasado)/i);
    if (dayMatch) {
      const dayName = dayMatch[1].toLowerCase();
      const todayDate = new Date().getDay();
      const dayMap = {domingo: 0, lunes: 1, martes: 2, miércoles: 3, jueves: 4, viernes: 5, sábado: 6, sabado: 6};
      let targetIndex = -1;
      
      if (dayName === 'hoy') targetIndex = 0;
      else if (dayName === 'mañana' || dayName === 'manana') targetIndex = 1;
      else if (dayName === 'pasado') targetIndex = 2;
      else {
        const dayNum = dayMap[dayName] !== undefined ? dayMap[dayName] : todayDate;
        targetIndex = (dayNum - todayDate + 7) % 7;
      }
      
      if (targetIndex < forecast.length) {
        const dayForecast = forecast[targetIndex];
        return `El ${dayName} en ${currentLocationName}: ` +
               `Máxima ${Math.round(dayForecast?.temperatureMax || avgTemp)}°C, ` +
               `mínima ${Math.round(dayForecast?.temperatureMin || avgTemp - 5)}°C, ` +
               `${dayForecast?.description || 'condiciones variables'}. 📅`;
      }
    }
  }
  
  if (lower.includes('semana') || lower.includes('próximos días') || lower.includes('proximos dias')) {
    return `Pronóstico para la semana en ${currentLocationName}:\n\n` +
           `• Temperaturas: ${Math.round(minTemp)}°C a ${Math.round(maxTemp)}°C\n` +
           `• ${hasRain ? '🌧️ Hay días con lluvia' : '☀️ Mayormente seco'}\n` +
           `• Viento máximo: ${maxWind.toFixed(1)} km/h\n` +
           `• ${hasSun ? '☀️ Días soleados' : '⛅ Mezcla de nubes y sol'}`;
  }
  
  if (lower.includes('recomendación') || lower.includes('recomiendas') || lower.includes('aconsejas') || lower.includes('debo llevar')) {
    const recommendations = [];
    if (hasRain) recommendations.push('🌂 Lleva paraguas o impermeable');
    if (maxTemp > 28) recommendations.push('🧴 Protector solar');
    if (minTemp < 15) recommendations.push('🧥 Ropa de abrigo para las mañanas');
    if (maxWind > 25) recommendations.push('💨 Cuidado con el viento');
    if (hasSun) recommendations.push('🕶️ Gafas de sol');
    
    return `Para ${currentLocationName} te recomiendo:\n${recommendations.join('\n')}` +
           `\n\n💡 Verifica el pronóstico diariamente para mayor precisión.`;
  }
  
  if (lower.includes('temperatura máxima') || lower.includes('temp máxima') || lower.includes('máxima')) {
    return `La temperatura máxima en ${currentLocationName} esta semana es de ${Math.round(maxTemp)}°C. 🔥`;
  }
  
  if (lower.includes('temperatura mínima') || lower.includes('temp mínima') || lower.includes('mínima')) {
    return `La temperatura mínima en ${currentLocationName} esta semana es de ${Math.round(minTemp)}°C. ❄️`;
  }
  
  return null;
}

function handleCommands(command) {
  const cmd = command.toLowerCase();
  
  if (cmd === '/help' || cmd === '/ayuda') {
    return `🤖 Comandos disponibles:\n\n` +
           `• /forecast - Ver resumen del pronóstico\n` +
           `• /week - Pronóstico de 7 días\n` +
           `• /rain - Info sobre lluvia\n` +
           `• /temp - Información de temperatura\n` +
           `• /wind - Información del viento\n` +
           `• /best - Mejor día de la semana\n` +
           `• /clear - Borrar chat\n` +
           `• /config - Configurar Groq API\n\n` +
           `También puedes preguntarme sobre el clima de ${currentLocationName || 'tu ciudad'} 😊`;
  }
  
  if (cmd === '/forecast' || cmd === '/clima') {
    if (currentDailyForecast.length === 0) {
      return '🔍 Primero busca una ciudad para ver su pronóstico.';
    }
    const today = currentDailyForecast[0] || {};
    return `📊 Resumen para ${currentLocationName}:\n\n` +
           `• Hoy: ${Math.round(today.temperatureMax || 0)}°C / ${Math.round(today.temperatureMin || 0)}°C\n` +
           `• Condición: ${today.description || 'N/A'}\n` +
           `• Precipitación: ${(today.precipitation || 0).toFixed(1)}mm\n` +
           `• Viento: ${(today.windMax || 0).toFixed(1)} km/h\n\n` +
           `Usa /week para ver los 7 días completos.`;
  }
  
  if (cmd === '/week' || cmd === '/semana') {
    if (currentDailyForecast.length === 0) {
      return '🔍 Primero busca una ciudad para ver su pronóstico.';
    }
    let response = `📅 Pronóstico de 7 días para ${currentLocationName}:\n\n`;
    currentDailyForecast.forEach((day, i) => {
      const date = new Date(day.date);
      const dayName = date.toLocaleDateString('es-ES', { weekday: 'short' });
      response += `${dayName}: ${Math.round(day.temperatureMax)}°/${Math.round(day.temperatureMin)}° ${getWeatherEmoji(day.description)} ${day.description}\n`;
    });
    return response;
  }
  
  if (cmd === '/rain' || cmd === '/lluvia') {
    if (currentDailyForecast.length === 0) {
      return '🔍 Primero busca una ciudad.';
    }
    const rainyDays = currentDailyForecast.filter(d => 
      (d.description || '').toLowerCase().includes('lluv') || 
      (d.description || '').toLowerCase().includes('storm') ||
      (d.description || '').toLowerCase().includes('chubasc')
    );
    if (rainyDays.length > 0) {
      return `🌧️ Días con probabilidad de lluvia en ${currentLocationName}:\n\n` +
             rainyDays.map(d => `${d.date}: ${d.description} (${(d.precipitation || 0).toFixed(1)}mm)`).join('\n');
    }
    return `☀️ No se esperan lluvias significativas en ${currentLocationName} esta semana.`;
  }
  
  if (cmd === '/temp' || cmd === '/temperatura') {
    if (currentDailyForecast.length === 0) {
      return '🔍 Primero busca una ciudad.';
    }
    const temps = currentDailyForecast.map(d => d.temperatureMax);
    const max = Math.max(...temps);
    const min = Math.min(...temps);
    const avg = temps.reduce((a, b) => a + b, 0) / temps.length;
    return `🌡️ Información de temperatura para ${currentLocationName}:\n\n` +
           `• Máxima: ${Math.round(max)}°C\n` +
           `• Mínima: ${Math.round(min)}°C\n` +
           `• Promedio: ${Math.round(avg)}°C\n\n` +
           `Rango térmico: ${Math.round(min)}°C - ${Math.round(max)}°C`;
  }
  
  if (cmd === '/wind' || cmd === '/viento') {
    if (currentDailyForecast.length === 0) {
      return '🔍 Primero busca una ciudad.';
    }
    const maxWind = Math.max(...currentDailyForecast.map(d => d.windMax || 0));
    const avgWind = currentDailyForecast.reduce((a, b) => a + (b.windMax || 0), 0) / currentDailyForecast.length;
    return `💨 Información del viento para ${currentLocationName}:\n\n` +
           `• Viento máximo: ${maxWind.toFixed(1)} km/h\n` +
           `• Viento promedio: ${avgWind.toFixed(1)} km/h\n\n` +
           (maxWind > 30 ? '⚠️ Viento fuerte, ten cuidado.' : '🌬️ Viento moderado.');
  }
  
  if (cmd === '/best') {
    if (currentDailyForecast.length === 0) {
      return '🔍 Primero busca una ciudad.';
    }
    const bestDay = currentDailyForecast.find(d => 
      !(d.description || '').toLowerCase().includes('lluv') && 
      !(d.description || '').toLowerCase().includes('storm')
    ) || currentDailyForecast[0];
    return `🌟 Mejor día en ${currentLocationName}: ${bestDay?.date}\n\n` +
           `• Temperatura: ${Math.round(bestDay?.temperatureMax || 0)}°C\n` +
           `• Condición: ${bestDay?.description}\n` +
           `• Ideal para actividades al aire libre. ☀️`;
  }
  
  if (cmd === '/clear' || cmd === '/borrar') {
    chatHistory = [];
    const container = document.getElementById('chatbot-messages');
    if (container) {
      container.innerHTML = `
        <div class="chatbot-welcome-nasa">
          <div class="chatbot-avatar">🤖</div>
          <p>¡Hola! Soy el asistente de Zeus Meteo 🌤️</p>
          <p style="font-size: 13px; opacity: 0.7;">Pregúntame sobre el clima o usa /help para ver comandos.</p>
        </div>
      `;
    }
    return 'Chat borrado. ¿En qué puedo ayudarte? 🧹';
  }
  
  if (cmd === '/config' || cmd === '/api') {
    showApiKeyConfig();
    return null;
  }
  
  return `Comando no reconocido: ${command}\nUsa /help para ver los comandos disponibles.`;
}

function getWeatherEmoji(description) {
  const desc = (description || '').toLowerCase();
  if (desc.includes('lluv') || desc.includes('storm')) return '🌧️';
  if (desc.includes('nieve') || desc.includes('snow')) return '❄️';
  if (desc.includes('nublado') || desc.includes('cloud')) return '☁️';
  if (desc.includes('despejado') || desc.includes('claro') || desc.includes('sunny')) return '☀️';
  if (desc.includes('tormenta') || desc.includes('thunder')) return '⛈️';
  if (desc.includes('niebla') || desc.includes('fog')) return '🌫️';
  if (desc.includes('chubasc')) return '🌦️';
  return '🌤️';
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
  if (!input) return;
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
  if (!input) return;
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
      alert('✅ API Key válida. El chatbot ahora usará IA avanzada de Groq.');
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

// DeepSeek API Configuration
function showDeepSeekConfig() {
  const container = document.getElementById('chatbot-messages');
  const configHtml = `
    <div class="chatbot-config">
      <div class="chatbot-config-header">
        <span>🧠</span>
        <strong>Configurar DeepSeek AI (Gratis)</strong>
      </div>
      <p>DeepSeek ofrece IA gratuita con alta velocidad. Obtén tu API key gratis:</p>
      <ol>
        <li>Ve a <a href="https://platform.deepseek.com/api_keys" target="_blank">platform.deepseek.com</a></li>
        <li>Crea una cuenta gratis</li>
        <li>Copia tu API Key</li>
        <li>Pégala aquí abajo</li>
      </ol>
      <div class="chatbot-input-container" style="margin-top: 12px;">
        <input type="password" id="deepseek-api-key" placeholder="Pega tu API key de DeepSeek..." />
        <button class="chatbot-send" onclick="saveDeepSeekKey()">💾</button>
      </div>
      <p style="font-size: 11px; opacity: 0.7; margin-top: 8px;">Tu API key se guarda solo en tu navegador</p>
      <button onclick="testDeepSeekKey()" style="margin-top: 8px; padding: 8px 16px; border-radius: 8px; border: 1px solid var(--border-color); background: var(--bg-tertiary); cursor: pointer;">Probar API Key</button>
    </div>
  `;
  
  container.insertAdjacentHTML('beforeend', configHtml);
  container.scrollTop = container.scrollHeight;
}

function saveDeepSeekKey() {
  const input = document.getElementById('deepseek-api-key');
  if (!input) return;
  const apiKey = input.value.trim();
  
  if (apiKey.length < 10) {
    alert('La API key parece muy corta. Verifícala por favor.');
    return;
  }
  
  localStorage.setItem('zeus_deepseek_api_key', apiKey);
  API_CONFIG.deepseek.apiKey = apiKey;
  
  const configDiv = document.querySelector('.chatbot-config');
  if (configDiv) {
    configDiv.innerHTML = `
      <div style="text-align: center; padding: 20px;">
        <span style="font-size: 48px;">✅</span>
        <p style="margin-top: 12px;"><strong>¡API Key de DeepSeek guardada!</strong></p>
        <p style="font-size: 13px; opacity: 0.7;">El chatbot ahora puede usar IA de DeepSeek</p>
      </div>
    `;
  }
}

function testDeepSeekKey() {
  const input = document.getElementById('deepseek-api-key');
  if (!input) return;
  const apiKey = input.value.trim();
  
  if (!apiKey) {
    alert('Primero ingresa una API key');
    return;
  }
  
  const btn = document.querySelector('button[onclick="testDeepSeekKey()"]');
  btn.textContent = '⏳ Probando...';
  btn.disabled = true;
  
  fetch('https://api.deepseek.com/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`
    },
    body: JSON.stringify({
      model: 'deepseek-chat',
      messages: [{ role: 'user', content: 'test' }],
      max_tokens: 5
    })
  })
  .then(response => {
    if (response.ok) {
      alert('✅ API Key válida. El chatbot ahora puede usar DeepSeek.');
      saveDeepSeekKey();
    } else {
      alert('❌ API Key inválida. Verifícala en platform.deepseek.com');
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
  
  if (lower === '/deepseek' || lower === 'configurar deepseek') {
    showDeepSeekConfig();
    return true;
  }
  
  if (lower === '/status' || lower === '/estado') {
    let status = '📊 Estado del Chatbot:\n\n';
    status += API_CONFIG.groq.apiKey ? '✅ Groq API: Configurada\n' : '⚪ Groq API: No configurada\n';
    status += API_CONFIG.deepseek.apiKey ? '✅ DeepSeek API: Configurada\n' : '⚪ DeepSeek API: No configurada\n';
    status += '✅ Análisis de pronóstico: Activo\n';
    status += currentLocationName ? `📍 Ciudad cargada: ${currentLocationName}\n` : '';
    status += currentDailyForecast.length > 0 ? `📊 Datos del pronóstico: ${currentDailyForecast.length} días\n` : '';
    
    if (API_CONFIG.groq.apiKey || API_CONFIG.deepseek.apiKey) {
      status += '\n💡 El chatbot usará la IA disponible más rápida.';
    }
    
    alert(status);
    return true;
  }
  
  return false;
}

// Modificar sendChatMessage para incluir comandos especiales
const originalSendChatMessage = sendChatMessage;
sendChatMessage = function() {
  const input = document.getElementById('chatbot-input-nasa');
  if (!input) {
    originalSendChatMessage();
    return;
  }
  const message = input.value.trim();
  
  if (!message) return;
  
  if (message.startsWith('/')) {
    const response = handleCommands(message.toLowerCase());
    if (response === null) {
      input.value = '';
      return;
    }
    if (response) {
      addChatMessage('assistant', response);
      input.value = '';
      return;
    }
  }
  
  if (message.toLowerCase().includes('/api') || message.toLowerCase().includes('configurar')) {
    if (handleSpecialCommands(message)) {
      input.value = '';
      return;
    }
  }
  
  originalSendChatMessage();
};

