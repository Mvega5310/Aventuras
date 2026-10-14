import express from 'express';
import fs from 'node:fs';
import path from 'node:path';
import cors from 'cors';
import helmet from 'helmet';
import { config } from './config.js';
import { query } from './db/pool.js';
import { manejarErrores, noEncontradaRuta } from './middleware/errores.js';
import authRoutes from './routes/auth.js';
import catalogosRoutes from './routes/catalogos.js';
import archivosRoutes from './routes/archivos.js';
import agenciasRoutes from './routes/agencias.js';
import miAgenciaRoutes from './routes/miAgencia.js';
import viajeroRoutes from './routes/viajero.js';
import adminRoutes from './routes/admin.js';

export function crearApp() {
  const app = express();

  app.set('trust proxy', 1); // detrás del proxy de Railway / Render
  app.disable('x-powered-by');
  app.use(
    helmet({
      crossOriginResourcePolicy: { policy: 'same-site' },
      contentSecurityPolicy: config.servirCliente
        ? {
            directives: {
              ...helmet.contentSecurityPolicy.getDefaultDirectives(),
              'img-src': ["'self'", 'data:', 'https:'],
            },
          }
        : false,
    }),
  );
  app.use(
    cors({
      origin: config.clientUrl.split(',').map((o) => o.trim()),
      credentials: false,
    }),
  );
  app.use(express.json({ limit: '200kb' }));

  app.get('/api/salud', async (req, res) => {
    try {
      await query('SELECT 1');
      res.json({ ok: true, db: 'ok' });
    } catch {
      res.status(503).json({ ok: false, db: 'sin conexión' });
    }
  });

  app.use('/api/auth', authRoutes);
  app.use('/api/catalogos', catalogosRoutes);
  app.use('/api/archivos', archivosRoutes);
  app.use('/api/agencias', agenciasRoutes);
  app.use('/api/mi-agencia', miAgenciaRoutes);
  app.use('/api/admin', adminRoutes);
  app.use('/api', viajeroRoutes);
  app.use('/api', noEncontradaRuta);

  // En producción el mismo servidor entrega el frontend compilado
  if (config.servirCliente && fs.existsSync(config.clientDist)) {
    app.use(express.static(config.clientDist, { index: false, maxAge: '1h' }));
    app.get('*', (req, res) => res.sendFile(path.join(config.clientDist, 'index.html')));
  }

  app.use(manejarErrores);
  return app;
}
