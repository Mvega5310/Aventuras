import { Router } from 'express';
import { z } from 'zod';
import { query, transaccion } from '../db/pool.js';
import { autenticar, exigirRol } from '../middleware/auth.js';
import { validar } from '../middleware/validar.js';
import { ah, HttpError, noEncontrado } from '../utils/http.js';
import { slugUnico } from '../utils/slug.js';
import {
  dinero,
  fecha,
  telefono,
  textoCorto,
  textoOpcional,
  url,
  urlArchivo,
  uuid,
} from '../utils/esquemas.js';
import { validarArchivoPropio } from './archivos.js';

const router = Router();
router.use(autenticar, exigirRol('agencia'));

/** Carga la agencia del usuario en req.agencia (o 404 si aún no la registra). */
const conAgencia = ah(async (req, res, next) => {
  const { rows } = await query('SELECT * FROM agencias WHERE usuario_id = $1', [req.usuario.id]);
  if (!rows[0]) throw new HttpError(404, 'Primero registra los datos de tu agencia');
  req.agencia = rows[0];
  next();
});

const idsUnicos = z
  .array(z.coerce.number().int().positive())
  .max(60)
  .default([])
  .transform((a) => [...new Set(a)]);

const camposComerciales = {
  nombre_comercial: textoCorto(120),
  descripcion: textoOpcional(3000),
  ciudad: textoCorto(80),
  departamento: textoCorto(80),
  direccion: textoOpcional(200),
  telefono,
  whatsapp: telefono,
  email_contacto: z
    .string()
    .trim()
    .toLowerCase()
    .email('Correo inválido')
    .optional()
    .nullable()
    .or(z.literal('').transform(() => null)),
  sitio_web: url,
  logo_url: urlArchivo,
  portada_url: urlArchivo,
  anio_fundacion: z.coerce.number().int().min(1900).max(2100).optional().nullable(),
  tipos: idsUnicos,
  destinos: idsUnicos,
};

const camposLegales = {
  razon_social: textoCorto(160),
  nit: z
    .string()
    .trim()
    .regex(/^[0-9.\- ]{6,20}$/, 'NIT inválido (solo números, puntos y guion)'),
  rnt: z.string().trim().regex(/^[0-9]{3,10}$/, 'RNT inválido (solo números)'),
  rnt_vigente_hasta: fecha.optional().nullable(),
};

const agenciaSchema = z.object({ ...camposLegales, ...camposComerciales });

async function guardarRelaciones(db, agenciaId, tipos, destinos) {
  await db.query('DELETE FROM agencia_tipos_viaje WHERE agencia_id = $1', [agenciaId]);
  await db.query('DELETE FROM agencia_destinos WHERE agencia_id = $1', [agenciaId]);
  if (tipos.length) {
    await db.query(
      `INSERT INTO agencia_tipos_viaje (agencia_id, tipo_viaje_id)
       SELECT $1, unnest($2::smallint[])`,
      [agenciaId, tipos],
    );
  }
  if (destinos.length) {
    await db.query(
      `INSERT INTO agencia_destinos (agencia_id, destino_id)
       SELECT $1, unnest($2::int[])`,
      [agenciaId, destinos],
    );
  }
}

async function agenciaCompleta(agenciaId) {
  const [a, tipos, destinos, verif] = await Promise.all([
    query('SELECT * FROM agencias WHERE id = $1', [agenciaId]),
    query('SELECT tipo_viaje_id FROM agencia_tipos_viaje WHERE agencia_id = $1', [agenciaId]),
    query('SELECT destino_id FROM agencia_destinos WHERE agencia_id = $1', [agenciaId]),
    query(
      `SELECT id, tipo, documento_url, estado, notas, revisado_en, created_at
         FROM verificaciones WHERE agencia_id = $1 ORDER BY created_at DESC`,
      [agenciaId],
    ),
  ]);
  return {
    ...a.rows[0],
    tipos: tipos.rows.map((r) => r.tipo_viaje_id),
    destinos: destinos.rows.map((r) => r.destino_id),
    verificaciones: verif.rows,
  };
}

/* ───────────── Perfil de la agencia ───────────── */

router.get(
  '/',
  ah(async (req, res) => {
    const { rows } = await query('SELECT id FROM agencias WHERE usuario_id = $1', [req.usuario.id]);
    res.json(rows[0] ? await agenciaCompleta(rows[0].id) : null);
  }),
);

