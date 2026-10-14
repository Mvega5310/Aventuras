import pg from 'pg';
import { config } from '../config.js';

// numeric -> number (calificaciones, precios). Los montos COP caben de sobra en un double.
pg.types.setTypeParser(1700, (v) => (v === null ? null : Number(v)));
// date -> 'YYYY-MM-DD' sin conversión de zona horaria
pg.types.setTypeParser(1082, (v) => v);

export const pool = new pg.Pool({
  connectionString: config.databaseUrl,
  ssl: config.databaseSsl ? { rejectUnauthorized: false } : undefined,
  max: 10,
});

pool.on('error', (err) => {
  console.error('Error inesperado en el pool de PostgreSQL', err);
});

export const query = (text, params) => pool.query(text, params);

/** Ejecuta fn dentro de una transacción y devuelve su resultado. */
export async function transaccion(fn) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const resultado = await fn(client);
    await client.query('COMMIT');
    return resultado;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}
