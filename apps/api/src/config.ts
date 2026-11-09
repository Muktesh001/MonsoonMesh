import 'dotenv/config';

function required(name: string, fallback?: string): string {
  const value = process.env[name] ?? fallback;
  if (!value) throw new Error(`Missing required environment variable: ${name}`);
  return value;
}

function optional(name: string): string | undefined {
  return process.env[name];
}

export const config = {
  nodeEnv: process.env.NODE_ENV ?? 'development',
  port: Number(process.env.PORT ?? 4000),
  webOrigin: process.env.WEB_ORIGIN ?? 'http://localhost:5173',
  databaseUrl: required('DATABASE_URL', 'postgres://monsoonmesh:monsoonmesh@localhost:5432/monsoonmesh'),
  jwtSecret: required('JWT_SECRET', 'local-development-secret-change-before-deployment'),
  uploadDir: process.env.UPLOAD_DIR ?? './uploads',
  uploadMaxBytes: Number(process.env.UPLOAD_MAX_BYTES ?? 5_242_880),
  
  // External data source credentials (optional - uses mock data if not provided)
  externalData: {
    imdApiKey: optional('IMD_API_KEY'),
    imdBaseUrl: optional('IMD_BASE_URL') ?? 'https://mausam.imd.gov.in',
    
    nasaGpmToken: optional('NASA_GPM_TOKEN'),
    nasaGpmBaseUrl: optional('NASA_GPM_BASE_URL') ?? 'https://giovanni.gsfc.nasa.gov',
    
    openWeatherApiKey: optional('OPENWEATHER_API_KEY'),
    openWeatherBaseUrl: optional('OPENWEATHER_BASE_URL') ?? 'https://api.openweathermap.org',
    
    usgsBaseUrl: optional('USGS_BASE_URL') ?? 'https://waterdata.usgs.gov',
  },
};

if (config.nodeEnv === 'production' && config.jwtSecret === 'local-development-secret-change-before-deployment') {
  throw new Error('JWT_SECRET must be set to a unique secret in production');
}

