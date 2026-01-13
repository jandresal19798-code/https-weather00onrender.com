import axios from 'axios';

class WeatherSource {
  async getCurrentWeather(location) {
    throw new Error('Method not implemented');
  }

  async getHistoricalWeather(location, date) {
    throw new Error('Method not implemented');
  }

  async getForecast(location, days) {
    throw new Error('Method not implemented');
  }
}

export class OpenWeatherMap extends WeatherSource {
  constructor(apiKey) {
    super();
    this.apiKey = apiKey;
    this.baseUrl = 'https://api.openweathermap.org/data/2.5';
  }

  async getCurrentWeather(location) {
    const response = await axios.get(`${this.baseUrl}/weather`, {
      params: {
        q: location,
        appid: this.apiKey,
        units: 'metric',
        lang: 'es'
      }
    });
    return this.formatData(response.data);
  }

  async getForecast(location, days = 5) {
    const response = await axios.get(`${this.baseUrl}/forecast`, {
      params: {
        q: location,
        appid: this.apiKey,
        units: 'metric',
        lang: 'es',
        cnt: days * 8
      }
    });
    return response.data.list.map(item => this.formatData(item));
  }

  formatData(data) {
    return {
      source: 'OpenWeatherMap',
      timestamp: new Date(data.dt * 1000).toISOString(),
      temperature: data.main.temp,
      feelsLike: data.main.feels_like,
      humidity: data.main.humidity,
      pressure: data.main.pressure,
      windSpeed: data.wind?.speed || 0,
      windDirection: data.wind?.deg || 0,
      description: data.weather[0]?.description || '',
      visibility: data.visibility / 1000,
      clouds: data.clouds?.all || 0
    };
  }
}

export class WeatherAPI extends WeatherSource {
  constructor(apiKey) {
    super();
    this.apiKey = apiKey;
    this.baseUrl = 'https://api.weatherapi.com/v1';
  }

  async getCurrentWeather(location) {
    const response = await axios.get(`${this.baseUrl}/current.json`, {
      params: {
        key: this.apiKey,
        q: location,
        lang: 'es'
      }
    });
    return this.formatData(response.data.current);
  }

  async getForecast(location, days = 5) {
    const response = await axios.get(`${this.baseUrl}/forecast.json`, {
      params: {
        key: this.apiKey,
        q: location,
        days: days,
        lang: 'es'
      }
    });
    return response.data.forecast.forecastday.map(day => day.hour.map(hour => this.formatData(hour, day.date)));
  }

  formatData(data, date = null) {
    return {
      source: 'WeatherAPI',
      timestamp: date ? `${date}T${data.time}` : new Date().toISOString(),
      temperature: data.temp_c,
      feelsLike: data.feelslike_c,
      humidity: data.humidity,
      pressure: data.pressure_mb,
      windSpeed: data.wind_kph / 3.6,
      windDirection: data.wind_degree,
      description: data.condition.text,
      visibility: data.vis_km,
      clouds: data.cloud,
      uvIndex: data.uv
    };
  }
}

export class OpenMeteo extends WeatherSource {
  constructor() {
    super();
    this.baseUrl = 'https://api.open-meteo.com/v1';
    this.geoUrl = 'https://geocoding-api.open-meteo.com/v1';
  }

  async getCoordinates(location) {
    const response = await axios.get(`${this.geoUrl}/search`, {
      params: { name: location, count: 3, language: 'es' }
    });
    if (!response.data.results || response.data.results.length === 0) {
      throw new Error(`Ubicación no encontrada: ${location}`);
    }
    return response.data.results[0];
  }

  async getCurrentWeather(location) {
    const coords = await this.getCoordinates(location);
    const response = await axios.get(`${this.baseUrl}/forecast`, {
      params: {
        latitude: coords.latitude,
        longitude: coords.longitude,
        current: 'temperature_2m,relative_humidity_2m,apparent_temperature,surface_pressure,wind_speed_10m,wind_direction_10m,weather_code,visibility,cloud_cover',
        timezone: 'auto'
      }
    });
    return this.formatData(response.data.current, coords.name);
  }

  async getForecast(location, days = 5) {
    const coords = await this.getCoordinates(location);
    const response = await axios.get(`${this.baseUrl}/forecast`, {
      params: {
        latitude: coords.latitude,
        longitude: coords.longitude,
        hourly: 'temperature_2m,relative_humidity_2m,apparent_temperature,surface_pressure,wind_speed_10m,wind_direction_10m,weather_code,visibility,cloud_cover',
        timezone: 'auto',
        forecast_days: days
      }
    });
    return response.data.hourly.time.map((time, index) => 
      this.formatData({
        time,
        temperature_2m: response.data.hourly.temperature_2m[index],
        relative_humidity_2m: response.data.hourly.relative_humidity_2m[index],
        apparent_temperature: response.data.hourly.apparent_temperature[index],
        surface_pressure: response.data.hourly.surface_pressure[index],
        wind_speed_10m: response.data.hourly.wind_speed_10m[index],
        wind_direction_10m: response.data.hourly.wind_direction_10m[index],
        weather_code: response.data.hourly.weather_code[index],
        visibility: response.data.hourly.visibility[index],
        cloud_cover: response.data.hourly.cloud_cover[index]
      }, coords.name)
    );
  }

