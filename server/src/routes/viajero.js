import { Router } from 'express';
import { z } from 'zod';
import { query } from '../db/pool.js';
import { autenticar, exigirRol } from '../middleware/auth.js';
import { validar } from '../middleware/validar.js';
import { ah, HttpError, noEncontrado, solicitudInvalida } from '../utils/http.js';
import {
  calificacion,
  dinero,
  fecha,
  noEsFutura,
  textoCorto,
  textoOpcional,
  urlArchivo,
  uuid,
} from '../utils/esquemas.js';
import { validarArchivoPropio } from './archivos.js';

/**
 * Rutas del viajero, montadas en /api:
 *  /solicitudes, /viajes, /resenas, /favoritos, /reportes
 */
const router = Router();
const soloViajero = [autenticar, exigirRol('viajero')];
const idParam = validar(z.object({ id: uuid }), 'params');

async function agenciaPublica(agenciaId) {
  const { rows } = await query(
    `SELECT id FROM agencias WHERE id = $1 AND estado = 'activa' AND verificada`,
    [agenciaId],
  );
  if (!rows[0]) throw noEncontrado('Agencia');
  return rows[0];
}

/* ───────────── Solicitudes de cotización ───────────── */

const solicitudSchema = z
  .object({
    agencia_id: uuid,
    paquete_id: uuid.optional().nullable(),
    destino_id: z.coerce.number().int().positive().optional().nullable(),
    tipo_viaje_id: z.coerce.number().int().positive().optional().nullable(),
    presupuesto_min: dinero.optional().nullable(),
    presupuesto_max: dinero.optional().nullable(),
    fecha_salida: fecha.optional().nullable(),
    fecha_regreso: fecha.optional().nullable(),
    num_viajeros: z.coerce.number().int().min(1).max(500).default(1),
    mensaje: textoOpcional(2000),
  })
  .refine(
    (s) => !s.presupuesto_min || !s.presupuesto_max || s.presupuesto_max >= s.presupuesto_min,
    { message: 'El presupuesto máximo debe ser mayor o igual al mínimo', path: ['presupuesto_max'] },
  )
  .refine((s) => !s.fecha_salida || !s.fecha_regreso || s.fecha_regreso >= s.fecha_salida, {
    message: 'La fecha de regreso debe ser posterior a la de salida',
    path: ['fecha_regreso'],
  });

router.post(
  '/solicitudes',
  soloViajero,
  validar(solicitudSchema),
  ah(async (req, res) => {
    const b = req.body;
    await agenciaPublica(b.agencia_id);

    let destinoId = b.destino_id ?? null;
    if (b.paquete_id) {
      const { rows } = await query(
        'SELECT destino_id FROM paquetes WHERE id = $1 AND agencia_id = $2 AND activo',
        [b.paquete_id, b.agencia_id],
      );
      if (!rows[0]) throw solicitudInvalida('El paquete no pertenece a esta agencia');
      destinoId ??= rows[0].destino_id;
    }

    // Antispam: máximo 3 solicitudes abiertas a la misma agencia
    const { rows: abiertas } = await query(
      `SELECT count(*)::int AS n FROM solicitudes
        WHERE viajero_id = $1 AND agencia_id = $2 AND estado IN ('nueva', 'vista')`,
      [req.usuario.id, b.agencia_id],
    );
    if (abiertas[0].n >= 3) {
      throw new HttpError(429, 'Ya tienes 3 solicitudes abiertas con esta agencia. Espera su respuesta.');
    }

    const { rows } = await query(
      `INSERT INTO solicitudes (viajero_id, agencia_id, paquete_id, destino_id, tipo_viaje_id,
                                presupuesto_min, presupuesto_max, fecha_salida, fecha_regreso,
                                num_viajeros, mensaje)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) RETURNING *`,
      [
        req.usuario.id, b.agencia_id, b.paquete_id ?? null, destinoId, b.tipo_viaje_id ?? null,
        b.presupuesto_min ?? null, b.presupuesto_max ?? null, b.fecha_salida ?? null,
        b.fecha_regreso ?? null, b.num_viajeros, b.mensaje,
      ],
    );
    res.status(201).json(rows[0]);
  }),
);

