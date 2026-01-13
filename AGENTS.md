# Zeus Meteo - Agent Documentation

## Overview

Zeus Meteo is a weather web application that aggregates data from multiple free weather APIs with AI-generated insights. It uses a fallback system to ensure availability even when primary APIs are rate-limited or unavailable.

## API Priority Order

1. **INUMET** (free, Uruguay official) - Priority for Uruguay locations
2. **Open-Meteo** (free, ~10K/day from shared IP) - Primary geocoding and weather data
3. **7Timer** (free, no limit) - Based on NOAA GFS model, global coverage
4. **Tomorrow.io** (free, 500 calls/day) - High accuracy, global coverage
5. **Wttr.in** (free, no limit) - Secondary fallback using coordinates
6. **WeatherDB** (free, no key) - Global coverage, no authentication
7. **MetNorway** (free) - Used for European locations
8. **USNWS** (free) - Used for US locations
9. **MockWeatherSource** - Last resort with realistic random data

## Source Weight System

Weather data is weighted by source reliability:

| Source     | Weight | Notes                              |
|------------|--------|------------------------------------|
| INUMET     | 1.3    | Highest for Uruguay (official)     |
| USNWS      | 1.2    | Highest reliability for US         |
| Tomorrow.io| 1.15   | High accuracy, global coverage     |
| 7Timer     | 1.1    | Based on NOAA GFS, no API key      |
| WttrIn     | 1.1    | Good for all locations             |
| OpenMeteo  | 1.0    | Primary source                     |
| MetNorway  | 1.0    | Good for Europe                    |
| WeatherDB  | 0.95   | No API key required                |
| OpenWeatherMap | 0.9 | Requires API key              |
| WeatherAPI | 0.85   | Requires API key              |

## Cache Strategy

- **Duration**: 5 minutes (300 seconds)
- **Storage**: In-memory Map in server.js
- **Keys**: Generated from endpoint + parameters
- **Automatic cleanup**: Expired entries removed every 60 seconds

## Rate Limiting

- **Limit**: 500 requests per 15 minutes
- **Response**: HTTP 429 with friendly message
- **Frontend handling**: Automatic retry (2 attempts with 2s delay)

## Files and Their Purposes

| File | Purpose |
|------|---------|
| `server.js` | Express server, API endpoints, rate limiting, caching |
| `src/agent.js` | WeatherAgent class, AI analysis, source aggregation |
| `src/weatherSources.js` | All weather API wrapper classes |
| `src/reportGenerator.js` | Ollama/Groq integration for AI reports |
| `public/weather.js` | Frontend logic, chatbot, weather display |
| `public/weather.css` | All CSS styling, animations, responsive design |
| `public/sw.js` | Service worker for PWA caching |

## Running Tests

```bash
npm test
```

Tests cover:
- Mock data generation
- Geocoding for valid/invalid locations
- Weather data formatting
- Trend analysis
- Anomaly detection
- Confidence calculation

## Deployment

The app is deployed on Render at: https://weather-agent-mbnt.onrender.com

### Manual Deploy Steps
1. Push changes to GitHub
2. Go to https://dashboard.render.com
3. Select the service
4. Click "Manual Deploy" > "Deploy latest commit"

## Adding New Weather Sources

1. Create a new class extending `WeatherSource` in `src/weatherSources.js`
2. Implement `getCurrentWeather()`, `getForecast()`, and `getCoordinates()` methods
3. Add to the `initializeSources()` method in `src/agent.js`
4. Define source weight in `getSourceWeight()` method

Example structure:

```javascript
export class NewWeatherSource extends WeatherSource {
  constructor() {
    super();
    this.baseUrl = 'https://api.example.com';
  }

  async getCoordinates(location) {
    // Use Open-Meteo geocoding or implement own
  }

  async getCurrentWeather(location) {
    const coords = await this.getCoordinates(location);
    // Fetch and format data
  }

  formatData(rawData) {
    return {
      source: 'NewSource',
      temperature: rawData.temp,
      // ... other fields
    };
  }
}
```

## Troubleshooting

### 429 Too Many Requests
- Open-Meteo rate limits shared IPs on Render
- Wttr.in fallback should handle this automatically
- Check `/api/cache/stats` endpoint for cache performance

### City Not Found
- Try alternative names or remove country/region suffixes
- WttrIn now uses Open-Meteo geocoding for better coverage

### Mock Data Showing
- All APIs failed or rate-limited
- Check server logs for specific errors
- Usually temporary - retry after a few minutes

## Environment Variables

| Variable | Description |
|----------|-------------|
| `OLLAMA_URL` | Ollama server URL for local AI |
| `GROQ_API_KEY` | Groq API key for cloud AI |
| `OPENWEATHER_API_KEY` | OpenWeatherMap API key (optional) |
| `WEATHERAPI_KEY` | WeatherAPI.com key (optional) |
| `PORT` | Server port (default: 3001) |

## Chatbot Commands

- `/config` - Configure Groq API key
- `/clear` - Clear chat history
- `/status` - Show data source status
- `/help` - Show available commands