  async get7DayForecast(location) {
    const coords = await this.getCoordinates(location);
    const response = await axios.get(`${this.baseUrl}/forecast`, {
      params: {
        latitude: coords.latitude,
        longitude: coords.longitude,
        daily: 'temperature_2m_max,temperature_2m_min,weather_code,precipitation_sum,wind_speed_10m_max',
        timezone: 'auto',
        forecast_days: 7
      }
    });
    
    return response.data.daily.time.map((date, index) => ({
      source: 'OpenMeteo',
      date: date,
      temperatureMax: response.data.daily.temperature_2m_max[index],
      temperatureMin: response.data.daily.temperature_2m_min[index],
      weatherCode: response.data.daily.weather_code[index],
      description: this.getWeatherDescription(response.data.daily.weather_code[index]),
      precipitation: response.data.daily.precipitation_sum[index],
      windMax: response.data.daily.wind_speed_10m_max[index]
    }));
  }

  formatData(data, location) {
    return {
      source: 'OpenMeteo',
      timestamp: data.time || new Date().toISOString(),
      location: location,
      temperature: data.temperature_2m,
      feelsLike: data.apparent_temperature,
      humidity: data.relative_humidity_2m,
      pressure: data.surface_pressure,
      windSpeed: data.wind_speed_10m,
      windDirection: data.wind_direction_10m,
      description: this.getWeatherDescription(data.weather_code),
      visibility: data.visibility / 1000,
      clouds: data.cloud_cover
    };
  }

  getWeatherDescription(code) {
    const descriptions = {
      0: 'cielo despejado',
      1: 'mayormente despejado',
      2: 'parcialmente nublado',
      3: 'nublado',
      45: 'niebla',
      48: 'niebla con escarcha',
      51: 'llovizna ligera',
      53: 'llovizna moderada',
      55: 'llovizna densa',
      61: 'lluvia ligera',
      63: 'lluvia moderada',
      65: 'lluvia fuerte',
      71: 'nieve ligera',
      73: 'nieve moderada',
      75: 'nieve fuerte',
      80: 'chubascos ligeros',
      81: 'chubascos moderados',
      82: 'chubascos fuertes',
      95: 'tormenta eléctrica',
      96: 'tormenta con granizo ligero',
      99: 'tormenta con granizo fuerte'
    };
    return descriptions[code] || 'desconocido';
  }
}

export class MetNorway extends WeatherSource {
  constructor() {
    super();
    this.baseUrl = 'https://api.met.no/weatherapi/locationforecast/2.0';
    this.geoUrl = 'https://geocoding-api.open-meteo.com/v1';
  }

  async getCoordinates(location) {
    const response = await axios.get(`${this.geoUrl}/search`, {
      params: { name: location, count: 3, language: 'es' }
    });
    if (!response.data.results || response.data.results.length === 0) {
      throw new Error(`Ubicación no encontrada: ${location}`);
    }
    return response.data.results[0];
  }

  async getCurrentWeather(location) {
    const coords = await this.getCoordinates(location);
    const response = await axios.get(`${this.baseUrl}/compact`, {
      params: { lat: coords.latitude, lon: coords.longitude },
      headers: { 'User-Agent': 'WeatherAgent/1.0' }
    });
    const current = response.data.properties.timeseries[0].data.instant.details;
    const nextHour = response.data.properties.timeseries[0].data.next_1_hours;
    return this.formatData(current, nextHour, coords.name);
  }

  async getForecast(location, days = 5) {
    const coords = await this.getCoordinates(location);
    const response = await axios.get(`${this.baseUrl}/complete`, {
      params: { lat: coords.latitude, lon: coords.longitude },
      headers: { 'User-Agent': 'WeatherAgent/1.0' }
    });
    return response.data.properties.timeseries.slice(0, days * 24).map(item => 
      this.formatData(item.data.instant.details, item.data.next_1_hours, coords.name, item.time)
    );
  }

  async get7DayForecast(location) {
    const coords = await this.getCoordinates(location);
    const response = await axios.get(`${this.baseUrl}/complete`, {
      params: { lat: coords.latitude, lon: coords.longitude },
      headers: { 'User-Agent': 'WeatherAgent/1.0' }
    });
    
    const timeseries = response.data.properties.timeseries;
    const dailyData = new Map();
    
    timeseries.forEach(item => {
      const date = item.time.split('T')[0];
      const temp = item.data.instant.details.air_temperature;
      const weatherCode = item.data.next_1_hours?.summary?.symbol_code;
      
      if (!dailyData.has(date)) {
        dailyData.set(date, { temps: [temp], weatherCodes: [], precipSum: 0, windMax: 0 });
      }
      
      const day = dailyData.get(date);
      day.temps.push(temp);
      if (weatherCode) day.weatherCodes.push(weatherCode);
      day.precipSum += item.data.next_1_hours?.details?.precipitation_amount || 0;
      day.windMax = Math.max(day.windMax, item.data.instant.details.wind_speed || 0);
    });
    
    return Array.from(dailyData.entries()).slice(0, 7).map(([date, data]) => ({
      source: 'MetNorway',
      date: date,
      temperatureMax: Math.max(...data.temps),
      temperatureMin: Math.min(...data.temps),
      weatherCode: data.weatherCodes[0] || 0,
      description: this.getWeatherDescription(data.weatherCodes[0]),
      precipitation: data.precipSum,
      windMax: data.windMax
    }));
  }

