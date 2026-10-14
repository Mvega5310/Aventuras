import { Router } from 'express';
import { query } from '../db/pool.js';
import { ah } from '../utils/http.js';

const router = Router();

router.get(
  '/tipos-viaje',
  ah(async (req, res) => {
    const { rows } = await query('SELECT id, slug, nombre FROM tipos_viaje ORDER BY id');
    res.json(rows);
  }),
);

router.get(
  '/destinos',
  ah(async (req, res) => {
    const { rows } = await query(
      `SELECT id, slug, nombre, pais, region, es_nacional
         FROM destinos
        ORDER BY es_nacional DESC, nombre`,
    );
    res.json(rows);
  }),
);

router.get(
  '/ciudades',
  ah(async (req, res) => {
    const { rows } = await query(
      `SELECT DISTINCT ciudad FROM agencias
        WHERE estado = 'activa' AND verificada
        ORDER BY ciudad`,
    );
    res.json(rows.map((r) => r.ciudad));
  }),
);

export default router;
