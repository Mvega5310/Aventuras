import { Router } from 'express';
import { z } from 'zod';
import { query, transaccion } from '../db/pool.js';
import { autenticar, exigirRol } from '../middleware/auth.js';
import { validar } from '../middleware/validar.js';
import { ah, HttpError, noEncontrado, paginacion } from '../utils/http.js';
import { fecha, textoOpcional, uuid } from '../utils/esquemas.js';

const router = Router();
router.use(autenticar, exigirRol('admin'));

const idParam = validar(z.object({ id: uuid }), 'params');
const notasSchema = validar(z.object({ notas: textoOpcional(1000) }));

/* ───────────── Resumen ───────────── */

router.get(
  '/resumen',
  ah(async (req, res) => {
    const { rows } = await query(`
      SELECT
        (SELECT count(*) FROM agencias WHERE estado = 'pendiente')::int            AS agencias_pendientes,
        (SELECT count(*) FROM verificaciones WHERE estado = 'pendiente')::int      AS documentos_pendientes,
        (SELECT count(*) FROM viajes_verificados WHERE estado = 'pendiente')::int  AS comprobantes_pendientes,
        (SELECT count(*) FROM resenas WHERE estado = 'pendiente')::int             AS resenas_pendientes,
        (SELECT count(*) FROM reportes WHERE estado = 'abierto')::int              AS reportes_abiertos,
        (SELECT count(*) FROM agencias WHERE estado = 'activa' AND verificada)::int AS agencias_activas,
        (SELECT count(*) FROM usuarios WHERE rol = 'viajero')::int                 AS viajeros,
        (SELECT count(*) FROM agencias
          WHERE estado = 'activa' AND rnt_vigente_hasta < current_date + 30)::int  AS rnt_por_vencer`);
    res.json(rows[0]);
  }),
);

/* ───────────── Agencias ───────────── */

router.get(
  '/agencias',
  validar(
    z.object({
      estado: z.enum(['pendiente', 'activa', 'suspendida', 'rechazada']).optional(),
      q: z.string().trim().max(80).optional(),
      page: z.coerce.number().int().min(1).optional(),
    }),
    'query',
  ),
  ah(async (req, res) => {
    const { estado, q } = req.consulta;
    const { limit, offset } = paginacion(req.consulta, { limitePorDefecto: 50 });
    const { rows } = await query(
      `SELECT a.id, a.slug, a.razon_social, a.nombre_comercial, a.nit, a.rnt, a.rnt_vigente_hasta,
              a.ciudad, a.departamento, a.estado, a.verificada, a.plan, a.destacada_hasta,
              a.calificacion_promedio, a.total_resenas, a.notas_revision, a.created_at,
              u.email AS cuenta_email, u.nombre AS cuenta_nombre,
              COALESCE(json_agg(json_build_object(
                'id', v.id, 'tipo', v.tipo, 'documento_url', v.documento_url,
                'estado', v.estado, 'notas', v.notas, 'created_at', v.created_at)
                ORDER BY v.created_at DESC) FILTER (WHERE v.id IS NOT NULL), '[]') AS verificaciones
         FROM agencias a
         JOIN usuarios u ON u.id = a.usuario_id
         LEFT JOIN verificaciones v ON v.agencia_id = a.id
        WHERE ($1::estado_agencia IS NULL OR a.estado = $1)
          AND ($2::text IS NULL OR a.nombre_comercial ILIKE '%' || $2 || '%' OR a.nit ILIKE '%' || $2 || '%'
               OR a.rnt ILIKE '%' || $2 || '%')
        GROUP BY a.id, u.id
        ORDER BY a.created_at ASC
        LIMIT $3 OFFSET $4`,
      [estado ?? null, q || null, limit, offset],
    );
    res.json(rows);
  }),
);

