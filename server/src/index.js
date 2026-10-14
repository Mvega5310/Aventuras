import { crearApp } from './app.js';
import { config } from './config.js';
import { pool } from './db/pool.js';
import { migrar } from './db/migrate.js';

// Aplica migraciones pendientes al arrancar (seguro con varias instancias gracias al advisory lock)
if (process.env.MIGRATE_ON_START !== 'false') {
  await migrar();
}

const app = crearApp();
const servidor = app.listen(config.puerto, () => {
  console.log(`API lista en http://localhost:${config.puerto}  (${config.entorno})`);
});

function apagar(senal) {
  console.log(`${senal} recibido, cerrando…`);
  servidor.close(() => pool.end().finally(() => process.exit(0)));
  setTimeout(() => process.exit(1), 10_000).unref();
}
process.on('SIGTERM', apagar);
process.on('SIGINT', apagar);
