/**
 * Weather data adapter
 * Connects to external weather providers (IMD, OpenWeatherMap, NASA GPM)
 * Uses real APIs when credentials are provided, otherwise falls back to mock data
 * Features:
 * - Retry logic with exponential backoff
 * - Circuit breaker pattern
 * - Request timeout handling
 * - Response caching
 * - Structured logging
 */

import { pool } from '../db.js';
import { config } from '../config.js';
import { createChildLogger } from '../logger.js';

const logger = createChildLogger('weather-adapter');

export interface WeatherObservation {
  provider: string;
  location: { lat: number; lon: number };
  timestamp: Date;
  rainfall_mm: number;
  temperature_c?: number;
  humidity_percent?: number;
  wind_speed_kmh?: number;
}

// Circuit breaker state tracking
interface CircuitBreakerState {
  failures: number;
  lastFailureTime?: number;
  state: 'closed' | 'open' | 'half-open';
}

const circuitBreakers: Record<string, CircuitBreakerState> = {
  'IMD': { failures: 0, state: 'closed' },
  'NASA-GPM': { failures: 0, state: 'closed' },
  'OpenWeather': { failures: 0, state: 'closed' },
};

// Cache for API responses
interface CacheEntry {
  data: WeatherObservation[];
  timestamp: number;
}

const responseCache: Record<string, CacheEntry> = {};

const CIRCUIT_BREAKER_THRESHOLD = 5;
const CIRCUIT_BREAKER_RESET_MS = 60000; // 1 minute
const CACHE_TTL_MS = config.weatherCacheTtlSeconds * 1000;

/**
 * Check circuit breaker state and determine if API call should be attempted
 */
function checkCircuitBreaker(provider: string): boolean {
  const breaker = circuitBreakers[provider];
  if (!breaker) return true;

  if (breaker.state === 'closed') return true;

  if (breaker.state === 'open') {
    const timeSinceLastFailure = Date.now() - (breaker.lastFailureTime || 0);
    if (timeSinceLastFailure > CIRCUIT_BREAKER_RESET_MS) {
      logger.info(`Circuit breaker reset for ${provider}`, {
        provider,
        timeSinceLastFailureMs: timeSinceLastFailure,
      });
      breaker.state = 'half-open';
      breaker.failures = 0;
      return true;
    }
    return false;
  }

  // half-open state: allow one attempt
  return true;
}

/**
 * Record circuit breaker failure
 */
function recordCircuitBreakerFailure(provider: string): void {
  const breaker = circuitBreakers[provider];
  if (!breaker) return;

  breaker.failures++;
  breaker.lastFailureTime = Date.now();

  if (breaker.failures >= CIRCUIT_BREAKER_THRESHOLD) {
    breaker.state = 'open';
    logger.warn(`Circuit breaker OPEN for ${provider}`, {
      provider,
      failures: breaker.failures,
      threshold: CIRCUIT_BREAKER_THRESHOLD,
    });
  } else if (breaker.state === 'half-open') {
    breaker.state = 'open';
    logger.warn(`Circuit breaker re-opened for ${provider}`, {
      provider,
      failures: breaker.failures,
    });
  }
}

/**
 * Record circuit breaker success (close it if half-open)
 */
function recordCircuitBreakerSuccess(provider: string): void {
  const breaker = circuitBreakers[provider];
  if (!breaker) return;

  if (breaker.state === 'half-open') {
    breaker.state = 'closed';
    breaker.failures = 0;
    logger.info(`Circuit breaker CLOSED for ${provider}`, { provider });
  }
}

/**
 * Retry logic with exponential backoff
 */
async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  provider: string,
  maxRetries = config.apiMaxRetries,
): Promise<T | null> {
  let lastError: Error | null = null;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const startTime = Date.now();
      const result = await fn();
      const duration = Date.now() - startTime;

      logger.debug(`API call succeeded for ${provider}`, {
        provider,
        attempt,
        duration: `${duration}ms`,
      });

      recordCircuitBreakerSuccess(provider);
      return result;
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
      const duration = Date.now();

      if (attempt < maxRetries) {
        const delayMs = Math.pow(2, attempt) * 1000; // 1s, 2s, 4s, 8s...
        logger.warn(`API call failed for ${provider}, retrying`, {
          provider,
          attempt: attempt + 1,
          maxRetries,
          error: lastError.message,
          delayMs,
          nextRetryTime: new Date(Date.now() + delayMs).toISOString(),
        });
        await new Promise((resolve) => setTimeout(resolve, delayMs));
      } else {
        logger.error(`API call failed for ${provider} after ${maxRetries} retries`, {
          provider,
          maxRetries,
          error: lastError.message,
          stack: lastError.stack,
        });
        recordCircuitBreakerFailure(provider);
      }
    }
  }

  return null;
}

