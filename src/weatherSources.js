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
