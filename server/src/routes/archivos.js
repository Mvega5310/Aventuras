import { Router } from 'express';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import multer from 'multer';
import { config } from '../config.js';
import { query } from '../db/pool.js';
import { autenticar, autenticarOpcional } from '../middleware/auth.js';
import { ah, noEncontrado, solicitudInvalida } from '../utils/http.js';

const router = Router();

fs.mkdirSync(config.uploadDir, { recursive: true });

const tiposPermitidos = {
  'application/pdf': '.pdf',
  'image/jpeg': '.jpg',
  'image/png': '.png',
  'image/webp': '.webp',
};

const subir = multer({
  storage: multer.diskStorage({
    destination: config.uploadDir,
    // Nombre aleatorio: nunca se usa el nombre que envía el cliente para la ruta en disco
    filename: (req, file, cb) =>
      cb(null, `${crypto.randomUUID()}${tiposPermitidos[file.mimetype] || ''}`),
  }),
  limits: { fileSize: config.maxUploadMb * 1024 * 1024, files: 1 },
  fileFilter: (req, file, cb) => {
    if (tiposPermitidos[file.mimetype]) return cb(null, true);
    cb(solicitudInvalida('Solo se permiten archivos PDF, JPG, PNG o WEBP'));
  },
});

/** POST /api/archivos  (multipart: archivo, publico=true|false) */
router.post(
  '/',
  autenticar,
  subir.single('archivo'),
  ah(async (req, res) => {
    if (!req.file) throw solicitudInvalida('Adjunta un archivo en el campo "archivo"');
    // Solo imágenes pueden ser públicas (logos y portadas)
    const publico = req.body.publico === 'true' && req.file.mimetype.startsWith('image/');
    const { rows } = await query(
      `INSERT INTO archivos (usuario_id, nombre, mime, tamano, ruta, publico)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING id, nombre, mime, tamano, publico`,
      [
        req.usuario.id,
        req.file.originalname.slice(0, 200),
        req.file.mimetype,
        req.file.size,
        req.file.filename,
        publico,
      ],
    );
    const archivo = rows[0];
    res.status(201).json({ ...archivo, url: `/api/archivos/${archivo.id}` });
  }),
);

/** GET /api/archivos/:id — públicos para todos; privados para el dueño, la agencia relacionada o un admin. */
router.get(
  '/:id',
  autenticarOpcional,
  ah(async (req, res) => {
    if (!/^[0-9a-f-]{36}$/i.test(req.params.id)) throw noEncontrado('Archivo');
    const { rows } = await query('SELECT * FROM archivos WHERE id = $1', [req.params.id]);
    const archivo = rows[0];
    if (!archivo) throw noEncontrado('Archivo');

    const u = req.usuario;
    const permitido =
      archivo.publico || (u && (u.rol === 'admin' || u.id === archivo.usuario_id));
    // Se responde 404 y no 403 para no confirmar que el archivo existe
    if (!permitido) throw noEncontrado('Archivo');

    const ruta = path.join(config.uploadDir, path.basename(archivo.ruta));
    if (!fs.existsSync(ruta)) throw noEncontrado('Archivo');

    res.setHeader('Content-Type', archivo.mime);
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader(
      'Content-Disposition',
      `inline; filename*=UTF-8''${encodeURIComponent(archivo.nombre)}`,
    );
    res.setHeader('Cache-Control', archivo.publico ? 'public, max-age=86400' : 'private, no-store');
    fs.createReadStream(ruta).pipe(res);
  }),
);

export default router;

/** Verifica que una URL /api/archivos/<id> pertenezca al usuario. Devuelve la URL o lanza error. */
export async function validarArchivoPropio(urlArchivo, usuarioId) {
  if (!urlArchivo) return null;
  const m = /^\/api\/archivos\/([0-9a-f-]{36})$/i.exec(urlArchivo);
  if (!m) return urlArchivo; // URL externa
  const { rowCount } = await query('SELECT 1 FROM archivos WHERE id = $1 AND usuario_id = $2', [
    m[1],
    usuarioId,
  ]);
  if (!rowCount) throw solicitudInvalida('El archivo adjunto no es válido');
  return urlArchivo;
}