/**
 * Fetch with timeout
 */
async function fetchWithTimeout(
  url: string,
  options: RequestInit = {},
  timeoutMs = config.apiCallTimeoutMs,
): Promise<Response> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal,
    });
    clearTimeout(timeoutId);
    return response;
  } catch (error) {
    clearTimeout(timeoutId);
    if (error instanceof Error && error.name === 'AbortError') {
      throw new Error(`Request timeout after ${timeoutMs}ms`);
    }
    throw error;
  }
}

/**
 * Get cached data if available and not expired
 */
function getCachedData(provider: string): WeatherObservation[] | null {
  const cached = responseCache[provider];
  if (!cached) return null;

  const age = Date.now() - cached.timestamp;
  if (age > CACHE_TTL_MS) {
    delete responseCache[provider];
    return null;
  }

  logger.debug(`Cache hit for ${provider}`, {
    provider,
    ageMs: age,
    ttlMs: CACHE_TTL_MS,
  });
  return cached.data;
}

/**
 * Set cached data
 */
function setCachedData(provider: string, data: WeatherObservation[]): void {
  responseCache[provider] = {
    data,
    timestamp: Date.now(),
  };
  logger.debug(`Cache set for ${provider}`, {
    provider,
    records: data.length,
    ttlSeconds: config.weatherCacheTtlSeconds,
  });
}

/**
 * Fetch IMD (India Meteorological Department) data
 * Real API: https://mausam.imd.gov.in/ (requires API key)
 * Fallback: Mock data for demonstration
 */
export async function fetchIMDData(): Promise<WeatherObservation[]> {
  const provider = 'IMD';

  // Check cache first
  const cached = getCachedData(provider);
  if (cached) return cached;

  // If real API key is provided, use it
  if (config.externalData.imdApiKey) {
    if (!checkCircuitBreaker(provider)) {
      logger.warn(`Circuit breaker OPEN for ${provider}, skipping API call`, { provider });
      return getIMDMockData();
    }

    const result = await retryWithBackoff(async () => {
      const url = new URL('/v2/weather', config.externalData.imdBaseUrl);
      url.searchParams.set('lat', '18.5204');
      url.searchParams.set('lon', '73.8567');
      url.searchParams.set('apikey', config.externalData.imdApiKey!);

      const response = await fetchWithTimeout(url.toString());
      if (!response.ok) {
        throw new Error(`IMD API returned ${response.status}`);
      }

      const data: any = await response.json();
      // Parse real IMD response
      const observations = (data.stations || []).map((station: any) => ({
        provider: 'IMD',
        location: { lat: station.latitude, lon: station.longitude },
        timestamp: new Date(station.observed_at),
        rainfall_mm: station.rainfall_mm || 0,
        temperature_c: station.temperature_c,
        humidity_percent: station.humidity_percent,
        wind_speed_kmh: station.wind_speed_kmh,
      }));

      logger.info(`Successfully fetched IMD data`, {
        provider,
        observations: observations.length,
      });
      return observations;
    }, provider);

    if (result) {
      setCachedData(provider, result);
      return result;
    }
  }

  // Fallback: Mock data
  logger.info(`Using mock data for ${provider}`, { provider, reason: 'API key not configured or API failed' });
  const mockData = getIMDMockData();
  setCachedData(provider, mockData);
  return mockData;
}

/**
 * Get IMD mock data
 */