router.post(
  '/',
  validar(agenciaSchema),
  ah(async (req, res) => {
    const b = req.body;
    await validarArchivoPropio(b.logo_url, req.usuario.id);
    await validarArchivoPropio(b.portada_url, req.usuario.id);

    const id = await transaccion(async (db) => {
      const slug = await slugUnico(db, 'agencias', b.nombre_comercial);
      const { rows } = await db.query(
        `INSERT INTO agencias (usuario_id, razon_social, nombre_comercial, slug, nit, rnt,
                               rnt_vigente_hasta, descripcion, ciudad, departamento, direccion,
                               telefono, whatsapp, email_contacto, sitio_web, logo_url,
                               portada_url, anio_fundacion)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18)
         RETURNING id`,
        [
          req.usuario.id, b.razon_social, b.nombre_comercial, slug, b.nit, b.rnt,
          b.rnt_vigente_hasta ?? null, b.descripcion, b.ciudad, b.departamento, b.direccion,
          b.telefono ?? null, b.whatsapp ?? null, b.email_contacto ?? null, b.sitio_web ?? null,
          b.logo_url ?? null, b.portada_url ?? null, b.anio_fundacion ?? null,
        ],
      );
      await guardarRelaciones(db, rows[0].id, b.tipos, b.destinos);
      return rows[0].id;
    });
    res.status(201).json(await agenciaCompleta(id));
  }),
);

router.put(
  '/',
  conAgencia,
  validar(agenciaSchema.partial({ razon_social: true, nit: true, rnt: true })),
  ah(async (req, res) => {
    const a = req.agencia;
    const b = req.body;
    await validarArchivoPropio(b.logo_url, req.usuario.id);
    await validarArchivoPropio(b.portada_url, req.usuario.id);

    // Los datos legales quedan bloqueados una vez verificada la agencia
    const cambiaLegal =
      (b.razon_social && b.razon_social !== a.razon_social) ||
      (b.nit && b.nit !== a.nit) ||
      (b.rnt && b.rnt !== a.rnt);
    if (a.verificada && cambiaLegal) {
      throw new HttpError(
        409,
        'Tu agencia ya está verificada: para cambiar razón social, NIT o RNT escribe a soporte',
      );
    }

    await transaccion(async (db) => {
      const slug =
        b.nombre_comercial !== a.nombre_comercial
          ? await slugUnico(db, 'agencias', b.nombre_comercial, a.id)
          : a.slug;
      await db.query(
        `UPDATE agencias SET
           razon_social = COALESCE($2, razon_social), nit = COALESCE($3, nit),
           rnt = COALESCE($4, rnt), rnt_vigente_hasta = $5,
           nombre_comercial = $6, slug = $7, descripcion = $8, ciudad = $9, departamento = $10,
           direccion = $11, telefono = $12, whatsapp = $13, email_contacto = $14, sitio_web = $15,
           logo_url = $16, portada_url = $17, anio_fundacion = $18,
           -- Si fue rechazada y corrige sus datos, vuelve a revisión
           estado = CASE WHEN estado = 'rechazada' THEN 'pendiente'::estado_agencia ELSE estado END
         WHERE id = $1`,
        [
          a.id, b.razon_social ?? null, b.nit ?? null, b.rnt ?? null,
          b.rnt_vigente_hasta ?? a.rnt_vigente_hasta, b.nombre_comercial, slug, b.descripcion,
          b.ciudad, b.departamento, b.direccion, b.telefono ?? null, b.whatsapp ?? null,
          b.email_contacto ?? null, b.sitio_web ?? null, b.logo_url ?? null,
          b.portada_url ?? null, b.anio_fundacion ?? null,
        ],
      );
      await guardarRelaciones(db, a.id, b.tipos, b.destinos);
    });
    res.json(await agenciaCompleta(a.id));
  }),
);

/* ───────────── Documentos de verificación ───────────── */

const verificacionSchema = z.object({
  tipo: z.enum(['rnt', 'camara_comercio', 'rut', 'identidad_representante']),
  documento_url: urlArchivo.refine(Boolean, 'Adjunta el documento'),
});

router.post(
  '/verificaciones',
  conAgencia,
  validar(verificacionSchema),
  ah(async (req, res) => {
    await validarArchivoPropio(req.body.documento_url, req.usuario.id);
    const { rows } = await query(
      `INSERT INTO verificaciones (agencia_id, tipo, documento_url)
       VALUES ($1, $2, $3)
       RETURNING id, tipo, documento_url, estado, created_at`,
      [req.agencia.id, req.body.tipo, req.body.documento_url],
    );
    res.status(201).json(rows[0]);
  }),
);

