import 'dotenv/config';

function required(name: string, fallback?: string): string {
  const value = process.env[name] ?? fallback;
  if (!value) throw new Error(`Missing required environment variable: ${name}`);
  return value;
}

function optional(name: string): string | undefined {
  return process.env[name];
}

function optionalNumber(name: string, fallback: number): number {
  const value = process.env[name];
  return value ? Number(value) : fallback;
}

// Validate external API credential format
function validateApiKey(key: string | undefined, name: string): string | undefined {
  if (!key) return undefined;
  if (typeof key !== 'string' || key.trim().length === 0) {
    throw new Error(`Invalid ${name}: must be a non-empty string`);
  }
  return key;
}

// Validate URL format
function validateUrl(url: string | undefined, name: string): string | undefined {
  if (!url) return undefined;
  try {
    new URL(url);
    return url;
  } catch {
    throw new Error(`Invalid ${name}: must be a valid URL`);
  }
}

export const config = {
  nodeEnv: process.env.NODE_ENV ?? 'development',
  port: Number(process.env.PORT ?? 4000),
  webOrigin: process.env.WEB_ORIGIN ?? 'http://localhost:5173',
  databaseUrl: required('DATABASE_URL', 'postgres://monsoonmesh:monsoonmesh@localhost:5432/monsoonmesh'),
  jwtSecret: required('JWT_SECRET', 'local-development-secret-change-before-deployment'),
  uploadDir: process.env.UPLOAD_DIR ?? './uploads',
  uploadMaxBytes: Number(process.env.UPLOAD_MAX_BYTES ?? 5_242_880),
  
  // Logging configuration
  logLevel: process.env.LOG_LEVEL ?? 'info',
  logDir: process.env.LOG_DIR ?? './logs',
  enableAuditLogs: process.env.ENABLE_AUDIT_LOGS !== 'false',
  enableErrorTracking: process.env.ENABLE_ERROR_TRACKING === 'true',
  
  // API configuration
  apiCallTimeoutMs: optionalNumber('API_CALL_TIMEOUT_MS', 10000),
  apiMaxRetries: optionalNumber('API_MAX_RETRIES', 3),
  weatherCacheTtlSeconds: optionalNumber('WEATHER_CACHE_TTL_SECONDS', 300),
  
  // External data source credentials (optional - uses mock data if not provided)
  externalData: {
    imdApiKey: validateApiKey(optional('IMD_API_KEY'), 'IMD_API_KEY'),
    imdBaseUrl: validateUrl(optional('IMD_BASE_URL'), 'IMD_BASE_URL') ?? 'https://mausam.imd.gov.in',
    
    nasaGpmToken: validateApiKey(optional('NASA_GPM_TOKEN'), 'NASA_GPM_TOKEN'),
    nasaGpmBaseUrl: validateUrl(optional('NASA_GPM_BASE_URL'), 'NASA_GPM_BASE_URL') ?? 'https://giovanni.gsfc.nasa.gov',
    
    openWeatherApiKey: validateApiKey(optional('OPENWEATHER_API_KEY'), 'OPENWEATHER_API_KEY'),
    openWeatherBaseUrl: validateUrl(optional('OPENWEATHER_BASE_URL'), 'OPENWEATHER_BASE_URL') ?? 'https://api.openweathermap.org',
    
    usgsBaseUrl: validateUrl(optional('USGS_BASE_URL'), 'USGS_BASE_URL') ?? 'https://waterdata.usgs.gov',
  },
};

if (config.nodeEnv === 'production' && config.jwtSecret === 'local-development-secret-change-before-deployment') {
  throw new Error('JWT_SECRET must be set to a unique secret in production');
}

export type Config = typeof config;

