import 'dotenv/config';

function required(name: string, fallback?: string): string {
  const value = process.env[name] ?? fallback;
  if (!value) throw new Error(`Missing required environment variable: ${name}`);
  return value;
}

export const config = {
  nodeEnv: process.env.NODE_ENV ?? 'development',
  port: Number(process.env.PORT ?? 4000),
  webOrigin: process.env.WEB_ORIGIN ?? 'http://localhost:5173',
  databaseUrl: required('DATABASE_URL', 'postgres://monsoonmesh:monsoonmesh@localhost:5432/monsoonmesh'),
  jwtSecret: required('JWT_SECRET', 'local-development-secret-change-before-deployment'),
  uploadDir: process.env.UPLOAD_DIR ?? './uploads',
  uploadMaxBytes: Number(process.env.UPLOAD_MAX_BYTES ?? 5_242_880),
};

if (config.nodeEnv === 'production' && config.jwtSecret === 'local-development-secret-change-before-deployment') {
  throw new Error('JWT_SECRET must be set to a unique secret in production');
}
