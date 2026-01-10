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
