function updateSolarInfo(date) {
  const sunriseEl = document.getElementById('sunrise');
  const sunsetEl = document.getElementById('sunset-time');
  
  try {
    const lat = currentCoords?.lat || 0;
    const lng = currentCoords?.lng || 0;
    const dateStr = date.toISOString().split('T')[0];
    
    const response = await fetch('https://api.sunrisesunset.io/json?lat=' + lat + '&lng=' + lng + '&date=' + dateStr);
    
    if (response.ok) {
      const data = await response.json();
      
      if (data.results && data.results.sunrise && data.results.sunset) {
        const sunrise = new Date(data.results.sunrise);
        const sunset = new Date(data.results.sunset);
        
        sunriseEl.textContent = sunrise.toLocaleTimeString('es', { hour: '2-digit', minute: '2-digit' });
        sunsetEl.textContent = sunset.toLocaleTimeString('es', { hour: '2-digit', minute: '2-digit' });
      }
    }
  } catch (error) {
    console.warn('Solar data error:', error);
    const now = new Date();
    const sunrise = new Date(now);
    sunrise.setHours(6, 30, 0);
    const sunset = new Date(now);
    sunset.setHours(18, 30, 0);
    
    sunriseEl.textContent = sunrise.toLocaleTimeString('es', { hour: '2-digit', minute: '2-digit' });
    sunsetEl.textContent = sunset.toLocaleTimeString('es', { hour: '2-digit', minute: '2-digit' });
  }
}