  formatData(data, nextHour, location, time = null) {
    return {
      source: 'MetNorway',
      timestamp: time || new Date().toISOString(),
      location: location,
      temperature: data.air_temperature,
      feelsLike: data.apparent_temperature,
      humidity: data.relative_humidity,
      pressure: data.air_pressure_at_sea_level,
      windSpeed: data.wind_speed,
      windDirection: data.wind_from_direction,
      description: this.getWeatherDescription(nextHour?.summary?.symbol_code),
      visibility: null,
      clouds: data.cloud_area_fraction || 0
    };
  }

  getWeatherDescription(code) {
    if (!code) return 'desconocido';
    const descriptions = {
      'clearsky_day': 'cielo despejado',
      'clearsky_night': 'cielo despejado',
      'partlycloudy_day': 'parcialmente nublado',
      'partlycloudy_night': 'parcialmente nublado',
      'cloudy': 'nublado',
      'rain': 'lluvia',
      'heavyrain': 'lluvia fuerte',
      'snow': 'nieve',
      'heavysnow': 'nieve fuerte',
      'thunderstorm': 'tormenta eléctrica',
      'fog': 'niebla'
    };
    const codeBase = code.split('_')[0];
    return descriptions[codeBase] || descriptions[code] || code;
  }
}

export class USNWS extends WeatherSource {
  constructor() {
    super();
    this.geoUrl = 'https://geocoding-api.open-meteo.com/v1';
    this.weatherUrl = 'https://api.weather.gov';
  }

  async getCoordinates(location) {
    const response = await axios.get(`${this.geoUrl}/search`, {
      params: { name: location, count: 3, language: 'es' }
    });
    if (!response.data.results || response.data.results.length === 0) {
      throw new Error(`Ubicación no encontrada: ${location}`);
    }
    return response.data.results[0];
  }

  async getCurrentWeather(location) {
    const coords = await this.getCoordinates(location);
    
    const pointsResponse = await axios.get(`${this.weatherUrl}/points/${coords.latitude},${coords.longitude}`, {
      headers: { 'User-Agent': 'ZeusMeteo/1.0 (contact@zeusmeteo.com)' }
    });
    
    const forecastUrl = pointsResponse.data.properties.forecast;
    const stationsUrl = pointsResponse.data.properties.stations;
    
    const [forecastResponse] = await Promise.all([
      axios.get(forecastUrl, { headers: { 'User-Agent': 'ZeusMeteo/1.0' } }),
      axios.get(stationsUrl, { headers: { 'User-Agent': 'ZeusMeteo/1.0' } }).catch(() => ({ data: { properties: { stations: [] } } }))
    ]);
    
    const currentPeriod = forecastResponse.data.properties.periods[0];
    
    return this.formatData(currentPeriod, coords.name);
  }

  async get7DayForecast(location) {
    const coords = await this.getCoordinates(location);
    
    const pointsResponse = await axios.get(`${this.weatherUrl}/points/${coords.latitude},${coords.longitude}`, {
      headers: { 'User-Agent': 'ZeusMeteo/1.0' }
    });
    
    const forecastUrl = pointsResponse.data.properties.forecast;
    const forecastResponse = await axios.get(forecastUrl, { 
      headers: { 'User-Agent': 'ZeusMeteo/1.0' } 
    });
    
    const periods = forecastResponse.data.properties.periods;
    const dailyData = new Map();
    
    periods.forEach(period => {
      const date = period.startTime.split('T')[0];
      const temp = period.temperature;
      const description = period.shortForecast.toLowerCase();
      
      if (!dailyData.has(date)) {
        dailyData.set(date, { temps: [], weatherCode: 0, descriptions: [], periods: [] });
      }
      
      const day = dailyData.get(date);
      day.temps.push(temp);
      day.descriptions.push(description);
      day.periods.push(period);
    });
    
    return Array.from(dailyData.entries()).slice(0, 7).map(([date, data]) => ({
      source: 'USNWS',
      date: date,
      temperatureMax: Math.max(...data.temps),
      temperatureMin: Math.min(...data.temps),
      weatherCode: this.getWeatherCode(data.descriptions),
      description: this.getDescription(data.descriptions),
      precipitation: this.getPrecipitation(data.descriptions),
      windMax: this.getWind(data.descriptions)
    }));
  }

  formatData(data, location) {
    return {
      source: 'USNWS',
      timestamp: data.startTime || new Date().toISOString(),
      location: location,
      temperature: data.temperature,
      feelsLike: data.temperature,
      humidity: null,
      pressure: null,
      windSpeed: null,
      windDirection: null,
      description: data.shortForecast || 'desconocido',
      visibility: null,
      clouds: this.getClouds(data.shortForecast)
    };
  }

  getWeatherCode(descriptions) {
    if (descriptions.some(d => d.includes('thunder') || d.includes('storm'))) return 95;
    if (descriptions.some(d => d.includes('rain') || d.includes('showers'))) return 61;
    if (descriptions.some(d => d.includes('snow') || d.includes('flurries'))) return 71;
    if (descriptions.some(d => d.includes('cloudy'))) return 3;
    if (descriptions.some(d => d.includes('partly') || d.includes('mostly'))) return 2;
    return 0;
  }