/* ───────────── Resumen para el tablero ───────────── */

router.get(
  '/resumen',
  conAgencia,
  ah(async (req, res) => {
    const a = req.agencia;
    const { rows } = await query(
      `SELECT
         (SELECT count(*) FROM solicitudes WHERE agencia_id = $1 AND estado = 'nueva')::int AS solicitudes_nuevas,
         (SELECT count(*) FROM solicitudes WHERE agencia_id = $1)::int                         AS solicitudes_total,
         (SELECT count(*) FROM paquetes WHERE agencia_id = $1 AND activo)::int                 AS paquetes_activos,
         (SELECT count(*) FROM resenas r
            WHERE r.agencia_id = $1 AND r.estado = 'publicada'
              AND NOT EXISTS (SELECT 1 FROM respuestas_resena rr WHERE rr.resena_id = r.id))::int AS resenas_sin_respuesta`,
      [a.id],
    );
    res.json({
      ...rows[0],
      calificacion_promedio: a.calificacion_promedio,
      total_resenas: a.total_resenas,
      estado: a.estado,
      verificada: a.verificada,
      rnt_vigente_hasta: a.rnt_vigente_hasta,
      plan: a.plan,
      slug: a.slug,
    });
  }),
);

/* ───────────── Paquetes ───────────── */

const listaTextos = z.array(z.string().trim().min(1).max(160)).max(30).default([]);
const paqueteSchema = z.object({
  destino_id: z.coerce.number().int().positive(),
  tipo_viaje_id: z.coerce.number().int().positive().optional().nullable(),
  titulo: textoCorto(140),
  descripcion: textoOpcional(3000),
  precio_desde: dinero.optional().nullable(),
  moneda: z.enum(['COP', 'USD', 'EUR']).default('COP'),
  duracion_dias: z.coerce.number().int().min(1).max(365).optional().nullable(),
  incluye: listaTextos,
  no_incluye: listaTextos,
  imagen_url: urlArchivo,
  activo: z.boolean().default(true),
});

router.get(
  '/paquetes',
  conAgencia,
  ah(async (req, res) => {
    const { rows } = await query(
      `SELECT p.*, d.nombre AS destino, t.nombre AS tipo_viaje
         FROM paquetes p
         JOIN destinos d ON d.id = p.destino_id
         LEFT JOIN tipos_viaje t ON t.id = p.tipo_viaje_id
        WHERE p.agencia_id = $1
        ORDER BY p.activo DESC, p.created_at DESC`,
      [req.agencia.id],
    );
    res.json(rows);
  }),
);

router.post(
  '/paquetes',
  conAgencia,
  validar(paqueteSchema),
  ah(async (req, res) => {
    const b = req.body;
    await validarArchivoPropio(b.imagen_url, req.usuario.id);
    const { rows } = await query(
      `INSERT INTO paquetes (agencia_id, destino_id, tipo_viaje_id, titulo, descripcion,
                             precio_desde, moneda, duracion_dias, incluye, no_incluye,
                             imagen_url, activo)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12) RETURNING *`,
      [
        req.agencia.id, b.destino_id, b.tipo_viaje_id ?? null, b.titulo, b.descripcion,
        b.precio_desde ?? null, b.moneda, b.duracion_dias ?? null, JSON.stringify(b.incluye),
        JSON.stringify(b.no_incluye), b.imagen_url ?? null, b.activo,
      ],
    );
    res.status(201).json(rows[0]);
  }),
);

router.put(
  '/paquetes/:id',
  conAgencia,
  validar(z.object({ id: uuid }), 'params'),
  validar(paqueteSchema),
  ah(async (req, res) => {
    const b = req.body;
    await validarArchivoPropio(b.imagen_url, req.usuario.id);
    const { rows } = await query(
      `UPDATE paquetes SET destino_id = $3, tipo_viaje_id = $4, titulo = $5, descripcion = $6,
              precio_desde = $7, moneda = $8, duracion_dias = $9, incluye = $10,
              no_incluye = $11, imagen_url = $12, activo = $13
        WHERE id = $1 AND agencia_id = $2 RETURNING *`,
      [
        req.params.id, req.agencia.id, b.destino_id, b.tipo_viaje_id ?? null, b.titulo,
        b.descripcion, b.precio_desde ?? null, b.moneda, b.duracion_dias ?? null,
        JSON.stringify(b.incluye), JSON.stringify(b.no_incluye), b.imagen_url ?? null, b.activo,
      ],
    );
    if (!rows[0]) throw noEncontrado('Paquete');
    res.json(rows[0]);
  }),
);

