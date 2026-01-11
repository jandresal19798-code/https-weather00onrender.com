import { describe, it, before, after, beforeEach } from 'node:test';
import assert from 'node:assert';
import axios from 'axios';

import { OpenMeteo, WttrIn, MockWeatherSource, MetNorway, USNWS, WeatherAPI, OpenWeatherMap } from '../src/weatherSources.js';
import { WeatherAgent } from '../src/agent.js';

describe('WeatherSources', () => {
  describe('MockWeatherSource', () => {
    it('should return weather data with valid structure', async () => {
      const mockSource = new MockWeatherSource();
      const data = await mockSource.getCurrentWeather('Test City');
      
      assert.strictEqual(typeof data.source, 'string');
      assert.strictEqual(typeof data.temperature, 'number');
      assert.strictEqual(typeof data.humidity, 'number');
      assert.strictEqual(typeof data.pressure, 'number');
      assert.strictEqual(typeof data.windSpeed, 'number');
      assert.strictEqual(typeof data.description, 'string');
    });
    
    it('should return temperature within realistic range', async () => {
      const mockSource = new MockWeatherSource();
      const data = await mockSource.getCurrentWeather('Test City');
      
      assert.ok(data.temperature >= 22 && data.temperature <= 27, 'Temperature should be between 22-27°C');
    });
    
    it('should return humidity within 0-100 range', async () => {
      const mockSource = new MockWeatherSource();
      const data = await mockSource.getCurrentWeather('Test City');
      
      assert.ok(data.humidity >= 60 && data.humidity <= 80, 'Humidity should be between 60-80%');
    });
  });
  
  describe('OpenMeteo', () => {
    it('should throw error for invalid location', async () => {
      const openMeteo = new OpenMeteo();
      
      await assert.rejects(
        async () => { await openMeteo.getCoordinates('EstaUbicacionNoExisteXYZ123456789'); },
        /Ubicación no encontrada/
      );
    });
    
    it('should return coordinates for valid location', async () => {
      const openMeteo = new OpenMeteo();
      
      const coords = await openMeteo.getCoordinates('Madrid');
      
      assert.ok(typeof coords.latitude === 'number');
      assert.ok(typeof coords.longitude === 'number');
      assert.ok(Math.abs(coords.latitude) <= 90);
      assert.ok(Math.abs(coords.longitude) <= 180);
    });
  });
  
  describe('WttrIn', () => {
    it('should get coordinates using Open-Meteo geocoding', async () => {
      const wttr = new WttrIn();
      
      const coords = await wttr.getCoordinates('Barcelona');
      
      assert.ok(typeof coords.latitude === 'number');
      assert.ok(typeof coords.longitude === 'number');
      assert.ok(Math.abs(coords.latitude - 41.38879) < 0.1);
      assert.ok(Math.abs(coords.longitude - 2.15899) < 0.1);
    });
    
    it('should throw error for invalid location', async () => {
      const wttr = new WttrIn();
      
      await assert.rejects(
        async () => { await wttr.getCoordinates('UbicacionFalsaXYZ123456'); },
        /No se pudo geocodificar/
      );
    });
  });
  
  describe('Weather Data Formatting', () => {
    it('should format OpenMeteo data correctly', () => {
      const openMeteo = new OpenMeteo();
      
      const mockData = {
        time: '2024-01-15T12:00',
        temperature_2m: 22.5,
        apparent_temperature: 21.0,
        relative_humidity_2m: 65,
        surface_pressure: 1013,
        wind_speed_10m: 5.2,
        wind_direction_10m: 180,
        weather_code: 1,
        visibility: 10000,
        cloud_cover: 20
      };
      
      const formatted = openMeteo.formatData(mockData, 'Test City');
      
      assert.strictEqual(formatted.source, 'OpenMeteo');
      assert.strictEqual(formatted.temperature, 22.5);
      assert.strictEqual(formatted.feelsLike, 21.0);
      assert.strictEqual(formatted.humidity, 65);
      assert.strictEqual(formatted.clouds, 20);
      assert.strictEqual(formatted.visibility, 10);
    });
    
    it('should get weather description from WMO code', () => {
      const openMeteo = new OpenMeteo();
      
      assert.strictEqual(openMeteo.getWeatherDescription(0), 'cielo despejado');
      assert.strictEqual(openMeteo.getWeatherDescription(1), 'mayormente despejado');
      assert.strictEqual(openMeteo.getWeatherDescription(2), 'parcialmente nublado');
      assert.strictEqual(openMeteo.getWeatherDescription(3), 'nublado');
      assert.strictEqual(openMeteo.getWeatherDescription(61), 'lluvia ligera');
      assert.strictEqual(openMeteo.getWeatherDescription(95), 'tormenta eléctrica');
    });
  });
  
  describe('MetNorway', () => {
    it('should return coordinates for valid location', async () => {
      const metNorway = new MetNorway();
      
      const coords = await metNorway.getCoordinates('Oslo');
      
      assert.ok(typeof coords.latitude === 'number');
      assert.ok(typeof coords.longitude === 'number');
    });
  });
  
  describe('USNWS', () => {
    it('should return coordinates for valid location', async () => {
      const usnws = new USNWS();
      
      const coords = await usnws.getCoordinates('New York');
      
      assert.ok(typeof coords.latitude === 'number');
      assert.ok(typeof coords.longitude === 'number');
    });
  });
});