  getDescription(descriptions) {
    const desc = descriptions.join(' ').toLowerCase();
    if (desc.includes('thunder') && desc.includes('rain')) return 'tormenta eléctrica';
    if (desc.includes('thunder')) return 'tormenta eléctrica';
    if (desc.includes('rain') && desc.includes('showers')) return 'lluvia';
    if (desc.includes('rain')) return 'lluvia';
    if (desc.includes('snow') && desc.includes('showers')) return 'chubascos de nieve';
    if (desc.includes('snow')) return 'nieve';
    if (desc.includes('cloudy') && !desc.includes('partly')) return 'nublado';
    if (desc.includes('partly') || desc.includes('mostly')) return 'parcialmente nublado';
    if (desc.includes('sunny') || desc.includes('clear')) return 'cielo despejado';
    return descriptions[0] || 'desconocido';
  }

  getPrecipitation(descriptions) {
    const desc = descriptions.join(' ').toLowerCase();
    if (desc.includes('rain') && desc.includes('heavy')) return 10;
    if (desc.includes('rain')) return 5;
    if (desc.includes('snow') && desc.includes('heavy')) return 8;
    if (desc.includes('snow')) return 3;
    return 0;
  }

  getWind(descriptions) {
    const desc = descriptions.join(' ').toLowerCase();
    if (desc.includes('breezy') || desc.includes('windy')) return 8;
    return 3;
  }

  getClouds(shortForecast) {
    const desc = shortForecast.toLowerCase();
    if (desc.includes('clear') || desc.includes('sunny')) return 0;
    if (desc.includes('partly') || desc.includes('mostly')) return 50;
    return 100;
  }
}

export class MockWeatherSource extends WeatherSource {
  async getCurrentWeather(location) {
    return {
      source: 'MockSource',
      timestamp: new Date().toISOString(),
      temperature: 22 + Math.random() * 5,
      feelsLike: 21 + Math.random() * 5,
      humidity: 60 + Math.random() * 20,
      pressure: 1013 + Math.random() * 10,
      windSpeed: Math.random() * 10,
      windDirection: Math.random() * 360,
      description: ['parcialmente nublado', 'soleado', 'nublado'][Math.floor(Math.random() * 3)],
      visibility: 10,
      clouds: Math.random() * 100
    };
  }
}

export class WttrIn extends WeatherSource {
  constructor() {
    super();
    this.baseUrl = 'https://wttr.in';
    this.geoUrl = 'https://geocoding-api.open-meteo.com/v1';
  }

  async getCurrentWeather(location) {
    try {
      const coords = await this.getCoordinates(location);
      const response = await axios.get(`${this.baseUrl}/${coords.latitude},${coords.longitude}.json`, {
        params: { m: '', lang: 'es' },
        timeout: 10000
      });

      if (!response.data || !response.data.current_condition) {
        throw new Error('Invalid wttr.in response');
      }

      return this.formatData(response.data.current_condition[0]);
    } catch (error) {
      throw new Error(`wttr.in no disponible para "${location}": ${error.message}`);
    }
  }

  async getCurrentWeatherByCoords(lat, lon) {
    try {
      const response = await axios.get(`${this.baseUrl}/${lat},${lon}.json`, {
        params: { m: '', lang: 'es' },
        timeout: 10000
      });

      if (!response.data || !response.data.current_condition) {
        throw new Error('Invalid wttr.in response');
      }

      return this.formatData(response.data.current_condition[0]);
    } catch (error) {
      throw new Error(`wttr.in no disponible: ${error.message}`);
    }
  }

  async getForecast(location, days = 3) {
    try {
      const coords = await this.getCoordinates(location);
      return await this.getForecastByCoords(coords.latitude, coords.longitude, days);
    } catch (error) {
      throw new Error(`wttr.in forecast no disponible para "${location}": ${error.message}`);
    }
  }

  async getForecastByCoords(lat, lon, days = 7) {
    try {
      const response = await axios.get(`${this.baseUrl}/${lat},${lon}.json`, {
        params: { m: '', lang: 'es' },
        timeout: 15000
      });

      if (!response.data || !response.data.weather) {
        throw new Error('Invalid wttr.in forecast response');
      }

      return response.data.weather.slice(0, days).map(day => ({
        date: day.date,
        temperatureMax: parseFloat(day.maxtempC),
        temperatureMin: parseFloat(day.mintempC),
        description: day.hourly?.[Math.floor(day.hourly?.length / 2)]?.weatherDesc?.[0]?.value || 'desconocido',
        weatherCode: 0,
        precipitation: parseFloat(day.precipMM) || 0,
        sunrise: day.astronomy?.[0]?.sunrise || '06:00',
        sunset: day.astronomy?.[0]?.sunset || '18:00'
      }));
    } catch (error) {
      throw new Error(`wttr.in forecast no disponible: ${error.message}`);
    }
  }