function getIMDMockData(): WeatherObservation[] {
  const stations = [
    { id: 'imd-pune-1', lat: 18.5204, lon: 73.8567, name: 'Shivajinagar' },
    { id: 'imd-pune-2', lat: 18.5074, lon: 73.8077, name: 'Kothrud' },
    { id: 'imd-pune-3', lat: 18.4801, lon: 73.9266, name: 'Hadapsar' },
  ];

  return stations.map((station) => ({
    provider: 'IMD',
    location: { lat: station.lat, lon: station.lon },
    timestamp: new Date(),
    rainfall_mm: Math.random() * 50,
    temperature_c: 20 + Math.random() * 15,
    humidity_percent: 60 + Math.random() * 40,
    wind_speed_kmh: 5 + Math.random() * 25,
  }));
}

/**
 * Fetch NASA GPM (Global Precipitation Measurement) data
 * Real API: https://giovanni.gsfc.nasa.gov/ (requires authentication)
 * Fallback: Mock satellite-based rainfall estimates
 */
export async function fetchNASAGPMData(): Promise<WeatherObservation[]> {
  const provider = 'NASA-GPM';

  // Check cache first
  const cached = getCachedData(provider);
  if (cached) return cached;

  // If real token is provided, use it
  if (config.externalData.nasaGpmToken) {
    if (!checkCircuitBreaker(provider)) {
      logger.warn(`Circuit breaker OPEN for ${provider}, skipping API call`, { provider });
      return getNASAGPMMockData();
    }

    const result = await retryWithBackoff(async () => {
      const url = new URL('/daac-bin/Giovanni/services/amsr2_rain.1.4', config.externalData.nasaGpmBaseUrl);
      url.searchParams.set('north', '19');
      url.searchParams.set('south', '18');
      url.searchParams.set('east', '74');
      url.searchParams.set('west', '73');
      url.searchParams.set('query', config.externalData.nasaGpmToken!);

      const response = await fetchWithTimeout(url.toString());
      if (!response.ok) {
        throw new Error(`NASA GPM API returned ${response.status}`);
      }

      const data: any = await response.json();
      // Parse real NASA GPM response
      const observations = (data.results || []).map((result: any) => ({
        provider: 'NASA-GPM',
        location: { lat: result.latitude, lon: result.longitude },
        timestamp: new Date(result.timestamp),
        rainfall_mm: result.precipitation_mm || 0,
      }));

      logger.info(`Successfully fetched NASA GPM data`, {
        provider,
        observations: observations.length,
      });
      return observations;
    }, provider);

    if (result) {
      setCachedData(provider, result);
      return result;
    }
  }

  // Fallback: Mock data
  logger.info(`Using mock data for ${provider}`, { provider, reason: 'Token not configured or API failed' });
  const mockData = getNASAGPMMockData();
  setCachedData(provider, mockData);
  return mockData;
}

/**
 * Get NASA GPM mock data
 */
function getNASAGPMMockData(): WeatherObservation[] {
  return [
    {
      provider: 'NASA-GPM',
      location: { lat: 18.52, lon: 73.86 },
      timestamp: new Date(),
      rainfall_mm: Math.random() * 100,
    },
  ];
}

/**
 * Fetch OpenWeatherMap data
 * Real API: https://api.openweathermap.org/ (requires API key)
 * Fallback: Mock weather data
 */
export async function fetchOpenWeatherData(): Promise<WeatherObservation[]> {
  const provider = 'OpenWeather';

  // Check cache first
  const cached = getCachedData(provider);
  if (cached) return cached;

  // If real API key is provided, use it
  if (config.externalData.openWeatherApiKey) {
    if (!checkCircuitBreaker(provider)) {
      logger.warn(`Circuit breaker OPEN for ${provider}, skipping API call`, { provider });
      return getOpenWeatherMockData();
    }

    const result = await retryWithBackoff(async () => {
      const url = new URL('/data/2.5/weather', config.externalData.openWeatherBaseUrl);
      url.searchParams.set('lat', '18.5204');
      url.searchParams.set('lon', '73.8567');
      url.searchParams.set('appid', config.externalData.openWeatherApiKey!);
      url.searchParams.set('units', 'metric');

      const response = await fetchWithTimeout(url.toString());
      if (!response.ok) {
        throw new Error(`OpenWeatherMap API returned ${response.status}`);
      }

      const data: any = await response.json();
      // Parse OpenWeatherMap response
      const rain = data.rain?.['1h'] || data.clouds?.all * 0.01 * 10 || 0;
      const observation: WeatherObservation = {
        provider: 'OpenWeather',
        location: { lat: data.coord.lat, lon: data.coord.lon },
        timestamp: new Date(data.dt * 1000),
        rainfall_mm: rain,
        temperature_c: data.main.temp,
        humidity_percent: data.main.humidity,
        wind_speed_kmh: (data.wind.speed || 0) * 3.6,
      };

      logger.info(`Successfully fetched OpenWeatherMap data`, {
        provider,
        rainfall: observation.rainfall_mm,
        temperature: observation.temperature_c,
      });
      return [observation];
    }, provider);

    if (result) {
      setCachedData(provider, result);
      return result;
    }
  }

  // Fallback: Mock data
  logger.info(`Using mock data for ${provider}`, { provider, reason: 'API key not configured or API failed' });
  const mockData = getOpenWeatherMockData();
  setCachedData(provider, mockData);
  return mockData;
}

