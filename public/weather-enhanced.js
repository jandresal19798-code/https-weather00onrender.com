// ============================================
// ZEUS METEO PREMIUM - ENGINE 3.0
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
let weatherTheme = 'default';

// Weather SVG Icons
const weatherIcons = {
  'clear': '<svg viewBox="0 0 64 64" class="weather-icon-svg"><circle cx="32" cy="32" r="14" fill="#FFD93D"/><g stroke="#FFD93D" stroke-width="2"><line x1="32" y1="4" x2="32" y2="12"/><line x1="32" y1="52" x2="32" y2="60"/><line x1="4" y1="32" x2="12" y2="32"/><line x1="52" y1="32" x2="60" y2="32"/><line x1="11" y1="11" x2="17" y2="17"/><line x1="47" y1="47" x2="53" y2="53"/><line x1="11" y1="53" x2="17" y2="47"/><line x1="47" y1="17" x2="53" y2="11"/></g></svg>',
  'cloudy': '<svg viewBox="0 0 64 64" class="weather-icon-svg"><path d="M46 40H18c-6.6 0-12-5.4-12-12s5.4-12 12-12c.5 0 1 0 1.5.1C20.8 12.5 24.1 10 28 10c4.6 0 8.4 3.4 9 7.8c.3-.1.7-.1 1-.1 5 0 9 4 9 9s-4 9-9 9h-1l4 4 12-12z" fill="#B8C5D6"/></svg>',
  'rain': '<svg viewBox="0 0 64 64" class="weather-icon-svg"><path d="M46 40H18c-6.6 0-12-5.4-12-12s5.4-12 12-12c.5 0 1 0 1.5.1C20.8 12.5 24.1 10 28 10c4.6 0 8.4 3.4 9 7.8c.3-.1.7-.1 1-.1 5 0 9 4 9 9s-4 9-9 9h-1l4 4 12-12z" fill="#B8C5D6"/><g stroke="#5B9BD5" stroke-width="2" stroke-linecap="round"><line x1="20" y1="48" x2="16" y2="58"/><line x1="32" y1="48" x2="28" y2="58"/><line x1="44" y1="48" x2="40" y2="58"/></g></svg>',
  'storm': '<svg viewBox="0 0 64 64" class="weather-icon-svg"><path d="M46 40H18c-6.6 0-12-5.4-12-12s5.4-12 12-12c.5 0 1 0 1.5.1C20.8 12.5 24.1 10 28 10c4.6 0 8.4 3.4 9 7.8c.3-.1.7-.1 1-.1 5 0 9 4 9 9s-4 9-9 9h-1l4 4 12-12z" fill="#B8C5D6"/><polygon points="26,46 32,58 38,46 32,48" fill="#FFD93D" stroke="#FFA500" stroke-width="1"/></svg>',
  'snow': '<svg viewBox="0 0 64 64" class="weather-icon-svg"><path d="M46 40H18c-6.6 0-12-5.4-12-12s5.4-12 12-12c.5 0 1 0 1.5.1C20.8 12.5 24.1 10 28 10c4.6 0 8.4 3.4 9 7.8c.3-.1.7-.1 1-.1 5 0 9 4 9 9s-4 9-9 9h-1l4 4 12-12z" fill="#B8C5D6"/><circle cx="22" cy="52" r="2" fill="#FFF"/><circle cx="32" cy="56" r="2" fill="#FFF"/><circle cx="42" cy="52" r="2" fill="#FFF"/></svg>',
  'fog': '<svg viewBox="0 0 64 64" class="weather-icon-svg"><path d="M8 24h48M8 32h48M8 40h48" stroke="#B8C5D6" stroke-width="3" stroke-linecap="round"/></svg>',
  'night': '<svg viewBox="0 0 64 64" class="weather-icon-svg"><path d="M32 8a12 12 0 1 1-8 23h16a12 12 0 1 1-8-23z" fill="#F4D03F"/><circle cx="20" cy="12" r="2" fill="#FFF"/><circle cx="44" cy="16" r="1.5" fill="#FFF"/><circle cx="16" cy="20" r="1" fill="#FFF"/></svg>'
};