  async getCoordinates(location) {
    try {
      const response = await axios.get(`${this.geoUrl}/search`, {
        params: { name: location, count: 3, language: 'es' },
        timeout: 5000
      });
      
      if (!response.data.results || response.data.results.length === 0) {
        throw new Error(`Ubicación no encontrada: ${location}`);
      }
      
      return {
        latitude: response.data.results[0].latitude,
        longitude: response.data.results[0].longitude
      };
    } catch (error) {
      throw new Error(`No se pudo geocodificar "${location}": ${error.message}`);
    }
  }

  formatData(data) {
    const desc = data.weatherDesc?.[0]?.value || data.weatherDesc || 'desconocido';
    return {
      source: 'WttrIn',
      timestamp: data.localObsDateTime || new Date().toISOString(),
      temperature: parseFloat(data.temp_C),
      feelsLike: parseFloat(data.FeelsLikeC),
      humidity: parseInt(data.humidity),
      pressure: parseInt(data.pressure),
      windSpeed: parseFloat(data.windspeedKmph) / 3.6,
      windDirection: parseInt(data.winddir16Point),
      description: desc.toLowerCase(),
      visibility: parseFloat(data.visibility) || 10,
      clouds: parseInt(data.cloudcover),
      uvIndex: parseInt(data.uvIndex) || 0
    };
  }
}

// WeatherDB API - Free, no API key required
export class WeatherDB extends WeatherSource {
  constructor() {
    super();
    this.baseUrl = 'https://weatherdbi.herokuapp.com/data';
  }

  async getCoordinates(location) {
    const response = await axios.get(`${this.baseUrl}/search?keyword=${encodeURIComponent(location)}`);
    if (!response.data.data || response.data.data.length === 0) {
      throw new Error(`Ubicación no encontrada: ${location}`);
    }
    return {
      latitude: response.data.data[0].lat,
      longitude: response.data.data[0].lon,
      name: response.data.data[0].name
    };
  }

  async getCurrentWeather(location) {
    try {
      const coords = await this.getCoordinates(location);
      const response = await axios.get(`${this.baseUrl}/weather/${coords.latitude},${coords.longitude}`);
      return this.formatData(response.data.current, coords.name);
    } catch (error) {
      throw new Error(`WeatherDB no disponible para "${location}": ${error.message}`);
    }
  }

  async get7DayForecast(location) {
    try {
      const coords = await this.getCoordinates(location);
      const response = await axios.get(`${this.baseUrl}/weather/${coords.latitude},${coords.longitude}`);
      
      if (!response.data.data || !response.data.data.forecast) {
        throw new Error('Invalid WeatherDB response');
      }
      
      return response.data.data.forecast.slice(0, 7).map(day => ({
        source: 'WeatherDB',
        date: day.date,
        temperatureMax: parseFloat(day.max_temp),
        temperatureMin: parseFloat(day.min_temp),
        weatherCode: this.getWeatherCode(day.condition),
        description: day.condition.text,
        precipitation: 0,
        windMax: 0
      }));
    } catch (error) {
      throw new Error(`WeatherDB forecast no disponible: ${error.message}`);
    }
  }

  getWeatherCode(condition) {
    if (!condition) return 0;
    const text = condition.text?.toLowerCase() || '';
    if (text.includes('thunder') || text.includes('storm')) return 95;
    if (text.includes('rain') || text.includes('shower')) return 61;
    if (text.includes('snow')) return 71;
    if (text.includes('cloudy')) return 3;
    if (text.includes('partly') || text.includes('mostly')) return 2;
    if (text.includes('sunny') || text.includes('clear')) return 0;
    return 0;
  }

  formatData(data, location) {
    return {
      source: 'WeatherDB',
      timestamp: new Date().toISOString(),
      location: location,
      temperature: parseFloat(data.temp.c) || parseFloat(data.temp?.value || 0),
      feelsLike: parseFloat(data.temp.c) || parseFloat(data.temp?.value || 0),
      humidity: parseInt(data.humidity) || 0,
      pressure: parseInt(data.pressure) || 0,
      windSpeed: parseFloat(data.wind.speed) || 0,
      windDirection: 0,
      description: data.condition?.text?.toLowerCase() || 'desconocido',
      visibility: 10,
      clouds: parseInt(data.cloud) || 0
    };
  }
}

// Meteostat API - Historical and current weather
export class Meteostat extends WeatherSource {
  constructor() {
    super();
    this.baseUrl = 'https://api.meteostat.net/v2';
    this.geoUrl = 'https://geocoding-api.open-meteo.com/v1';
  }

  async getCoordinates(location) {
    const response = await axios.get(`${this.geoUrl}/search`, {
      params: { name: location, count: 3, language: 'es' }
    });
    if (!response.data.results || response.data.results.length === 0) {
      throw new Error(`Ubicación no encontrada: ${location}`);
    }
    return response.data.results[0];
  }

  async getCurrentWeather(location) {
    try {
      const coords = await this.getCoordinates(location);
      const response = await axios.get(`${this.baseUrl}/stations/nearby`, {
        params: { lat: coords.latitude, lon: coords.longitude, radius: 50000 },
        headers: { 'x-api-key': process.env.METEOSTAT_KEY || '' }
      });
      
      if (!response.data.data || response.data.data.length === 0) {
        throw new Error('No weather stations nearby');
      }
      
      const station = response.data.data[0];
      return this.formatData(station, coords.name);
    } catch (error) {
      throw new Error(`Meteostat no disponible para "${location}": ${error.message}`);
    }
  }

