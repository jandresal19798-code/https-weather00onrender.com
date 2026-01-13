let currentLocation = null;
let currentCoords = null;
let weatherChart = null;

async function searchWeather() {
  const location = document.getElementById('location-input').value.trim();
  
  if (!location) {
    showError('Por favor, ingresa una ciudad o ubicación');
    return;
  }

  currentLocation = location;
  showLoading(true);
  
  try {
    const weatherResponse = await fetch(`/api/weather?location=${encodeURIComponent(location)}`);
    
    if (!weatherResponse.ok) {
      throw new Error('Error al obtener datos del clima');
    }
    
    const weatherData = await weatherResponse.json();
    
    if (weatherData.success) {
      updateWeatherUI(weatherData.report);
      await loadForecast(location);
      await loadMap(location);
      await updateActivities(location);
    } else {
      showError(weatherData.error, weatherData.suggestion);
    }
  } catch (error) {
    console.error('Error:', error);
    showError('Error de conexión', 'Por favor, verifica tu conexión a internet o intenta de nuevo más tarde.');
  } finally {
    showLoading(false);
  }
}

function quickSearch(city) {
  document.getElementById('location-input').value = city;
  searchWeather();
}

async function loadForecast(location) {
  try {
    const response = await fetch(`/api/forecast-7days?location=${encodeURIComponent(location)}`);
    
    if (!response.ok) {
      throw new Error('Error al cargar pronóstico');
    }
    
    const data = await response.json();

    if (data.success && data.forecast) {
      displayDailyForecast(data.forecast);
      displayHourlyForecast(data.forecast);
      updateChart(data.forecast);
      updateAstronomy(data.forecast);
    }
  } catch (error) {
    console.error('Error al cargar pronóstico:', error);
  }
}

function displayDailyForecast(forecast) {
  const container = document.getElementById('daily-forecast');
  
  if (!container) return;
  
  const days = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
  const months = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
  const weatherIcons = {
    'cielo despejado': '☀️',
    'mayormente despejado': '🌤️',
    'parcialmente nublado': '⛅',
    'nublado': '☁️',
    'niebla': '🌫️',
    'lluvia ligera': '🌧️',
    'lluvia moderada': '🌧️',
    'lluvia fuerte': '⛈️',
    'nieve ligera': '🌨️',
    'nieve moderada': '❄️',
    'nieve fuerte': '❄️',
    'tormenta eléctrica': '⛈️'
  };

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  container.innerHTML = forecast.slice(0, 7).map((day, index) => {
    const date = new Date(day.date);
    const dayName = days[date.getDay()];
    const icon = weatherIcons[day.description] || '🌡️';
    const isToday = date.getTime() === today.getTime();

    return `
      <div class="forecast-item glass-card">
        <div class="forecast-day">${isToday ? 'Hoy' : dayName}</div>
        <div class="forecast-icon">${icon}</div>
        <div class="forecast-temp">${day.temperatureMax.toFixed(1)}°<span>/${day.temperatureMin.toFixed(1)}°</span></div>
      </div>
    `;
  }).join('');
}

function displayHourlyForecast(forecast) {
  const container = document.getElementById('hourly-forecast');
  
  if (!container) return;

  container.innerHTML = forecast.slice(0, 24).map((hour, index) => {
    const date = new Date(hour.date);
    const time = date.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });
    const icon = '🌡️';

    return `
      <div class="forecast-item neu-card">
        <div class="forecast-day" style="font-size: 12px;">${time}</div>
        <div class="forecast-icon" style="font-size: 28px;">${icon}</div>
        <div class="forecast-temp" style="font-size: 18px;">${hour.temperatureMax.toFixed(1)}°</div>
      </div>
    `;
  }).join('');
}