function getWeatherIconSVG(description) {
  const desc = (description || '').toLowerCase();
  if (desc.includes('clear') || desc.includes('soleado') || desc.includes('despejado')) return weatherIcons.clear;
  if (desc.includes('rain') || desc.includes('lluvia')) return weatherIcons.rain;
  if (desc.includes('thunder') || desc.includes('tormenta')) return weatherIcons.storm;
  if (desc.includes('snow') || desc.includes('nieve')) return weatherIcons.snow;
  if (desc.includes('fog') || desc.includes('niebla')) return weatherIcons.fog;
  if (desc.includes('night') || desc.includes('noche')) return weatherIcons.night;
  if (desc.includes('cloud') || desc.includes('nublado') || desc.includes('cloudy')) return weatherIcons.cloudy;
  return weatherIcons.clear;
}

// ============================================
// PDF REPORT GENERATION - COMPREHENSIVE
// ============================================
async function generatePDFReport() {
  if (!currentReport) {
    showNotification('No hay datos para generar informe', 'warning');
    return;
  }

  const { jsPDF } = window.jspdf;
  const doc = new jsPDF();
  
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  let y = 20;
  
  // Modern color palette
  const colors = {
    primary: [34, 197, 94],    // Green
    secondary: [234, 179, 8],    // Yellow/Gold
    accent: [249, 115, 22],      // Orange
    dark: [15, 23, 42],          // Dark slate
    light: [248, 250, 252]       // Light
  };
  
  // Header with gradient effect
  doc.setFillColor(...colors.primary);
  doc.rect(0, 0, pageWidth, 45, 'F');
  
  doc.setFillColor(...colors.accent);
  doc.rect(0, 40, pageWidth, 8, 'F');
  
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(28);
  doc.setFont('helvetica', 'bold');
  doc.text('ZEUS METEO', pageWidth / 2, 22, { align: 'center' });
  
  doc.setFontSize(12);
  doc.setFont('helvetica', 'normal');
  doc.text('Informe Meteorológico Completo', pageWidth / 2, 32, { align: 'center' });
  
  y = 60;
  doc.setTextColor(0, 0, 0);
  
  // Location & Date Section
  doc.setFontSize(20);
  doc.setFont('helvetica', 'bold');
  doc.text(currentReport.location || 'Ubicación', 20, y);
  
  y += 8;
  doc.setFontSize(11);
  doc.setFont('helvetica', 'normal');
  const dateStr = new Date().toLocaleDateString('es-ES', { 
    weekday: 'long', 
    year: 'numeric', 
    month: 'long', 
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
  doc.setTextColor(100, 100, 100);
  doc.text(dateStr, 20, y);
  
  y += 15;
  doc.setDrawColor(...colors.primary);
  doc.setLineWidth(0.5);
  doc.line(20, y, pageWidth - 20, y);
  
  y += 15;
  
  // Main Weather Data Card
  doc.setFillColor(248, 250, 252);
  doc.roundedRect(15, y - 5, pageWidth - 30, 85, 3, 3, 'F');
  
  y += 5;
  doc.setFontSize(14);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...colors.primary);
  doc.text('CONDICIONES ACTUALES', 25, y);
  
  y += 12;
  doc.setFontSize(11);
  doc.setFont('helvetica', 'normal');
  
  const temp = Math.round(currentReport.temperature);
  const feelsLike = Math.round(currentReport.feelsLike || currentReport.temperature);
  const humidity = currentReport.humidity || 50;
  const wind = Math.round(currentReport.windSpeed || 10);
  const pressure = currentReport.pressure || 1013;
  const description = currentReport.description || 'N/A';
  
  // Row 1
  doc.setTextColor(0, 0, 0);
  doc.text('🌡️ Temperatura:', 25, y);
  doc.setFont('helvetica', 'bold');
  doc.text(`${temp}°C`, 70, y);
  
  doc.setFont('helvetica', 'normal');
  doc.text('💧 Humedad:', 110, y);
  doc.setFont('helvetica', 'bold');
  doc.text(`${humidity}%`, 145, y);
  
  y += 10;
  
  // Row 2
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(0, 0, 0);
  doc.text('🌡️ Sensación:', 25, y);
  doc.setFont('helvetica', 'bold');
  doc.text(`${feelsLike}°C`, 70, y);
  
  doc.setFont('helvetica', 'normal');
  doc.text('💨 Viento:', 110, y);
  doc.setFont('helvetica', 'bold');
  doc.text(`${wind} km/h`, 145, y);
  
  y += 10;
  
  // Row 3
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(0, 0, 0);
  doc.text('⏱️ Presión:', 25, y);
  doc.setFont('helvetica', 'bold');
  doc.text(`${pressure} hPa`, 70, y);
  
  doc.setFont('helvetica', 'normal');
  doc.text('☁️ Condición:', 110, y);
  doc.setFont('helvetica', 'bold');
  doc.text(description.charAt(0).toUpperCase() + description.slice(1), 145, y);
  
  y += 25;
  
  // Additional Metrics
  doc.setFillColor(248, 250, 252);
  doc.roundedRect(15, y - 5, pageWidth - 30, 70, 3, 3, 'F');
  
  y += 5;
  doc.setFontSize(14);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...colors.secondary);
  doc.text('MÉTRICAS ADICIONALES', 25, y);
  
  y += 12;
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  
  const dewPoint = document.getElementById('dew-point')?.textContent || '--';
  const uvIndex = document.getElementById('uv-index')?.textContent || '--';
  const visibility = document.getElementById('visibility')?.textContent || '--';
  const cloudCover = document.getElementById('cloud-cover')?.textContent || '--';
  const gusts = document.getElementById('gusts')?.textContent || '--';
  const aqi = document.getElementById('aqi-value')?.textContent || '--';
  
  doc.text(`Punto de Rocío: ${dewPoint}`, 25, y);
  doc.text(`Índice UV: ${uvIndex}`, 110, y);
  
  y += 8;
  doc.text(`Visibilidad: ${visibility}`, 25, y);
  doc.text(`Nubosidad: ${cloudCover}`, 110, y);
  
  y += 8;
  doc.text(`Ráfagas: ${gusts}`, 25, y);
  doc.text(`Calidad del Aire (AQI): ${aqi}`, 110, y);
  
  y += 25;
  
  // Recommendations Section
  doc.setFillColor(...colors.accent);
  doc.roundedRect(15, y - 5, pageWidth - 30, 60, 3, 3, 'F');
  
  y += 5;
  doc.setFontSize(14);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(255, 255, 255);
  doc.text('RECOMENDACIONES', 25, y);
  
  y += 10;
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  
  const recommendations = generateRecommendations(temp, humidity, wind, description);
  recommendations.forEach(rec => {
    doc.text(`• ${rec}`, 25, y);
    y += 7;
  });
  
  y += 15;
  
  // Forecast if available
  if (currentDailyForecast && currentDailyForecast.length > 0) {
    if (y > pageHeight - 60) {
      doc.addPage();
      y = 20;
    }
    
    doc.setFillColor(248, 250, 252);
    doc.roundedRect(15, y - 5, pageWidth - 30, 50, 3, 3, 'F');
    
    y += 5;
    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...colors.primary);
    doc.text('PRONÓSTICO PRÓXIMOS DÍAS', 25, y);
    
    y += 10;
    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(0, 0, 0);
    
    currentDailyForecast.slice(0, 5).forEach((day, i) => {
      const dayName = typeof day.day === 'string' ? day.day : `Día ${i + 1}`;
      doc.text(`${dayName}: ${Math.round(day.temp || day.high || 20)}° - ${day.icon || '☁️'}`, 25, y);
      y += 6;
    });
  }
  
  // Footer
  const pageCount = doc.internal.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFillColor(...colors.primary);
    doc.rect(0, pageHeight - 15, pageWidth, 15, 'F');
    
    doc.setFontSize(8);
    doc.setTextColor(255, 255, 255);
    doc.text(`Página ${i} de ${pageCount}`, pageWidth / 2, pageHeight - 7, { align: 'center' });
    doc.text('Zeus Meteo - weather-agent-mbnt.onrender.com', pageWidth / 2, pageHeight - 3, { align: 'center' });
  }
  
  // Save
  const fileName = `Zeus_Meteo_${(currentReport.location || 'reporte').replace(/\s+/g, '_')}_${new Date().toISOString().split('T')[0]}.pdf`;
  doc.save(fileName);
  
  showNotification('📄 Informe PDF descargado exitosamente', 'success');
}