  formatData(data, location) {
    return {
      source: 'Meteostat',
      timestamp: data.time ? new Date(data.time).toISOString() : new Date().toISOString(),
      location: location,
      temperature: data.temperature,
      feelsLike: data.celsius?.feels_like || data.temperature,
      humidity: data.humidity,
      pressure: data.pressure,
      windSpeed: data.wind_speed || 0,
      windDirection: data.wind_direction || 0,
      description: 'actual',
      visibility: data.visibility || 10,
      clouds: data.cloud_cover || 0
    };
  }
}

// WeatherAPI from weather.gov (US National Weather Service)
export class WeatherGov extends WeatherSource {
  constructor() {
    super();
    this.baseUrl = 'https://api.weather.gov';
    this.geoUrl = 'https://geocoding-api.open-meteo.com/v1';
  }

  async getCoordinates(location) {
    const response = await axios.get(`${this.geoUrl}/search`, {
      params: { name: location, count: 3, language: 'es' }
    });
    if (!response.data.results || response.data.results.length === 0) {
      throw new Error(`Ubicación no encontrada: ${location}`);
    }
    return response.data.results[0];
  }

  async getCurrentWeather(location) {
    try {
      const coords = await this.getCoordinates(location);
      const pointsResponse = await axios.get(`${this.baseUrl}/points/${coords.latitude},${coords.longitude}`);
      
      const forecastUrl = pointsResponse.data.properties.forecast;
      const forecastResponse = await axios.get(forecastUrl);
      
      const currentPeriod = forecastResponse.data.properties.periods[0];
      
      return this.formatData(currentPeriod, coords.name);
    } catch (error) {
      throw new Error(`Weather.gov no disponible para "${location}": ${error.message}`);
    }
  }

  async get7DayForecast(location) {
    try {
      const coords = await this.getCoordinates(location);
      const pointsResponse = await axios.get(`${this.baseUrl}/points/${coords.latitude},${coords.longitude}`);
      
      const forecastUrl = pointsResponse.data.properties.forecast;
      const forecastResponse = await axios.get(forecastUrl);
      
      const periods = forecastResponse.data.properties.periods;
      const dailyData = new Map();
      
      periods.forEach(period => {
        const date = period.startTime.split('T')[0];
        const temp = period.temperature;
        const description = period.shortForecast.toLowerCase();
        
        if (!dailyData.has(date)) {
          dailyData.set(date, { temps: [], descriptions: [] });
        }
        
        const day = dailyData.get(date);
        day.temps.push(temp);
        day.descriptions.push(description);
      });
      
      return Array.from(dailyData.entries()).slice(0, 7).map(([date, data]) => ({
        source: 'Weather.gov',
        date: date,
        temperatureMax: Math.max(...data.temps),
        temperatureMin: Math.min(...data.temps),
        weatherCode: this.getWeatherCode(data.descriptions),
        description: this.getDescription(data.descriptions),
        precipitation: this.getPrecipitation(data.descriptions),
        windMax: this.getWind(data.descriptions)
      }));
    } catch (error) {
      throw new Error(`Weather.gov forecast no disponible: ${error.message}`);
    }
  }

  getWeatherCode(descriptions) {
    const desc = descriptions.join(' ').toLowerCase();
    if (desc.includes('thunder') || desc.includes('storm')) return 95;
    if (desc.includes('rain') || desc.includes('showers')) return 61;
    if (desc.includes('snow') || desc.includes('flurries')) return 71;
    if (desc.includes('cloudy')) return 3;
    if (desc.includes('partly') || desc.includes('mostly')) return 2;
    return 0;
  }

  getDescription(descriptions) {
    const desc = descriptions.join(' ').toLowerCase();
    if (desc.includes('thunder')) return 'tormenta eléctrica';
    if (desc.includes('rain') && desc.includes('showers')) return 'lluvia';
    if (desc.includes('rain')) return 'lluvia';
    if (desc.includes('snow')) return 'nieve';
    if (desc.includes('cloudy') && !desc.includes('partly')) return 'nublado';
    if (desc.includes('partly') || desc.includes('mostly')) return 'parcialmente nublado';
    if (desc.includes('sunny') || desc.includes('clear')) return 'cielo despejado';
    return descriptions[0] || 'desconocido';
  }

  getPrecipitation(descriptions) {
    const desc = descriptions.join(' ').toLowerCase();
    if (desc.includes('heavy')) return 10;
    if (desc.includes('rain') || desc.includes('showers')) return 5;
    if (desc.includes('snow')) return 3;
    return 0;
  }

  getWind(descriptions) {
    const desc = descriptions.join(' ').toLowerCase();
    if (desc.includes('breezy') || desc.includes('windy')) return 8;
    return 3;
  }

  formatData(data, location) {
    return {
      source: 'Weather.gov',
      timestamp: data.startTime || new Date().toISOString(),
      location: location,
      temperature: data.temperature,
      feelsLike: data.temperature,
      humidity: null,
      pressure: null,
      windSpeed: null,
      windDirection: null,
      description: data.shortForecast || 'desconocido',
      visibility: null,
      clouds: null
    };
  }
}