router.get(
  '/solicitudes',
  soloViajero,
  ah(async (req, res) => {
    const { rows } = await query(
      `SELECT s.*, a.nombre_comercial AS agencia, a.slug AS agencia_slug,
              a.whatsapp AS agencia_whatsapp,
              d.nombre AS destino, p.titulo AS paquete,
              v.id AS viaje_id, v.estado AS viaje_estado,
              r.id AS resena_id, r.estado AS resena_estado
         FROM solicitudes s
         JOIN agencias a ON a.id = s.agencia_id
         LEFT JOIN destinos d ON d.id = s.destino_id
         LEFT JOIN paquetes p ON p.id = s.paquete_id
         LEFT JOIN viajes_verificados v ON v.solicitud_id = s.id
         LEFT JOIN resenas r ON r.viaje_id = v.id
        WHERE s.viajero_id = $1
        ORDER BY s.created_at DESC
        LIMIT 200`,
      [req.usuario.id],
    );
    res.json(rows);
  }),
);

router.post(
  '/solicitudes/:id/cancelar',
  soloViajero,
  idParam,
  ah(async (req, res) => {
    const { rows } = await query(
      `UPDATE solicitudes SET estado = 'cancelada'
        WHERE id = $1 AND viajero_id = $2 AND estado IN ('nueva', 'vista', 'respondida')
        RETURNING *`,
      [req.params.id, req.usuario.id],
    );
    if (!rows[0]) throw noEncontrado('Solicitud');
    res.json(rows[0]);
  }),
);

/* ───────────── Viajes verificados (comprobantes) ───────────── */

const viajeSchema = z.object({
  agencia_id: uuid,
  solicitud_id: uuid.optional().nullable(),
  comprobante_url: urlArchivo.refine(Boolean, 'Adjunta el comprobante del viaje'),
  fecha_viaje: fecha.refine(noEsFutura, 'Solo puedes registrar viajes que ya realizaste'),
});

router.post(
  '/viajes',
  soloViajero,
  validar(viajeSchema),
  ah(async (req, res) => {
    const b = req.body;
    await agenciaPublica(b.agencia_id);
    await validarArchivoPropio(b.comprobante_url, req.usuario.id);
    if (b.solicitud_id) {
      const { rowCount } = await query(
        'SELECT 1 FROM solicitudes WHERE id = $1 AND viajero_id = $2 AND agencia_id = $3',
        [b.solicitud_id, req.usuario.id, b.agencia_id],
      );
      if (!rowCount) throw solicitudInvalida('La solicitud no corresponde a esta agencia');
    }
    const { rows } = await query(
      `INSERT INTO viajes_verificados (solicitud_id, viajero_id, agencia_id, comprobante_url, fecha_viaje)
       VALUES ($1, $2, $3, $4, $5) RETURNING *`,
      [b.solicitud_id ?? null, req.usuario.id, b.agencia_id, b.comprobante_url, b.fecha_viaje],
    );
    res.status(201).json(rows[0]);
  }),
);

router.get(
  '/viajes',
  soloViajero,
  ah(async (req, res) => {
    const { rows } = await query(
      `SELECT v.id, v.agencia_id, v.solicitud_id, v.fecha_viaje, v.estado, v.notas, v.created_at,
              a.nombre_comercial AS agencia, a.slug AS agencia_slug,
              r.id AS resena_id, r.estado AS resena_estado
         FROM viajes_verificados v
         JOIN agencias a ON a.id = v.agencia_id
         LEFT JOIN resenas r ON r.viaje_id = v.id
        WHERE v.viajero_id = $1
        ORDER BY v.created_at DESC`,
      [req.usuario.id],
    );
    res.json(rows);
  }),
);