function generateRecommendations(temp, humidity, wind, description) {
  const recs = [];
  const desc = description.toLowerCase();
  
  if (temp >= 35) {
    recs.push('Extremar precaución por ola de calor. Hidratarse frecuentemente.');
    recs.push('Evitar exposición solar directa entre 12-17h.');
  } else if (temp >= 30) {
    recs.push('Temperatura alta. Usar protector solar FPS 30+.');
    recs.push('Ropa ligera y colores claros recomendados.');
  } else if (temp >= 25) {
    recs.push('Clima agradable. Perfecto para actividades al aire libre.');
  } else if (temp <= 5) {
    recs.push('Temperatura muy baja. Abrígarse adecuadamente.');
    recs.push('Precaución con tuberías y plantas sensibles al frío.');
  } else if (temp <= 15) {
    recs.push('Llevar chaqueta o abrigo, especialmente en la mañana y noche.');
  }
  
  if (humidity >= 80) {
    recs.push('Alta humedad. Sensación de incomodidad posible.');
  } else if (humidity < 30) {
    recs.push('Baja humedad. Hidratarse y usar crema hidratante.');
  }
  
  if (wind >= 50) {
    recs.push('Vientos fuertes. Precaución al conducir vehículos altos.');
  }
  
  if (desc.includes('lluvia') || desc.includes('rain')) {
    recs.push('Lluvia esperada. Llevar paraguas o impermeable.');
    recs.push('Conducir con precaución por roadways mojados.');
  }
  
  if (desc.includes('tormenta') || desc.includes('thunder')) {
    recs.push('Tormenta eléctrica. Buscar refugio interior.');
    recs.push('Evitar actividades al aire libre.');
  }
  
  if (recs.length === 0) {
    recs.push('Condiciones climáticas favorables.');
    recs.push('Disfruta del día con normalidad.');
  }
  
  return recs.slice(0, 5);
}