// 7Timer API - Free, no API key, based on NOAA GFS
export class SevenTimer extends WeatherSource {
  constructor() {
    super();
    this.baseUrl = 'http://www.7timer.info/bin/api.pl';
    this.geoUrl = 'https://geocoding-api.open-meteo.com/v1';
  }

  async getCoordinates(location) {
    const response = await axios.get(`${this.geoUrl}/search`, {
      params: { name: location, count: 3, language: 'es' }
    });
    if (!response.data.results || response.data.results.length === 0) {
      throw new Error(`Ubicación no encontrada: ${location}`);
    }
    return response.data.results[0];
  }

  async getCurrentWeather(location) {
    try {
      const coords = await this.getCoordinates(location);
      const response = await axios.get(this.baseUrl, {
        params: {
          lon: coords.longitude,
          lat: coords.latitude,
          product: 'civillight',
          output: 'json'
        },
        timeout: 10000
      });

      if (!response.data || !response.data.dataseries || response.data.dataseries.length === 0) {
        throw new Error('Invalid 7Timer response');
      }

      return this.formatData(response.data.dataseries[0], coords.name);
    } catch (error) {
      throw new Error(`7Timer no disponible para "${location}": ${error.message}`);
    }
  }

  async get7DayForecast(location) {
    try {
      const coords = await this.getCoordinates(location);
      const response = await axios.get(this.baseUrl, {
        params: {
          lon: coords.longitude,
          lat: coords.latitude,
          product: 'civillight',
          output: 'json'
        },
        timeout: 15000
      });

      if (!response.data || !response.data.dataseries) {
        throw new Error('Invalid 7Timer forecast response');
      }

      return response.data.dataseries.slice(0, 7).map((day, index) => ({
        source: '7Timer',
        date: this.getDateFromInitPlus(index),
        temperatureMax: day.temp2m?.max || 20,
        temperatureMin: day.temp2m?.min || 10,
        weatherCode: this.getWeatherCode(day.weather),
        description: this.getWeatherDescription(day.weather),
        precipitation: this.getPrecipitation(day.prec),
        windMax: this.getWindSpeed(day.wind10m?.max || 0)
      }));
    } catch (error) {
      throw new Error(`7Timer forecast no disponible: ${error.message}`);
    }
  }

  getDateFromInitPlus(days) {
    const date = new Date();
    date.setDate(date.getDate() + days);
    return date.toISOString().split('T')[0];
  }

  getWeatherCode(weather) {
    if (!weather) return 0;
    const w = weather.toLowerCase();
    if (w.includes('thunder') || w.includes('ts')) return 95;
    if (w.includes('rain') || w.includes('shower')) return 61;
    if (w.includes('snow')) return 71;
    if (w.includes('cloudy') && !w.includes('part')) return 3;
    if (w.includes('part')) return 2;
    if (w.includes('clear') || w.includes('sunny')) return 0;
    return 0;
  }

  getWeatherDescription(weather) {
    if (!weather) return 'desconocido';
    const w = weather.toLowerCase();
    if (w.includes('thunder')) return 'tormenta eléctrica';
    if (w.includes('rain') && w.includes('showers')) return 'chubascos';
    if (w.includes('rain')) return 'lluvia';
    if (w.includes('snow') && w.includes('showers')) return 'chubascos de nieve';
    if (w.includes('snow')) return 'nieve';
    if (w.includes('cloudy') && !w.includes('part')) return 'nublado';
    if (w.includes('part')) return 'parcialmente nublado';
    if (w.includes('clear') || w.includes('sunny')) return 'cielo despejado';
    if (w.includes('humid') || w.includes('fog')) return 'niebla';
    return weather;
  }

  getPrecipitation(prec) {
    if (!prec) return 0;
    if (prec >= 7) return 10;
    if (prec >= 4) return 5;
    if (prec >= 1) return 2;
    return 0;
  }

  getWindSpeed(windLevel) {
    const speeds = [0.3, 3.4, 8.0, 10.8, 17.2, 24.5, 32.6];
    return windLevel < speeds.length ? speeds[windLevel - 1] || 5 : 5;
  }

  formatData(data, location) {
    return {
      source: '7Timer',
      timestamp: new Date().toISOString(),
      location: location,
      temperature: data.temp2m?.max || 20,
      feelsLike: data.temp2m?.max || 20,
      humidity: data.rh2m ? parseInt(data.rh2m) : 50,
      pressure: 1013,
      windSpeed: data.wind10m?.max || 5,
      windDirection: 180,
      description: this.getWeatherDescription(data.weather),
      visibility: 10,
      clouds: this.getClouds(data.weather)
    };
  }

  getClouds(weather) {
    if (!weather) return 50;
    const w = weather.toLowerCase();
    if (w.includes('clear')) return 10;
    if (w.includes('part')) return 40;
    if (w.includes('cloudy') || w.includes('humid')) return 80;
    return 50;
  }
}

// Tomorrow.io API - Free tier available (500 calls/day)
export class TomorrowIO extends WeatherSource {
  constructor() {
    super();
    this.baseUrl = 'https://api.tomorrow.io/v4';
    this.geoUrl = 'https://geocoding-api.open-meteo.com/v1';
  }