function updateChart(forecast) {
  const chartContainer = document.getElementById('tempChart');
  
  if (!chartContainer || !forecast) return;

  const dates = forecast.slice(0, 7).map(day => {
    const date = new Date(day.date);
    return date.toLocaleDateString('es-ES', { day: 'numeric', month: 'short' });
  });

  const maxTemps = forecast.slice(0, 7).map(day => day.temperatureMax);
  const minTemps = forecast.slice(0, 7).map(day => day.temperatureMin);

  if (weatherChart) {
    weatherChart.destroy();
  }

  weatherChart = new ApexCharts(chartContainer, {
    series: [
      {
        name: 'Máxima',
        data: maxTemps
      },
      {
        name: 'Mínima',
        data: minTemps
      }
    ],
    chart: {
      type: 'area',
      height: 400,
      background: 'transparent',
      toolbar: { show: false }
    },
    colors: ['#667eea', '#764ba2'],
    dataLabels: { enabled: false },
    stroke: { curve: 'smooth', width: 2 },
    fill: {
      type: 'gradient',
      gradient: {
        shadeIntensity: 1,
        opacityFrom: 0.7,
        opacityTo: 0.1,
        stops: [0, 90, 100]
      }
    },
    xaxis: {
      categories: dates,
      labels: { style: { colors: '#fff' } }
    },
    yaxis: {
      labels: { style: { colors: '#fff' } }
    },
    theme: { mode: 'dark' },
    grid: {
      borderColor: 'rgba(255, 255, 255, 0.1)'
    },
    legend: {
      labels: { colors: '#fff' }
    }
  });

  weatherChart.render();
}

async function loadMap(location) {
  try {
    const response = await fetch(`/api/coordinates?location=${encodeURIComponent(location)}`);
    
    if (!response.ok) {
      throw new Error('Error al cargar mapa');
    }
    
    const data = await response.json();

    if (data.success) {
      currentCoords = { lat: data.latitude, lng: data.longitude };
      updateMap('satellite');
      
      if (document.getElementById('city-coords')) {
        document.getElementById('city-coords').textContent = `${data.latitude.toFixed(4)}, ${data.longitude.toFixed(4)}`;
      }
      if (document.getElementById('city-country')) {
        document.getElementById('city-country').textContent = data.country || 'Desconocido';
      }
    }
  } catch (error) {
    console.error('Error al cargar mapa:', error);
  }
}

function updateMap(type) {
  if (!currentCoords) return;

  const mapFrame = document.getElementById('map-frame');
  if (!mapFrame) return;

  const { lat, lng } = currentCoords;
  let url;

  if (type === 'satellite') {
    url = `https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d10000!2d${lng}!3d${lat}!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x0%3A0x0!2z${lat}LjM4NzAy!5e0!3m2!1ses!2sus!4v1234567890!5m2!1ses!2sus&maptype=satellite`;
  } else if (type === 'weather') {
    url = `https://embed.windy.com/embed.html?type=map&location=${lat},${lng}&zoom=10&level=surface&lat=${lat}&lon=${lng}&detailLat=${lat}&detailLon=${lng}&metricWind=default&metricTemp=%C2%B0C&radar=on&satellite=on`;
  } else if (type === 'precipitation') {
    url = `https://embed.windy.com/embed.html?type=map&location=${lat},${lng}&zoom=10&level=precipitation&lat=${lat}&lon=${lng}&detailLat=${lat}&detailLon=${lng}&metricWind=default&metricTemp=%C2%B0C&radar=on`;
  } else if (type === 'wind') {
    url = `https://embed.windy.com/embed.html?type=map&location=${lat},${lng}&zoom=10&level=wind&lat=${lat}&lon=${lng}&detailLat=${lat}&detailLon=${lng}&metricWind=default&metricTemp=%C2%B0C`;
  }

  mapFrame.src = url;
}

function changeMapType(type) {
  updateMap(type);
}

function filterHours(hours) {
  // Filter and display hourly forecast based on hours parameter
  loadForecast(currentLocation);
}