router.delete(
  '/paquetes/:id',
  conAgencia,
  validar(z.object({ id: uuid }), 'params'),
  ah(async (req, res) => {
    const { rowCount } = await query('DELETE FROM paquetes WHERE id = $1 AND agencia_id = $2', [
      req.params.id,
      req.agencia.id,
    ]);
    if (!rowCount) throw noEncontrado('Paquete');
    res.status(204).end();
  }),
);

/* ───────────── Solicitudes recibidas ───────────── */

router.get(
  '/solicitudes',
  conAgencia,
  validar(
    z.object({ estado: z.enum(['nueva', 'vista', 'respondida', 'cerrada', 'cancelada']).optional() }),
    'query',
  ),
  ah(async (req, res) => {
    const { rows } = await query(
      `SELECT s.*, u.nombre AS viajero_nombre, u.email AS viajero_email,
              u.telefono AS viajero_telefono,
              d.nombre AS destino, t.nombre AS tipo_viaje, p.titulo AS paquete
         FROM solicitudes s
         JOIN usuarios u ON u.id = s.viajero_id
         LEFT JOIN destinos d ON d.id = s.destino_id
         LEFT JOIN tipos_viaje t ON t.id = s.tipo_viaje_id
         LEFT JOIN paquetes p ON p.id = s.paquete_id
        WHERE s.agencia_id = $1 AND ($2::estado_solicitud IS NULL OR s.estado = $2)
        ORDER BY (s.estado = 'nueva') DESC, s.created_at DESC
        LIMIT 200`,
      [req.agencia.id, req.consulta.estado ?? null],
    );
    res.json(rows);
  }),
);

router.patch(
  '/solicitudes/:id',
  conAgencia,
  validar(z.object({ id: uuid }), 'params'),
  validar(z.object({ estado: z.enum(['vista', 'respondida', 'cerrada']) })),
  ah(async (req, res) => {
    const { rows } = await query(
      `UPDATE solicitudes
          SET estado = $3::estado_solicitud,
              respondida_en = CASE WHEN $3::text = 'respondida' THEN COALESCE(respondida_en, now())
                                   ELSE respondida_en END
        WHERE id = $1 AND agencia_id = $2 AND estado <> 'cancelada'
        RETURNING *`,
      [req.params.id, req.agencia.id, req.body.estado],
    );
    if (!rows[0]) throw noEncontrado('Solicitud');
    res.json(rows[0]);
  }),
);

/* ───────────── Reseñas y respuestas ───────────── */

router.get(
  '/resenas',
  conAgencia,
  ah(async (req, res) => {
    const { rows } = await query(
      `SELECT r.id, r.calificacion_general, r.calificacion_precio, r.calificacion_atencion,
              r.calificacion_cumplimiento, r.titulo, r.comentario, r.created_at,
              split_part(u.nombre, ' ', 1) AS autor,
              rr.texto AS respuesta, rr.updated_at AS respuesta_fecha
         FROM resenas r
         JOIN usuarios u ON u.id = r.viajero_id
         LEFT JOIN respuestas_resena rr ON rr.resena_id = r.id
        WHERE r.agencia_id = $1 AND r.estado = 'publicada'
        ORDER BY (rr.id IS NULL) DESC, r.created_at DESC`,
      [req.agencia.id],
    );
    res.json(rows);
  }),
);

router.put(
  '/resenas/:id/respuesta',
  conAgencia,
  validar(z.object({ id: uuid }), 'params'),
  validar(z.object({ texto: textoCorto(2000) })),
  ah(async (req, res) => {
    const { rowCount } = await query(
      `SELECT 1 FROM resenas WHERE id = $1 AND agencia_id = $2 AND estado = 'publicada'`,
      [req.params.id, req.agencia.id],
    );
    if (!rowCount) throw noEncontrado('Reseña');
    const { rows } = await query(
      `INSERT INTO respuestas_resena (resena_id, agencia_id, texto) VALUES ($1, $2, $3)
       ON CONFLICT (resena_id) DO UPDATE SET texto = EXCLUDED.texto
       RETURNING *`,
      [req.params.id, req.agencia.id, req.body.texto],
    );
    res.json(rows[0]);
  }),
);

export default router;