// ============================================
// WEATHER MAP
// ============================================
function updateWeatherMap(lat, lng) {
  const mapFrame = document.getElementById('weather-map');
  if (!mapFrame || !lat || !lng) return;
  
  // Use OpenStreetMap with weather layer
  const zoom = 10;
  mapFrame.src = `https://www.openstreetmap.org/export/embed.html?bbox=${lng - 0.5},${lat - 0.5},${lng + 0.5},${lat + 0.5}&layer=mapnik&marker=${lat},${lng}`;
}

// ============================================
// ENHANCED SEARCH WITH AUTOCOMPLETE
// ============================================
let searchSuggestions = [];
let selectedSuggestionIndex = -1;

// Search debounce timer
let searchDebounceTimer = null;

async function handleSearchInput(input) {
  const query = input.value.trim();
  
  if (query.length < 2) {
    hideSearchSuggestions();
    return;
  }
  
  // Clear previous timer
  if (searchDebounceTimer) {
    clearTimeout(searchDebounceTimer);
  }
  
  // Debounce: wait 300ms after typing stops
  searchDebounceTimer = setTimeout(async () => {
    try {
      const response = await fetch(`/api/search?q=${encodeURIComponent(query)}`);
      const data = await response.json();
      
      if (data && data.length > 0) {
        searchSuggestions = data.slice(0, 6);
        showSearchSuggestions(searchSuggestions);
      }
    } catch (e) {
      console.warn('Search error:', e);
    }
  }, 300);
}

function showSearchSuggestions(suggestions) {
  const container = document.getElementById('search-suggestions');
  if (!container) return;
  
  container.innerHTML = suggestions.map((s, i) => `
    <div class="suggestion-item" onclick="selectSuggestion('${s.name}, ${s.country || ''}')" 
         style="${i === selectedSuggestionIndex ? 'background: var(--nasa-blue);' : ''}">
      <span class="suggestion-icon">📍</span>
      <div class="suggestion-info">
        <span class="suggestion-name">${s.name}</span>
        <span class="suggestion-country">${s.country || ''}</span>
      </div>
    </div>
  `).join('');
  
  container.classList.add('active');
}

function hideSearchSuggestions() {
  const container = document.getElementById('search-suggestions');
  if (container) container.classList.remove('active');
  searchSuggestions = [];
  selectedSuggestionIndex = -1;
}

function selectSuggestion(location) {
  document.getElementById('location-input').value = location;
  hideSearchSuggestions();
  searchWeather();
}