/**
 * Get OpenWeatherMap mock data
 */
function getOpenWeatherMockData(): WeatherObservation[] {
  return [
    {
      provider: 'OpenWeather',
      location: { lat: 18.5204, lon: 73.8567 },
      timestamp: new Date(),
      rainfall_mm: Math.random() * 30,
      temperature_c: 22 + Math.random() * 12,
      humidity_percent: 70 + Math.random() * 25,
      wind_speed_kmh: 8 + Math.random() * 20,
    },
  ];
}

/**
 * Ingest weather observation into database
 */
export async function ingestWeatherObservation(obs: WeatherObservation): Promise<void> {
  try {
    const dataSource = await pool.query(
      `SELECT id FROM data_sources WHERE provider_key = $1 LIMIT 1`,
      [obs.provider.toLowerCase()],
    );

    if (!dataSource.rowCount) {
      logger.warn(`Data source ${obs.provider} not found in database`, {
        provider: obs.provider,
      });
      return;
    }

    const sourceId = dataSource.rows[0].id as string;
    const providerKey = `${obs.provider.toLowerCase()}-${Date.now()}`;

    const result = await pool.query(
      `INSERT INTO weather_observations(
        source_id, provider_record_key, observed_at, location,
        rainfall_mm, is_synthetic
      ) VALUES ($1, $2, $3, ST_SetSRID(ST_MakePoint($4, $5), 4326)::geography, $6, false)
      ON CONFLICT(source_id, provider_record_key) DO UPDATE
      SET rainfall_mm = EXCLUDED.rainfall_mm,
          observed_at = EXCLUDED.observed_at`,
      [
        sourceId,
        providerKey,
        obs.timestamp,
        obs.location.lon,
        obs.location.lat,
        obs.rainfall_mm,
      ],
    );

    logger.debug(`Weather observation ingested`, {
      provider: obs.provider,
      rainfall: obs.rainfall_mm,
      location: obs.location,
    });
  } catch (error) {
    logger.error(`Failed to ingest weather observation`, {
      provider: obs.provider,
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
    });
  }
}

/**
 * Fetch all available weather data from configured providers
 */
export async function fetchAllWeatherData(): Promise<WeatherObservation[]> {
  logger.debug(`Starting weather data fetch from all providers`);
  const startTime = Date.now();

  const [imd, gpm, openweather] = await Promise.all([
    fetchIMDData(),
    fetchNASAGPMData(),
    fetchOpenWeatherData(),
  ]);

  const duration = Date.now() - startTime;
  const total = imd.length + gpm.length + openweather.length;

  logger.info(`Completed weather data fetch from all providers`, {
    totalDuration: `${duration}ms`,
    totalObservations: total,
    providers: {
      imd: imd.length,
      'nasa-gpm': gpm.length,
      openweather: openweather.length,
    },
  });

  return [...imd, ...gpm, ...openweather];
}

/**
 * Ingest all weather observations
 */
export async function ingestAllWeatherData(): Promise<number> {
  const observations = await fetchAllWeatherData();
  let count = 0;

  logger.info(`Starting ingestion of ${observations.length} weather observations`);

  for (const obs of observations) {
    try {
      await ingestWeatherObservation(obs);
      count++;
    } catch (error) {
      logger.error(`Failed to ingest ${obs.provider} data`, {
        provider: obs.provider,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  logger.info(`Weather data ingestion completed`, {
    totalIngested: count,
    totalReceived: observations.length,
  });

  return count;
}