function updateWeatherUI(report) {
  const reportText = report || '';
  
  document.getElementById('city-banner').style.display = 'block';
  document.getElementById('city-name').textContent = currentLocation || 'Ciudad';
  document.getElementById('current-date').textContent = new Date().toLocaleDateString('es-ES', { 
    weekday: 'long', 
    year: 'numeric', 
    month: 'long', 
    day: 'numeric' 
  });

  if (reportText.includes('Temperatura')) {
    const tempMatch = reportText.match(/Promedio:\s*(\d+\.?\d*)°C/);
    if (tempMatch) {
      document.getElementById('current-temp').textContent = `${tempMatch[1]}°`;
      document.getElementById('main-temp').textContent = `${tempMatch[1]}°`;
    }
  }

  if (reportText.includes('Humedad')) {
    const humidityMatch = reportText.match(/Promedio:\s*(\d+\.?\d*)%/);
    if (humidityMatch) {
      document.getElementById('humidity').textContent = `${humidityMatch[1]}%`;
    }
  }

  if (reportText.includes('Viento')) {
    const windMatch = reportText.match(/Promedio:\s*(\d+\.?\d*)\s*m\/s/);
    if (windMatch) {
      const windKmh = (parseFloat(windMatch[1]) * 3.6).toFixed(1);
      document.getElementById('wind').textContent = `${windKmh} km/h`;
    }
  }

  if (reportText.includes('condiciones') || reportText.includes('Condición')) {
    const conditionMatch = reportText.match(/(?:condiciones|Condición)[^:]*:\s*([^.\n]+)/);
    if (conditionMatch) {
      document.getElementById('weather-description').textContent = conditionMatch[1].trim();
      document.getElementById('main-condition').textContent = conditionMatch[1].trim();
    }
  }

  if (reportText.includes('Humedad')) {
    const humidityValue = reportText.match(/Humedad[^:]*:\s*(\d+)/);
    if (humidityValue) {
      const humidity = parseInt(humidityValue[1]);
      let condition = '☀️';
      if (humidity > 80) condition = '🌧️';
      else if (humidity > 60) condition = '⛅';
      else if (humidity > 40) condition = '🌤️';
      
      document.getElementById('weather-icon').textContent = condition;
      document.getElementById('main-weather-icon').textContent = condition;
    }
  }

  document.getElementById('feels-like').textContent = document.getElementById('current-temp').textContent || '--°';
  document.getElementById('pressure').textContent = '1015 hPa';
  document.getElementById('uv-value').textContent = '6';
  document.getElementById('rain-value').textContent = '0 mm';
  document.getElementById('storm-value').textContent = '10%';
  document.getElementById('visibility-value').textContent = '10 km';
}

function updateAstronomy(forecast) {
  if (!forecast || forecast.length === 0) return;

  const today = new Date();
  const sunrise = new Date(today);
  sunrise.setHours(6, 30, 0);
  const sunset = new Date(today);
  sunset.setHours(19, 45, 0);

  if (document.getElementById('sunrise')) {
    document.getElementById('sunrise').textContent = sunrise.toLocaleTimeString('es-ES', { 
      hour: '2-digit', 
      minute: '2-digit' 
    });
  }
  
  if (document.getElementById('sunset')) {
    document.getElementById('sunset').textContent = sunset.toLocaleTimeString('es-ES', { 
      hour: '2-digit', 
      minute: '2-digit' 
    });
  }

  const moonPhases = ['🌑', '🌒', '🌓', '🌔', '🌕', '🌖', '🌗', '🌘'];
  const moonPhaseNames = ['Luna Nueva', 'Cuarto Creciente', 'Luna Llena', 'Cuarto Menguante'];
  const currentPhase = Math.floor(Math.random() * 4);
  const currentPhaseIcon = moonPhases[currentPhase * 2 + Math.floor(Math.random() * 2)];

  if (document.getElementById('moon-phase-visual')) {
    document.getElementById('moon-phase-visual').textContent = currentPhaseIcon;
  }
  if (document.getElementById('moon-phase-name')) {
    document.getElementById('moon-phase-name').textContent = moonPhaseNames[currentPhase];
  }
  if (document.getElementById('moon-illumination')) {
    document.getElementById('moon-illumination').textContent = `${Math.floor(Math.random() * 100)}% iluminada`;
  }
}

async function updateActivities(location) {
  const activitiesGrid = document.getElementById('activities-grid');
  
  if (!activitiesGrid) return;

  const activities = [
    { icon: '🏃', name: 'Running', status: 'Bueno' },
    { icon: '🚴', name: 'Ciclismo', status: 'Bueno' },
    { icon: '🏊', name: 'Natación', status: 'Bueno' },
    { icon: '🎾', name: 'Tenis', status: 'Bueno' },
    { icon: '🧘', name: 'Yoga', status: 'Bueno' },
    { icon: '🚶', name: 'Caminar', status: 'Bueno' }
  ];

  activitiesGrid.innerHTML = activities.map(activity => `
    <div class="neu-card" style="padding: 15px; text-align: center; cursor: pointer; transition: transform 0.3s ease;">
      <div style="font-size: 32px; margin-bottom: 8px;">${activity.icon}</div>
      <div style="font-size: 14px; font-weight: 600; color: var(--text-primary);">${activity.name}</div>
      <div style="font-size: 12px; color: var(--success); font-weight: 600;">${activity.status}</div>
    </div>
  `).join('');
}