/* ───────────── Reseñas ───────────── */

const resenaSchema = z.object({
  viaje_id: uuid,
  calificacion_general: calificacion,
  calificacion_precio: calificacion,
  calificacion_atencion: calificacion,
  calificacion_cumplimiento: calificacion,
  titulo: textoOpcional(120),
  comentario: z.string().trim().min(20, 'Cuéntanos un poco más (mínimo 20 caracteres)').max(3000),
});

router.post(
  '/resenas',
  soloViajero,
  validar(resenaSchema),
  ah(async (req, res) => {
    const b = req.body;
    const { rows: viajes } = await query(
      'SELECT id, agencia_id, estado FROM viajes_verificados WHERE id = $1 AND viajero_id = $2',
      [b.viaje_id, req.usuario.id],
    );
    const viaje = viajes[0];
    if (!viaje) throw noEncontrado('Viaje');
    if (viaje.estado !== 'aprobada') {
      throw new HttpError(409, 'Podrás reseñar cuando verifiquemos el comprobante de tu viaje');
    }
    const { rows } = await query(
      `INSERT INTO resenas (viaje_id, agencia_id, viajero_id, calificacion_general,
                            calificacion_precio, calificacion_atencion, calificacion_cumplimiento,
                            titulo, comentario)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING *`,
      [
        viaje.id, viaje.agencia_id, req.usuario.id, b.calificacion_general, b.calificacion_precio,
        b.calificacion_atencion, b.calificacion_cumplimiento, b.titulo, b.comentario,
      ],
    );
    res.status(201).json(rows[0]);
  }),
);

/* ───────────── Favoritos ───────────── */

router.get(
  '/favoritos',
  soloViajero,
  ah(async (req, res) => {
    const { rows } = await query(
      `SELECT a.id, a.slug, a.nombre_comercial, a.ciudad, a.logo_url, a.whatsapp,
              a.calificacion_promedio, a.total_resenas, a.verificada, f.created_at
         FROM favoritos f
         JOIN agencias a ON a.id = f.agencia_id
        WHERE f.viajero_id = $1 AND a.estado = 'activa' AND a.verificada
        ORDER BY f.created_at DESC`,
      [req.usuario.id],
    );
    res.json(rows);
  }),
);

router.put(
  '/favoritos/:id',
  soloViajero,
  idParam,
  ah(async (req, res) => {
    await agenciaPublica(req.params.id);
    await query(
      'INSERT INTO favoritos (viajero_id, agencia_id) VALUES ($1, $2) ON CONFLICT DO NOTHING',
      [req.usuario.id, req.params.id],
    );
    res.status(204).end();
  }),
);

router.delete(
  '/favoritos/:id',
  soloViajero,
  idParam,
  ah(async (req, res) => {
    await query('DELETE FROM favoritos WHERE viajero_id = $1 AND agencia_id = $2', [
      req.usuario.id,
      req.params.id,
    ]);
    res.status(204).end();
  }),
);

/* ───────────── Reportes (cualquier usuario con sesión) ───────────── */

const reporteSchema = z.discriminatedUnion('tipo', [
  z.object({ tipo: z.literal('agencia'), agencia_id: uuid, motivo: textoCorto(1000) }),
  z.object({ tipo: z.literal('resena'), resena_id: uuid, motivo: textoCorto(1000) }),
]);

router.post(
  '/reportes',
  autenticar,
  validar(reporteSchema),
  ah(async (req, res) => {
    const b = req.body;
    const { rows } = await query(
      `INSERT INTO reportes (tipo, agencia_id, resena_id, reportado_por, motivo)
       VALUES ($1, $2, $3, $4, $5) RETURNING id, tipo, estado, created_at`,
      [b.tipo, b.agencia_id ?? null, b.resena_id ?? null, req.usuario.id, b.motivo],
    );
    res.status(201).json(rows[0]);
  }),
);

export default router;