router.post(
  '/agencias/:id/aprobar',
  idParam,
  notasSchema,
  ah(async (req, res) => {
    // Regla de confianza: no se activa sin un RNT verificado
    const { rowCount } = await query(
      `SELECT 1 FROM verificaciones WHERE agencia_id = $1 AND tipo = 'rnt' AND estado = 'aprobada'`,
      [req.params.id],
    );
    if (!rowCount) {
      throw new HttpError(409, 'Aprueba primero el documento de RNT de esta agencia');
    }
    const { rows } = await query(
      `UPDATE agencias SET estado = 'activa', verificada = true,
              verificada_en = COALESCE(verificada_en, now()), notas_revision = $2
        WHERE id = $1 RETURNING id, estado, verificada`,
      [req.params.id, req.body.notas],
    );
    if (!rows[0]) throw noEncontrado('Agencia');
    res.json(rows[0]);
  }),
);

for (const [accion, estado] of [
  ['rechazar', 'rechazada'],
  ['suspender', 'suspendida'],
]) {
  router.post(
    `/agencias/:id/${accion}`,
    idParam,
    notasSchema,
    ah(async (req, res) => {
      const { rows } = await query(
        `UPDATE agencias SET estado = $2::estado_agencia, notas_revision = $3,
                verificada = CASE WHEN $2::text = 'rechazada' THEN false ELSE verificada END
          WHERE id = $1 RETURNING id, estado, verificada`,
        [req.params.id, estado, req.body.notas],
      );
      if (!rows[0]) throw noEncontrado('Agencia');
      res.json(rows[0]);
    }),
  );
}

router.put(
  '/agencias/:id/plan',
  idParam,
  validar(
    z.object({
      plan: z.enum(['gratis', 'destacado', 'premium']),
      vence_en: fecha.optional().nullable(),
      monto: z.coerce.number().min(0).default(0),
      referencia_pago: textoOpcional(120),
    }),
  ),
  ah(async (req, res) => {
    const b = req.body;
    const resultado = await transaccion(async (db) => {
      const { rows } = await db.query(
        `UPDATE agencias SET plan = $2::plan_agencia,
                destacada_hasta = CASE WHEN $2::text = 'gratis' THEN NULL ELSE $3::date + interval '1 day' END
          WHERE id = $1 RETURNING id, plan, destacada_hasta`,
        [req.params.id, b.plan, b.vence_en ?? null],
      );
      if (!rows[0]) throw noEncontrado('Agencia');
      if (b.plan !== 'gratis' && b.vence_en) {
        await db.query(
          `INSERT INTO suscripciones (agencia_id, plan, monto, inicia_en, vence_en, referencia_pago)
           VALUES ($1, $2, $3, current_date, $4, $5)`,
          [req.params.id, b.plan, b.monto, b.vence_en, b.referencia_pago],
        );
      }
      return rows[0];
    });
    res.json(resultado);
  }),
);

/* ───────────── Documentos de verificación ───────────── */

for (const [accion, estado] of [
  ['aprobar', 'aprobada'],
  ['rechazar', 'rechazada'],
]) {
  router.post(
    `/verificaciones/:id/${accion}`,
    idParam,
    notasSchema,
    ah(async (req, res) => {
      const { rows } = await query(
        `UPDATE verificaciones SET estado = $2, notas = $3, revisado_por = $4, revisado_en = now()
          WHERE id = $1 RETURNING *`,
        [req.params.id, estado, req.body.notas, req.usuario.id],
      );
      if (!rows[0]) throw noEncontrado('Documento');
      res.json(rows[0]);
    }),
  );
}

/* ───────────── Comprobantes de viaje ───────────── */

router.get(
  '/viajes',
  validar(z.object({ estado: z.enum(['pendiente', 'aprobada', 'rechazada']).default('pendiente') }), 'query'),
  ah(async (req, res) => {
    const { rows } = await query(
      `SELECT v.*, u.nombre AS viajero, u.email AS viajero_email,
              a.nombre_comercial AS agencia, s.created_at AS solicitud_fecha
         FROM viajes_verificados v
         JOIN usuarios u ON u.id = v.viajero_id
         JOIN agencias a ON a.id = v.agencia_id
         LEFT JOIN solicitudes s ON s.id = v.solicitud_id
        WHERE v.estado = $1
        ORDER BY v.created_at ASC
        LIMIT 200`,
      [req.consulta.estado],
    );
    res.json(rows);
  }),
);