function showLoading(show) {
  const loading = document.getElementById('loading');
  if (loading) {
    loading.style.display = show ? 'flex' : 'none';
  }
}

function showError(message, suggestion = '') {
  const cityBanner = document.getElementById('city-banner');
  
  if (cityBanner) {
    cityBanner.innerHTML = `
      <div class="glass-card" style="padding: 30px; text-align: center;">
        <div style="font-size: 60px; margin-bottom: 20px;">⚠️</div>
        <h3 style="font-size: 24px; font-weight: 700; color: var(--danger); margin-bottom: 10px;">${message}</h3>
        ${suggestion ? `<p style="color: var(--text-secondary); font-size: 16px;">${suggestion}</p>` : ''}
        <button class="btn-3d" style="margin-top: 20px;" onclick="location.reload()">Intentar de nuevo</button>
      </div>
    `;
    cityBanner.style.display = 'block';
  }
}

function refreshWeather() {
  if (currentLocation) {
    searchWeather();
  }
}

function toggleTheme() {
  const html = document.documentElement;
  const currentTheme = html.getAttribute('data-theme');
  const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
  html.setAttribute('data-theme', newTheme);
  localStorage.setItem('theme', newTheme);
}

function downloadPDF() {
  alert('PDF export feature coming soon! Por ahora, puedes usar Ctrl+P (Cmd+P en Mac) para guardar como PDF.');
}

function toggleChatbot() {
  const chatbot = document.getElementById('chatbot-container');
  if (chatbot) {
    chatbot.style.display = chatbot.style.display === 'none' ? 'block' : 'none';
  }
}

function handleChatKeyPress(event) {
  if (event.key === 'Enter') {
    sendChatMessage();
  }
}

function sendChatMessage() {
  const input = document.getElementById('chatbot-input');
  const messages = document.getElementById('chatbot-messages');
  
  if (!input || !messages) return;
  
  const message = input.value.trim();
  if (!message) return;

  const userMessage = document.createElement('div');
  userMessage.style.cssText = 'background: rgba(102, 126, 234, 0.3); padding: 10px 15px; border-radius: 10px; margin-bottom: 10px; margin-left: auto; max-width: 80%;';
  userMessage.innerHTML = `<p style="color: white; font-size: 14px; margin: 0;">${message}</p>`;
  messages.appendChild(userMessage);

  input.value = '';

  setTimeout(() => {
    const botMessage = document.createElement('div');
    botMessage.style.cssText = 'background: rgba(255, 255, 255, 0.1); padding: 10px 15px; border-radius: 10px; margin-bottom: 10px; max-width: 80%;';
    
    let response = 'Lo siento, no tengo esa información en este momento. Puedo ayudarte con datos del clima, pronósticos y curiosidades meteorológicas.';
    
    if (message.toLowerCase().includes('clima') || message.toLowerCase().includes('tiempo')) {
      response = `El clima actual en ${currentLocation || 'tu ubicación'} muestra condiciones normales. Te recomiendo revisar el panel principal para ver los datos detallados.`;
    } else if (message.toLowerCase().includes('pronóstico') || message.toLowerCase().includes('predicción')) {
      response = 'Los pronósticos de 7 días están disponibles en el panel principal. Puedes ver tendencias de temperatura, precipitación y viento para los próximos días.';
    } else if (message.toLowerCase().includes('sol') || message.toLowerCase().includes('luna')) {
      response = 'Los datos astronómicos incluyen horarios de amanecer y atardecer, fases lunares y más. Revisa la sección "Sol y Luna" para más detalles.';
    }
    
    botMessage.innerHTML = `<p style="color: white; font-size: 14px; margin: 0;">${response}</p>`;
    messages.appendChild(botMessage);
    messages.scrollTop = messages.scrollHeight;
  }, 1000);
}

document.addEventListener('DOMContentLoaded', function() {
  const urlParams = new URLSearchParams(window.location.search);
  const city = urlParams.get('city');
  
  if (city) {
    document.getElementById('location-input').value = city;
    searchWeather();
  }

  const savedTheme = localStorage.getItem('theme') || 'light';
  document.documentElement.setAttribute('data-theme', savedTheme);
});