// Keyboard navigation for suggestions
document.addEventListener('keydown', (e) => {
  const input = document.getElementById('location-input');
  if (!input || document.activeElement !== input) return;
  
  if (e.key === 'ArrowDown') {
    e.preventDefault();
    selectedSuggestionIndex = Math.min(selectedSuggestionIndex + 1, searchSuggestions.length - 1);
    showSearchSuggestions(searchSuggestions);
  } else if (e.key === 'ArrowUp') {
    e.preventDefault();
    selectedSuggestionIndex = Math.max(selectedSuggestionIndex - 1, -1);
    showSearchSuggestions(searchSuggestions);
  } else if (e.key === 'Enter' && selectedSuggestionIndex >= 0) {
    e.preventDefault();
    selectSuggestion(searchSuggestions[selectedSuggestionIndex].name + ', ' + searchSuggestions[selectedSuggestionIndex].country);
  } else if (e.key === 'Escape') {
    hideSearchSuggestions();
  }
});

// ============================================
// ENHANCED GEOLOCATION WITH FEEDBACK
// ============================================
async function searchCurrentLocation() {
  if (!navigator.geolocation) {
    showNotification('Geolocalización no soportada por tu navegador', 'error');
    return;
  }
  
  const btn = document.querySelector('.location-btn');
  if (btn) {
    btn.innerHTML = '<span class="location-spinner"></span>';
  }
  
  navigator.geolocation.getCurrentPosition(
    async (position) => {
      const { latitude, longitude } = position.coords;
      
      try {
        const response = await fetch(`/api/weather?location=${latitude},${longitude}`);
        const data = await response.json();
        
        if (data.success) {
          currentReport = data.report;
          currentLocation = data.report.location;
          document.getElementById('empty-state-hero').style.display = 'none';
          document.getElementById('main-content').style.display = 'grid';
          
          updateCurrentWeather(data.report);
          await fetchExtendedForecast(data.report.location);
          updateDynamicBackground(data.report.description);
          loadEnhancedFeatures(data.report);
        } else {
          showNotification(data.error || 'Ubicación no encontrada', 'error');
        }
      } catch (e) {
        showNotification('Error al obtener clima', 'error');
      } finally {
        if (btn) btn.innerHTML = '📍';
      }
    },
    (error) => {
      if (btn) btn.innerHTML = '📍';
      
      let message = 'Error de geolocalización';
      if (error.code === error.PERMISSION_DENIED) {
        message = 'Permiso de ubicación denegado. Actívalo en tu navegador.';
      } else if (error.code === error.POSITION_UNAVAILABLE) {
        message = 'Ubicación no disponible';
      }
      
      showNotification(message, 'warning');
    },
    { timeout: 10000, enableHighAccuracy: true }
  );
}

// ============================================
// DYNAMIC WEATHER THEMES
// ============================================
function updateDynamicBackground(desc = '') {
  const root = document.documentElement;
  const hour = new Date().getHours();
  const isNight = hour < 6 || hour > 20;
  
  let h, s, l;
  
  if (isNight) {
    h = 250; s = '60%'; l = '15%';
  } else if (desc.includes('lluvia') || desc.includes('rain')) {
    h = 210; s = '70%'; l = '25%';
  } else if (desc.includes('nublado') || desc.includes('cloudy')) {
    h = 200; s = '30%'; l = '35%';
  } else if (desc.includes('soleado') || desc.includes('clear')) {
    h = 195; s = '80%'; l = '55%';
  } else {
    h = 210; s = '50%'; l = '30%';
  }
  
  root.style.setProperty('--primary-h', h);
  root.style.setProperty('--primary-s', s);
  root.style.setProperty('--primary-l', l);
  weatherTheme = desc;
}

// ============================================
// CHATBOT WITH GROQ API (PRE-CONFIGURED)
// ============================================
let chatHistory = [];

