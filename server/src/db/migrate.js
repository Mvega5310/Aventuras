import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { pool } from './pool.js';

const carpeta = path.join(path.dirname(fileURLToPath(import.meta.url)), 'migrations');

/** Aplica en orden las migraciones .sql que aún no se han ejecutado. */
export async function migrar({ silencioso = false } = {}) {
  const log = silencioso ? () => {} : console.log;
  const client = await pool.connect();
  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS schema_migraciones (
        nombre      text PRIMARY KEY,
        aplicada_en timestamptz NOT NULL DEFAULT now()
      )`);
    // Evita que dos procesos migren a la vez
    await client.query('SELECT pg_advisory_lock(727001)');

    const { rows } = await client.query('SELECT nombre FROM schema_migraciones');
    const aplicadas = new Set(rows.map((r) => r.nombre));
    const archivos = (await fs.readdir(carpeta)).filter((f) => f.endsWith('.sql')).sort();

    let nuevas = 0;
    for (const archivo of archivos) {
      if (aplicadas.has(archivo)) continue;
      const sql = await fs.readFile(path.join(carpeta, archivo), 'utf8');
      log(`→ Aplicando ${archivo}`);
      await client.query('BEGIN');
      try {
        await client.query(sql);
        await client.query('INSERT INTO schema_migraciones (nombre) VALUES ($1)', [archivo]);
        await client.query('COMMIT');
        nuevas++;
      } catch (err) {
        await client.query('ROLLBACK');
        throw new Error(`Falló la migración ${archivo}: ${err.message}`);
      }
    }
    log(nuevas ? `✓ ${nuevas} migración(es) aplicada(s)` : '✓ La base de datos ya está al día');
  } finally {
    await client.query('SELECT pg_advisory_unlock(727001)').catch(() => {});
    client.release();
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  migrar()
    .then(() => pool.end())
    .catch((err) => {
      console.error(err.message);
      process.exit(1);
    });
}
