import { Router } from 'express';
import { z } from 'zod';
import { query } from '../db/pool.js';
import { autenticarOpcional } from '../middleware/auth.js';
import { validar } from '../middleware/validar.js';
import { ah, noEncontrado, paginacion } from '../utils/http.js';

const router = Router();

const busquedaSchema = z.object({
  q: z.string().trim().max(80).optional(),
  destino: z.string().trim().max(80).optional(), // slug
  tipo: z.string().trim().max(40).optional(), // slug
  ciudad: z.string().trim().max(80).optional(),
  min_calificacion: z.coerce.number().min(0).max(5).optional(),
  precio_max: z.coerce.number().min(0).optional(),
  orden: z.enum(['calificacion', 'resenas', 'precio']).default('calificacion'),
  page: z.coerce.number().int().min(1).optional(),
  limit: z.coerce.number().int().min(1).max(50).optional(),
});

const ordenes = {
  calificacion: 'calificacion_promedio DESC, total_resenas DESC',
  resenas: 'total_resenas DESC, calificacion_promedio DESC',
  precio: 'precio_desde ASC NULLS LAST, calificacion_promedio DESC',
};

const escaparLike = (t) => t.replace(/[\\%_]/g, (c) => `\\${c}`);

/** GET /api/agencias — directorio público con filtros (solo agencias activas y verificadas) */
router.get(
  '/',
  validar(busquedaSchema, 'query'),
  ah(async (req, res) => {
    const f = req.consulta;
    const { page, limit, offset } = paginacion(f);

    const params = [
      f.q ? `%${escaparLike(f.q)}%` : null, // $1
      f.destino || null, // $2
      f.tipo || null, // $3
      f.ciudad || null, // $4
      f.min_calificacion ?? null, // $5
      f.precio_max ?? null, // $6
      limit, // $7
      offset, // $8
    ];

    const { rows } = await query(
      `WITH destino_filtro AS (
         SELECT id FROM destinos WHERE slug = $2
       ),
       base AS (
         SELECT a.id, a.slug, a.nombre_comercial, a.descripcion, a.ciudad, a.departamento,
                a.whatsapp, a.logo_url, a.plan, a.verificada,
                COALESCE(a.destacada_hasta > now(), false) AS destacada,
                a.calificacion_promedio, a.total_resenas,
                (SELECT min(p.precio_desde) FROM paquetes p
                  WHERE p.agencia_id = a.id AND p.activo
                    AND ($2::text IS NULL OR p.destino_id IN (SELECT id FROM destino_filtro))
                ) AS precio_desde,
                COALESCE((SELECT array_agg(t.nombre ORDER BY t.id)
                            FROM agencia_tipos_viaje atv
                            JOIN tipos_viaje t ON t.id = atv.tipo_viaje_id
                           WHERE atv.agencia_id = a.id), '{}') AS tipos
           FROM agencias a
          WHERE a.estado = 'activa' AND a.verificada
            AND ($1::text IS NULL OR a.nombre_comercial ILIKE $1 OR a.descripcion ILIKE $1)
            AND ($2::text IS NULL OR EXISTS (
                  SELECT 1 FROM destino_filtro d
                   WHERE EXISTS (SELECT 1 FROM agencia_destinos ad
                                  WHERE ad.agencia_id = a.id AND ad.destino_id = d.id)
                      OR EXISTS (SELECT 1 FROM paquetes p
                                  WHERE p.agencia_id = a.id AND p.destino_id = d.id AND p.activo)))
            AND ($3::text IS NULL OR EXISTS (
                  SELECT 1 FROM agencia_tipos_viaje atv
                    JOIN tipos_viaje t ON t.id = atv.tipo_viaje_id
                   WHERE atv.agencia_id = a.id AND t.slug = $3))
            AND ($4::text IS NULL OR a.ciudad ILIKE $4)
            AND ($5::numeric IS NULL OR a.calificacion_promedio >= $5)
       )
       SELECT *, count(*) OVER () AS total_resultados
         FROM base
        WHERE ($6::numeric IS NULL OR precio_desde <= $6)
        ORDER BY destacada DESC, ${ordenes[f.orden]}, nombre_comercial
        LIMIT $7 OFFSET $8`,
      params,
    );

    const total = rows.length ? Number(rows[0].total_resultados) : 0;
    res.json({
      datos: rows.map(({ total_resultados, ...r }) => r),
      paginacion: { page, limit, total, paginas: Math.ceil(total / limit) },
    });
  }),
);