for (const [accion, estado] of [
  ['aprobar', 'aprobada'],
  ['rechazar', 'rechazada'],
]) {
  router.post(
    `/viajes/:id/${accion}`,
    idParam,
    notasSchema,
    ah(async (req, res) => {
      const { rows } = await query(
        `UPDATE viajes_verificados SET estado = $2, notas = $3, revisado_por = $4, revisado_en = now()
          WHERE id = $1 RETURNING *`,
        [req.params.id, estado, req.body.notas, req.usuario.id],
      );
      if (!rows[0]) throw noEncontrado('Comprobante');
      res.json(rows[0]);
    }),
  );
}

/* ───────────── Moderación de reseñas ───────────── */

router.get(
  '/resenas',
  validar(
    z.object({ estado: z.enum(['pendiente', 'publicada', 'oculta', 'rechazada']).default('pendiente') }),
    'query',
  ),
  ah(async (req, res) => {
    const { rows } = await query(
      `SELECT r.*, u.nombre AS viajero, a.nombre_comercial AS agencia, v.fecha_viaje
         FROM resenas r
         JOIN usuarios u ON u.id = r.viajero_id
         JOIN agencias a ON a.id = r.agencia_id
         JOIN viajes_verificados v ON v.id = r.viaje_id
        WHERE r.estado = $1
        ORDER BY r.created_at ASC
        LIMIT 200`,
      [req.consulta.estado],
    );
    res.json(rows);
  }),
);

for (const [accion, estado] of [
  ['publicar', 'publicada'],
  ['ocultar', 'oculta'],
  ['rechazar', 'rechazada'],
]) {
  router.post(
    `/resenas/:id/${accion}`,
    idParam,
    ah(async (req, res) => {
      const { rows } = await query(
        `UPDATE resenas SET estado = $2, moderado_por = $3, moderado_en = now()
          WHERE id = $1 RETURNING *`,
        [req.params.id, estado, req.usuario.id],
      );
      if (!rows[0]) throw noEncontrado('Reseña');
      res.json(rows[0]);
    }),
  );
}

/* ───────────── Reportes ───────────── */

router.get(
  '/reportes',
  validar(z.object({ estado: z.enum(['abierto', 'resuelto', 'descartado']).default('abierto') }), 'query'),
  ah(async (req, res) => {
    const { rows } = await query(
      `SELECT rp.*, u.nombre AS reportado_por_nombre,
              COALESCE(a.nombre_comercial, ar.nombre_comercial) AS agencia,
              r.comentario AS resena_comentario
         FROM reportes rp
         JOIN usuarios u ON u.id = rp.reportado_por
         LEFT JOIN agencias a ON a.id = rp.agencia_id
         LEFT JOIN resenas r ON r.id = rp.resena_id
         LEFT JOIN agencias ar ON ar.id = r.agencia_id
        WHERE rp.estado = $1
        ORDER BY rp.created_at ASC
        LIMIT 200`,
      [req.consulta.estado],
    );
    res.json(rows);
  }),
);

for (const [accion, estado] of [
  ['resolver', 'resuelto'],
  ['descartar', 'descartado'],
]) {
  router.post(
    `/reportes/:id/${accion}`,
    idParam,
    ah(async (req, res) => {
      const { rows } = await query(
        `UPDATE reportes SET estado = $2, resuelto_por = $3, resuelto_en = now()
          WHERE id = $1 RETURNING *`,
        [req.params.id, estado, req.usuario.id],
      );
      if (!rows[0]) throw noEncontrado('Reporte');
      res.json(rows[0]);
    }),
  );
}

export default router;