  async getCoordinates(location) {
    const response = await axios.get(`${this.geoUrl}/search`, {
      params: { name: location, count: 3, language: 'es' }
    });
    if (!response.data.results || response.data.results.length === 0) {
      throw new Error(`Ubicación no encontrada: ${location}`);
    }
    return response.data.results[0];
  }

  async getCurrentWeather(location) {
    try {
      const coords = await this.getCoordinates(location);
      const response = await axios.get(`${this.baseUrl}/weather/realtime`, {
        params: {
          location: `${coords.latitude},${coords.longitude}`
        },
        timeout: 10000
      });

      return this.formatData(response.data.data, coords.name);
    } catch (error) {
      throw new Error(`Tomorrow.io no disponible para "${location}": ${error.message}`);
    }
  }

  async get7DayForecast(location) {
    try {
      const coords = await this.getCoordinates(location);
      const response = await axios.get(`${this.baseUrl}/weather/forecast`, {
        params: {
          location: `${coords.latitude},${coords.longitude}`,
          timesteps: '1d',
          units: 'metric'
        },
        timeout: 15000
      });

      if (!response.data.data || !response.data.data.timelines) {
        throw new Error('Invalid Tomorrow.io response');
      }

      const daily = response.data.data.timelines.daily || [];
      return daily.slice(0, 7).map(day => ({
        source: 'Tomorrow.io',
        date: day.time.split('T')[0],
        temperatureMax: day.values?.temperatureMax || day.values?.temperatureApparentMax || 20,
        temperatureMin: day.values?.temperatureMin || day.values?.temperatureApparentMin || 10,
        weatherCode: this.getWeatherCode(day.values?.weatherCode),
        description: this.getWeatherDescription(day.values?.weatherCode),
        precipitation: day.values?.precipitationProbabilityMax || 0,
        windMax: day.values?.windSpeedMax || 5
      }));
    } catch (error) {
      throw new Error(`Tomorrow.io forecast no disponible: ${error.message}`);
    }
  }

  getWeatherCode(code) {
    if (!code) return 0;
    const codes = {
      0: 0, 1: 0, 2: 2, 3: 3,
      10: 51, 11: 95, 12: 61, 13: 71, 14: 71, 15: 95,
      16: 61, 17: 61, 18: 61, 19: 95,
      20: 45, 21: 45, 22: 45, 23: 45,
      30: 80, 31: 80, 32: 80,
      40: 80, 41: 80, 42: 80
    };
    return codes[code] || 0;
  }

  getWeatherDescription(code) {
    const descriptions = {
      0: 'cielo despejado',
      1: 'mayormente despejado',
      2: 'parcialmente nublado',
      3: 'nublado',
      10: 'llovizna',
      11: 'tormenta eléctrica',
      12: 'lluvia',
      13: 'nieve',
      14: 'aguanieve',
      15: 'granizo',
      16: 'lluvia y nieve',
      17: 'lluvia helada',
      18: 'aguanieve',
      19: 'tormenta eléctrica',
      20: 'niebla',
      21: 'neblina',
      22: 'bruma',
      23: ' humo',
      30: 'lluvia ligera',
      31: 'lluvia moderada',
      32: 'lluvia fuerte',
      40: 'lluvia ligera',
      41: 'lluvia moderada',
      42: 'lluvia fuerte'
    };
    return descriptions[code] || 'desconocido';
  }

  formatData(data, location) {
    const values = data.values || {};
    return {
      source: 'Tomorrow.io',
      timestamp: data.time || new Date().toISOString(),
      location: location,
      temperature: values.temperature || values.temperatureApparent || 20,
      feelsLike: values.temperatureApparent || values.temperature || 20,
      humidity: values.humidity || 50,
      pressure: values.pressureSurfaceLevel || 1013,
      windSpeed: values.windSpeed || 0,
      windDirection: values.windDirection || 0,
      description: this.getWeatherDescription(values.weatherCode),
      visibility: values.visibility || 10,
      clouds: values.cloudCover || 0
    };
  }
}

// Combined weather aggregator
export class WeatherAggregator extends WeatherSource {
  constructor() {
    super();
    this.sources = [
      new OpenMeteo(),
      new SevenTimer(),
      new WttrIn(),
      new WeatherDB(),
      new MetNorway(),
      new USNWS(),
      new TomorrowIO()
    ];
  }

  async getCurrentWeather(location) {
    const errors = [];
    
    for (const source of this.sources) {
      try {
        const weather = await source.getCurrentWeather(location);
        console.log(`✅ Weather from ${weather.source}`);
        return weather;
      } catch (error) {
        errors.push(`${source.constructor.name}: ${error.message}`);
        console.log(`⚠️ ${source.constructor.name} failed: ${error.message}`);
      }
    }
    
    throw new Error('All weather sources failed');
  }

  async get7DayForecast(location) {
    for (const source of this.sources) {
      try {
        if (typeof source.get7DayForecast === 'function') {
          const forecast = await source.get7DayForecast(location);
          console.log(`✅ 7-day forecast from ${source.constructor.name}`);
          return forecast;
        }
      } catch (error) {
        console.log(`⚠️ ${source.constructor.name} 7-day forecast failed: ${error.message}`);
      }
    }
    
    throw new Error('No 7-day forecast available');
  }
}