async function sendChatMessage() {
  const input = document.getElementById('chatbot-input-nasa');
  const content = input.value.trim();
  if (!content) return;

  appendMessage('user', content);
  input.value = '';
  chatHistory.push({ role: 'user', content });

  // Show typing indicator
  const container = document.getElementById('chatbot-messages');
  const typingDiv = document.createElement('div');
  typingDiv.className = 'msg-bubble msg-assistant typing-indicator';
  typingDiv.innerHTML = '<span class="typing-dot"></span><span class="typing-dot"></span><span class="typing-dot"></span>';
  container.appendChild(typingDiv);
  container.scrollTop = container.scrollHeight;

  try {
    // First check for local commands
    const commandResponse = await handleChatCommand(content);
    if (commandResponse) {
      typingDiv.remove();
      appendMessage('assistant', commandResponse);
      chatHistory.push({ role: 'assistant', content: commandResponse });
      return;
    }
    
    // Call Groq API via our backend
    const response = await fetch('/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
        message: content, 
        context: currentReport,
        history: chatHistory.slice(-10)
      })
    });
    
    typingDiv.remove();
    
    const data = await response.json();
    appendMessage('assistant', data.response);
    chatHistory.push({ role: 'assistant', content: data.response });
  } catch (e) {
    typingDiv.remove();
    appendMessage('assistant', 'Lo siento, mi conexión con Zeus se ha interrumpido. Intenta de nuevo.');
  }
}

function appendMessage(role, content) {
  const container = document.getElementById('chatbot-messages');
  const div = document.createElement('div');
  div.className = `msg-bubble msg-${role}`;
  div.innerHTML = content.replace(/\n/g, '<br>');
  container.appendChild(div);
  container.scrollTop = container.scrollHeight;
}

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

function switchForecastDays(days, btn) {
  // Update button states
  document.querySelectorAll('.filter-tabs .prompt-chip').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  
  // Show loading
  if (currentLocation) {
    fetch(`/api/forecast-${days}days?location=${encodeURIComponent(currentLocation)}`)
      .then(r => r.json())
      .then(data => {
        if (data.success && data.forecast) {
          const forecastData = data.forecast.map((day, i) => ({
            day: new Date(day.date).toLocaleDateString('es', { weekday: 'short' }),
            temp: (day.temperatureMax + day.temperatureMin) / 2,
            icon: getWeatherIcon(day.description || 'cloudy'),
            high: day.temperatureMax,
            low: day.temperatureMin
          }));
          currentDailyForecast = forecastData;
          displayDailyForecast(forecastData);
          renderTemperatureChart(forecastData);
        }
      })
      .catch(e => console.warn('Forecast switch error:', e));
  }
}

function filterHours(hours, btn) {
  // Similar logic for hourly forecast
  document.querySelectorAll('.forecast-scroll-container + .filter-tabs .prompt-chip').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
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

  // Update main map (top section)
  const mapFrame = document.getElementById('map-iframe');
  if (mapFrame && report.lat && report.lng && !isNaN(report.lat) && !isNaN(report.lng)) {
    const lat = parseFloat(report.lat);
    const lng = parseFloat(report.lng);
    mapFrame.src = `https://www.openstreetmap.org/export/embed.html?bbox=${lng - 0.1},${lat - 0.1},${lng + 0.1},${lat + 0.1}&layer=mapnik&marker=${lat},${lng}`;
    
    // Also update weather map in sidebar
    updateWeatherMap(lat, lng);
  }
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
  const root = document.documentElement;
  const hour = new Date().getHours();
  const isNight = hour < 6 || hour > 20;
  const d = (desc || '').toLowerCase();
  
  let h, s, l;
  
  if (isNight) {
    // Night: dark green/teal
    h = 170; s = '40%'; l = '12%';
  } else if (d.includes('lluvia') || d.includes('rain') || d.includes('tormenta')) {
    // Rainy: darker teal/green
    h = 175; s = '50%'; l = '20%';
  } else if (d.includes('nublado') || d.includes('cloudy')) {
    // Cloudy: neutral green-gray
    h = 150; s = '30%'; l = '25%';
  } else if (d.includes('soleado') || d.includes('clear') || d.includes('despejado')) {
    // Sunny: bright green/yellow
    h = 100; s = '60%'; l = '40%';
  } else if (d.includes('nieve') || d.includes('snow')) {
    // Snow: light blue-white
    h = 190; s = '40%'; l = '85%';
  } else {
    // Default: green
    h = 142; s = '50%'; l = '25%';
  }
  
  root.style.setProperty('--primary-h', h);
  root.style.setProperty('--primary-s', s);
  root.style.setProperty('--primary-l', l);
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