/** GET /api/agencias/:slug — perfil público completo */
router.get(
  '/:slug',
  autenticarOpcional,
  ah(async (req, res) => {
    const { rows } = await query(
      `SELECT a.id, a.slug, a.razon_social, a.nombre_comercial, a.nit, a.rnt, a.rnt_vigente_hasta,
              a.descripcion, a.ciudad, a.departamento, a.direccion, a.telefono, a.whatsapp,
              a.email_contacto, a.sitio_web, a.logo_url, a.portada_url, a.anio_fundacion,
              a.plan, a.verificada, a.verificada_en,
              COALESCE(a.destacada_hasta > now(), false) AS destacada,
              a.calificacion_promedio, a.total_resenas
         FROM agencias a
        WHERE a.slug = $1 AND a.estado = 'activa' AND a.verificada`,
      [req.params.slug],
    );
    const agencia = rows[0];
    if (!agencia) throw noEncontrado('Agencia');

    const [tipos, destinos, paquetes, criterios, resenas, favorito] = await Promise.all([
      query(
        `SELECT t.id, t.slug, t.nombre FROM agencia_tipos_viaje atv
           JOIN tipos_viaje t ON t.id = atv.tipo_viaje_id
          WHERE atv.agencia_id = $1 ORDER BY t.id`,
        [agencia.id],
      ),
      query(
        `SELECT d.id, d.slug, d.nombre, d.pais FROM agencia_destinos ad
           JOIN destinos d ON d.id = ad.destino_id
          WHERE ad.agencia_id = $1 ORDER BY d.nombre`,
        [agencia.id],
      ),
      query(
        `SELECT p.id, p.titulo, p.descripcion, p.precio_desde, p.moneda, p.duracion_dias,
                p.incluye, p.no_incluye, p.imagen_url,
                d.nombre AS destino, d.slug AS destino_slug, t.nombre AS tipo_viaje
           FROM paquetes p
           JOIN destinos d ON d.id = p.destino_id
           LEFT JOIN tipos_viaje t ON t.id = p.tipo_viaje_id
          WHERE p.agencia_id = $1 AND p.activo
          ORDER BY p.precio_desde NULLS LAST`,
        [agencia.id],
      ),
      query(
        `SELECT ROUND(AVG(calificacion_precio)::numeric, 1)       AS precio,
                ROUND(AVG(calificacion_atencion)::numeric, 1)     AS atencion,
                ROUND(AVG(calificacion_cumplimiento)::numeric, 1) AS cumplimiento
           FROM resenas WHERE agencia_id = $1 AND estado = 'publicada'`,
        [agencia.id],
      ),
      query(
        `SELECT r.id, r.calificacion_general, r.calificacion_precio, r.calificacion_atencion,
                r.calificacion_cumplimiento, r.titulo, r.comentario, r.created_at,
                v.fecha_viaje,
                -- Solo nombre e inicial del apellido para proteger la privacidad
                split_part(u.nombre, ' ', 1) ||
                  CASE WHEN split_part(u.nombre, ' ', 2) <> ''
                       THEN ' ' || left(split_part(u.nombre, ' ', 2), 1) || '.' ELSE '' END AS autor,
                rr.texto AS respuesta, rr.created_at AS respuesta_fecha
           FROM resenas r
           JOIN usuarios u ON u.id = r.viajero_id
           JOIN viajes_verificados v ON v.id = r.viaje_id
           LEFT JOIN respuestas_resena rr ON rr.resena_id = r.id
          WHERE r.agencia_id = $1 AND r.estado = 'publicada'
          ORDER BY r.created_at DESC
          LIMIT 30`,
        [agencia.id],
      ),
      req.usuario
        ? query('SELECT 1 FROM favoritos WHERE viajero_id = $1 AND agencia_id = $2', [
            req.usuario.id,
            agencia.id,
          ])
        : Promise.resolve({ rowCount: 0 }),
    ]);

    res.json({
      ...agencia,
      tipos: tipos.rows,
      destinos: destinos.rows,
      paquetes: paquetes.rows,
      criterios: criterios.rows[0],
      resenas: resenas.rows,
      es_favorito: favorito.rowCount > 0,
    });
  }),
);

export default router;
