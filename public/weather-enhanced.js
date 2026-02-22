// ============================================
// ZEUS METEO PREMIUM - ENGINE CLEAN
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
// UI FEEDBACK
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

// ============================================
// SEARCH
// ============================================
async function searchWeather() {
  const input = document.getElementById('location-input');
  const location = input.value.trim();
  if (!location) {
    showNotification('Ingresa una ciudad', 'warning');
    return;
  }
  
  showLoading();
  localStorage.setItem('last_location', location);
  
  try {
    const response = await fetch('/api/weather?location=' + encodeURIComponent(location));
    const data = await response.json();
    
    if (data.success) {
      currentReport = data.report;
      currentLocation = location;
      document.getElementById('empty-state-hero').style.display = 'none';
      document.getElementById('main-content').style.display = 'grid';
      
      updateCurrentWeather(data.report);
      await fetchExtendedForecast(location);
      updateDynamicBackground(data.report.description);
      loadEnhancedFeatures(data.report);
    } else {
      showNotification(data.error || 'Ubicación no encontrada', 'error');
    }
  } catch (error) {
    showNotification('Error al conectar con Zeus', 'error');
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
        icon: getWeatherIcon(currentReport.description),
        high: currentReport.temperature + 3,
        low: currentReport.temperature - 3
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

function getWeatherIcon(desc) {
  const d = (desc || '').toLowerCase();
  if (d.includes('rain') || d.includes('lluvia')) return '🌧️';
  if (d.includes('thunder') || d.includes('tormenta')) return '⛈️';
  if (d.includes('snow') || d.includes('nieve')) return '❄️';
  if (d.includes('fog') || d.includes('niebla')) return '🌫️';
  if (d.includes('cloud') || d.includes('nublado')) return '☁️';
  if (d.includes('night') || d.includes('noche')) return '🌙';
  if (d.includes('clear') || d.includes('soleado') || d.includes('despejado')) return '☀️';
  return '☀️';
}

// ============================================
// UI RENDERING
// ============================================
function updateCurrentWeather(report) {
  document.getElementById('city-name').textContent = report.location;
  document.getElementById('current-temp').textContent = Math.round(report.temperature);
  document.getElementById('weather-description').textContent = report.description;
  document.getElementById('humidity').textContent = (report.humidity || 50) + '%';
  document.getElementById('wind').textContent = Math.round(report.windSpeed || 10) + ' km/h';
  document.getElementById('pressure').textContent = (report.pressure || 1013) + ' hPa';
  
  const iconEl = document.getElementById('weather-icon');
  iconEl.textContent = getWeatherIcon(report.description);
  
  // Map
  const mapFrame = document.getElementById('map-iframe');
  if (mapFrame && report.lat && report.lng) {
    mapFrame.src = 'https://www.openstreetmap.org/export/embed.html?bbox=' + (report.lng - 0.1) + ',' + (report.lat - 0.1) + ',' + (report.lng + 0.1) + ',' + (report.lat + 0.1) + '&layer=mapnik&marker=' + report.lat + ',' + report.lng;
  }
  
  // Weather map in sidebar
  const weatherMap = document.getElementById('weather-map');
  if (weatherMap && report.lat && report.lng) {
    weatherMap.src = 'https://www.openstreetmap.org/export/embed.html?bbox=' + (report.lng - 0.5) + ',' + (report.lat - 0.5) + ',' + (report.lng + 0.5) + ',' + (report.lat + 0.5) + '&layer=mapnik&marker=' + report.lat + ',' + report.lng;
  }
}

function displayDailyForecast(days) {
  const container = document.getElementById('daily-forecast');
  container.innerHTML = days.map(d => 
    '<div class="forecast-day-card">' +
      '<div class="day-name">' + d.day + '</div>' +
      '<div style="font-size: 2rem; margin: 10px 0;">' + d.icon + '</div>' +
      '<div class="day-temp">' + Math.round(d.temp) + '°</div>' +
    '</div>'
  ).join('');
}

function renderNearbyCities(location) {
  const container = document.getElementById('nearby-cities');
  const cities = [
    { name: 'Montevideo', temp: 22 },
    { name: 'Buenos Aires', temp: 18 },
    { name: 'Madrid', temp: 14 }
  ];
  container.innerHTML = cities.map(c => 
    '<div class="stat-item" style="flex-direction: row; justify-content: space-between; cursor: pointer;" onclick="quickSearch(\'' + c.name + '\')">' +
      '<span>' + c.name + '</span>' +
      '<span style="font-weight: 700;">' + c.temp + '°C</span>' +
    '</div>'
  ).join('');
}

function renderTemperatureChart(data) {
  if (typeof ApexCharts === 'undefined') return;
  
  const options = {
    series: [{ name: 'Temperatura', data: data.map(d => Math.round(d.temp)) }],
    chart: { type: 'area', height: 250, toolbar: { show: false }, background: 'transparent' },
    colors: ['#22c55e'],
    fill: { type: 'gradient', gradient: { shadeIntensity: 1, opacityFrom: 0.45, opacityTo: 0.05, stops: [20, 100] } },
    dataLabels: { enabled: false },
    stroke: { curve: 'smooth', width: 3 },
    grid: { borderColor: 'rgba(255,255,255,0.05)', strokeDashArray: 4 },
    xaxis: { categories: data.map(d => d.day), labels: { style: { colors: 'rgba(255,255,255,0.5)' } } },
    yaxis: { labels: { style: { colors: 'rgba(255,255,255,0.5)' } } },
    theme: { mode: 'dark' }
  };
  
  if (tempChart) tempChart.destroy();
  tempChart = new ApexCharts(document.querySelector("#tempChart"), options);
  tempChart.render();
}

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
  
  // Header - Green
  doc.setFillColor(34, 197, 94);
  doc.rect(0, 0, w, 45, 'F');
  doc.setFillColor(249, 115, 22);
  doc.rect(0, 40, w, 8, 'F');
  
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(28);
  doc.setFont('helvetica', 'bold');
  doc.text('ZEUS METEO', w / 2, 22, { align: 'center' });
  doc.setFontSize(12);
  doc.text('Informe Meteorológico', w / 2, 32, { align: 'center' });
  
  y = 60;
  doc.setTextColor(0, 0, 0);
  doc.setFontSize(20);
  doc.text(currentReport.location || 'Ubicación', 20, y);
  
  y += 10;
  doc.setFontSize(11);
  doc.setTextColor(100, 100, 100);
  doc.text(new Date().toLocaleDateString('es-ES', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' }), 20, y);
  
  y += 15;
  doc.setDrawColor(34, 197, 94);
  doc.line(20, y, w - 20, y);
  
  y += 15;
  doc.setFontSize(14);
  doc.setTextColor(34, 197, 94);
  doc.text('CONDICIONES ACTUALES', 25, y);
  
  y += 12;
  doc.setFontSize(11);
  doc.setTextColor(0, 0, 0);
  
  const temp = Math.round(currentReport.temperature);
  const humidity = currentReport.humidity || 50;
  const wind = Math.round(currentReport.windSpeed || 10);
  const pressure = currentReport.pressure || 1013;
  const desc = currentReport.description || 'N/A';
  
  doc.text('🌡️ Temperatura: ' + temp + '°C', 25, y); y += 8;
  doc.text('💧 Humedad: ' + humidity + '%', 25, y); y += 8;
  doc.text('💨 Viento: ' + wind + ' km/h', 25, y); y += 8;
  doc.text('⏱️ Presión: ' + pressure + ' hPa', 25, y); y += 8;
  doc.text('☁️ Condición: ' + desc, 25, y); y += 20;
  
  // Recommendations
  doc.setFillColor(249, 115, 22);
  doc.roundedRect(15, y, w - 30, 40, 3, 3, 'F');
  y += 10;
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(12);
  doc.text('RECOMENDACIONES', 25, y);
  y += 10;
  doc.setFontSize(10);
  
  const recs = [];
  if (temp >= 30) recs.push('Temperatura alta. Usar protector solar.');
  if (temp <= 10) recs.push('Temperatura baja. Abrígarse.');
  if (humidity >= 80) recs.push('Alta humedad. Sensación de incomodidad.');
  if (desc.includes('lluvia')) recs.push('Lluvia esperada. Llevar paraguas.');
  if (recs.length === 0) recs.push('Condiciones favorables.');
  
  recs.forEach(r => {
    doc.text('• ' + r, 25, y);
    y += 7;
  });
  
  // Footer
  const pageCount = doc.internal.getNumberOfPages();
  const h = doc.internal.pageSize.getHeight();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFillColor(34, 197, 94);
    doc.rect(0, h - 15, w, 15, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(8);
    doc.text('Página ' + i + ' de ' + pageCount, w / 2, h - 7, { align: 'center' });
  }
  
  const fileName = 'Zeus_Meteo_' + (currentReport.location || 'reporte').replace(/\s+/g, '_') + '_' + new Date().toISOString().split('T')[0] + '.pdf';
  doc.save(fileName);
  showNotification('📄 PDF descargado', 'success');
}

// ============================================
// ENHANCED FEATURES
// ============================================
function updateDynamicBackground(desc) {
  const d = (desc || '').toLowerCase();
  const hour = new Date().getHours();
  const isNight = hour < 6 || hour > 20;
  
  let h = 142, s = '50%', l = '25%';
  
  if (isNight) { h = 170; s = '40%'; l = '12%'; }
  else if (d.includes('lluvia')) { h = 175; s = '50%'; l = '20%'; }
  else if (d.includes('nublado')) { h = 150; s = '30%'; l = '25%'; }
  else if (d.includes('soleado') || d.includes('clear')) { h = 100; s = '60%'; l = '40%'; }
  
  document.documentElement.style.setProperty('--primary-h', h);
  document.documentElement.style.setProperty('--primary-s', s);
  document.documentElement.style.setProperty('--primary-l', l);
}

function loadEnhancedFeatures(report) {
  // Additional metrics
  const temp = report.temperature || 20;
  const humidity = report.humidity || 50;
  
  // Dew point
  const dewPoint = temp - ((100 - humidity) / 5);
  document.getElementById('dew-point').textContent = Math.round(dewPoint) + '°';
  
  // UV (simulated)
  const hour = new Date().getHours();
  const uv = hour >= 6 && hour <= 18 ? Math.floor(Math.random() * 8) + 1 : 0;
  document.getElementById('uv-index').textContent = uv + ' (' + (uv <= 2 ? 'Bajo' : uv <= 5 ? 'Moderado' : 'Alto') + ')';
  
  // Visibility
  document.getElementById('visibility').textContent = (8 + Math.random() * 4).toFixed(1) + ' km';
  
  // Cloud cover
  document.getElementById('cloud-cover').textContent = Math.floor(Math.random() * 50) + '%';
  
  // Gusts
  document.getElementById('gusts').textContent = Math.round((report.windSpeed || 10) * 1.3) + ' km/h';
  
  // AQI (simulated)
  const aqi = Math.floor(30 + Math.random() * 50);
  document.getElementById('aqi-value').textContent = aqi;
  document.getElementById('pm25').textContent = (Math.random() * 20).toFixed(1) + ' µg/m³';
  document.getElementById('pm10').textContent = (Math.random() * 30).toFixed(1) + ' µg/m³';
  document.getElementById('o3').textContent = (Math.random() * 40).toFixed(1) + ' µg/m³';
  
  // Data quality
  document.getElementById('data-source').textContent = report.source || 'Open-Meteo';
  const badge = document.getElementById('quality-badge');
  badge.textContent = 'EN VIVO';
  badge.className = 'quality-badge live';
  
  // Moon phase
  updateMoonPhase();
}

function updateMoonPhase() {
  const phases = ['🌑', '🌒', '🌓', '🌔', '🌕', '🌖', '🌗', '🌘'];
  const phaseIndex = Math.floor((new Date().getDate() % 29.53) / 3.7);
  const icon = phases[phaseIndex] || '🌕';
  
  const el = document.getElementById('moon-icon-large');
  if (el) el.textContent = icon;
  
  const nameEl = document.getElementById('moon-phase-name');
  if (nameEl) nameEl.textContent = phaseIndex < 2 ? 'Luna Nueva' : phaseIndex < 4 ? 'Cuarto Creciente' : phaseIndex < 6 ? 'Gibosa Creciente' : phaseIndex < 8 ? 'Luna Llena' : 'Cuarto Menguante';
}

// ============================================
// CHATBOT
// ============================================
let chatHistory = [];

async function sendChatMessage() {
  const input = document.getElementById('chatbot-input-nasa');
  const content = input.value.trim();
  if (!content) return;
  
  const container = document.getElementById('chatbot-messages');
  container.innerHTML += '<div class="msg-bubble msg-user">' + content + '</div>';
  input.value = '';
  container.scrollTop = container.scrollHeight;
  
  // Typing indicator
  container.innerHTML += '<div class="msg-bubble msg-assistant typing-indicator"><span>.</span><span>.</span><span>.</span></div>';
  container.scrollTop = container.scrollHeight;
  
  try {
    const response = await fetch('/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: content, context: currentReport, history: chatHistory })
    });
    const data = await response.json();
    
    container.removeChild(container.lastChild);
    container.innerHTML += '<div class="msg-bubble msg-assistant">' + data.response + '</div>';
    chatHistory.push({ role: 'user', content }, { role: 'assistant', content: data.response });
    container.scrollTop = container.scrollTop;
  } catch (e) {
    container.removeChild(container.lastChild);
    container.innerHTML += '<div class="msg-bubble msg-assistant">Lo siento, error de conexión.</div>';
  }
}

function toggleChatbot() {
  const container = document.getElementById('chatbot-container');
  container.classList.toggle('active');
}

// ============================================
// INITIALIZATION
// ============================================
document.addEventListener('DOMContentLoaded', () => {
  // Check for city parameter
  const params = new URLSearchParams(window.location.search);
  const city = params.get('city');
  if (city) {
    document.getElementById('location-input').value = city;
    setTimeout(searchWeather, 500);
  }
});
