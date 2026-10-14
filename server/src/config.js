import path from 'node:path';

function requerida(nombre) {
  const valor = process.env[nombre];
  if (!valor) {
    throw new Error(`Falta la variable de entorno ${nombre}. Revisa tu archivo .env`);
  }
  return valor;
}

const entorno = process.env.NODE_ENV || 'development';

if (entorno === 'production' && (process.env.JWT_SECRET || '').length < 32) {
  throw new Error('JWT_SECRET debe tener al menos 32 caracteres en producción');
}

export const config = {
  entorno,
  esProduccion: entorno === 'production',
  puerto: Number(process.env.PORT) || 4000,
  databaseUrl: requerida('DATABASE_URL'),
  databaseSsl: process.env.DATABASE_SSL === 'true',
  jwtSecret: requerida('JWT_SECRET'),
  jwtExpira: process.env.JWT_EXPIRES_IN || '7d',
  clientUrl: process.env.CLIENT_URL || 'http://localhost:5173',
  uploadDir: path.resolve(process.env.UPLOAD_DIR || './uploads'),
  maxUploadMb: Number(process.env.MAX_UPLOAD_MB) || 5,
  servirCliente: process.env.SERVE_CLIENT === 'true',
  clientDist: path.resolve(process.env.CLIENT_DIST || '../client/dist'),
};