describe('Agent Logic', () => {
  describe('Source Weight Calculation', () => {
    it('should have correct source weights', () => {
      const agent = new WeatherAgent();
      
      assert.strictEqual(agent.getSourceWeight('USNWS'), 1.2);
      assert.strictEqual(agent.getSourceWeight('OpenMeteo'), 1.0);
      assert.strictEqual(agent.getSourceWeight('WttrIn'), 1.1);
      assert.strictEqual(agent.getSourceWeight('Unknown'), 1.0);
    });
  });
  
  describe('Trend Analysis', () => {
    it('should detect stable trend', () => {
      const agent = new WeatherAgent();
      
      const data = [
        { temperature: 20, humidity: 60, windSpeed: 5, timestamp: '2024-01-15T10:00' },
        { temperature: 20.5, humidity: 61, windSpeed: 5.1, timestamp: '2024-01-15T11:00' },
        { temperature: 20.2, humidity: 60.5, windSpeed: 4.9, timestamp: '2024-01-15T12:00' }
      ];
      
      const trend = agent.trendAnalysis(data);
      
      assert.strictEqual(trend.direction, 'estable');
      assert.ok(Math.abs(trend.change) < 2);
    });
    
    it('should detect rising trend', () => {
      const agent = new WeatherAgent();
      
      const data = [
        { temperature: 18, humidity: 60, windSpeed: 5, timestamp: '2024-01-15T10:00' },
        { temperature: 21, humidity: 62, windSpeed: 5, timestamp: '2024-01-15T11:00' },
        { temperature: 24, humidity: 65, windSpeed: 5.5, timestamp: '2024-01-15T12:00' }
      ];
      
      const trend = agent.trendAnalysis(data);
      
      assert.strictEqual(trend.direction, 'subiendo');
      assert.ok(trend.change > 2);
    });
    
    it('should detect falling trend', () => {
      const agent = new WeatherAgent();
      
      const data = [
        { temperature: 24, humidity: 65, windSpeed: 5, timestamp: '2024-01-15T10:00' },
        { temperature: 21, humidity: 62, windSpeed: 5, timestamp: '2024-01-15T11:00' },
        { temperature: 18, humidity: 60, windSpeed: 4.5, timestamp: '2024-01-15T12:00' }
      ];
      
      const trend = agent.trendAnalysis(data);
      
      assert.strictEqual(trend.direction, 'bajando');
      assert.ok(trend.change < -2);
    });
  });
  
  describe('Anomaly Detection', () => {
    it('should detect anomalies in temperature data', () => {
      const agent = new WeatherAgent();
      
      const data = [
        { temperature: 20, humidity: 60, windSpeed: 5 },
        { temperature: 20.5, humidity: 61, windSpeed: 5 },
        { temperature: 19.8, humidity: 60, windSpeed: 5 },
        { temperature: 20.2, humidity: 59, windSpeed: 5 },
        { temperature: 20, humidity: 60, windSpeed: 5 },
        { temperature: 35, humidity: 60, windSpeed: 5 }
      ];
      
      const anomaly = agent.anomalyDetection(data);
      
      assert.ok(anomaly.isAnomaly);
      assert.ok(anomaly.abnormalSources.length > 0);
    });
    
    it('should not flag consistent data as anomalous', () => {
      const agent = new WeatherAgent();
      
      const data = [
        { temperature: 20, humidity: 60, windSpeed: 5 },
        { temperature: 20.5, humidity: 61, windSpeed: 5 },
        { temperature: 19.8, humidity: 60, windSpeed: 5 },
        { temperature: 20.2, humidity: 59, windSpeed: 5 }
      ];
      
      const anomaly = agent.anomalyDetection(data);
      
      assert.ok(!anomaly.isAnomaly);
      assert.strictEqual(anomaly.abnormalSources.length, 0);
    });
  });
  
  describe('Confidence Calculation', () => {
    it('should calculate confidence based on data quality', () => {
      const agent = new WeatherAgent();
      
      const data = [
        { 
          temperature: 22, humidity: 65, pressure: 1013, 
          windSpeed: 5, source: 'OpenMeteo' 
        },
        { 
          temperature: 21.5, humidity: 64, pressure: 1012, 
          windSpeed: 4.8, source: 'WttrIn' 
        },
        { 
          temperature: 22.2, humidity: 66, pressure: 1014, 
          windSpeed: 5.2, source: 'MetNorway' 
        }
      ];
      
      const confidence = agent.calculateConfidence(data);
      
      assert.ok(typeof confidence === 'number');
      assert.ok(confidence >= 0 && confidence <= 100);
      assert.ok(confidence > 50, 'Consistent data should have high confidence');
    });
  });
});

console.log('Running Zeus Meteo tests...');
