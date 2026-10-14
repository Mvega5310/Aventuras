import { Router } from 'express';
import bcrypt from 'bcryptjs';
import rateLimit from 'express-rate-limit';
import { z } from 'zod';
import { query } from '../db/pool.js';
import { autenticar, firmarToken } from '../middleware/auth.js';
import { validar } from '../middleware/validar.js';
import { ah, HttpError } from '../utils/http.js';
import { telefono, textoCorto } from '../utils/esquemas.js';

const router = Router();

// Hash de relleno para comparar cuando el correo no existe (mismo costo que uno real)
const HASH_FALSO = bcrypt.hashSync('contraseña-de-relleno', 12);

const limitador = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: process.env.NODE_ENV === 'test' ? 1000 : 20,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: { error: 'Demasiados intentos. Espera unos minutos e inténtalo de nuevo.' },
});

const registroSchema = z.object({
  nombre: textoCorto(120),
  email: z.string().trim().toLowerCase().email('Correo inválido').max(254),
  password: z
    .string()
    .min(8, 'La contraseña debe tener al menos 8 caracteres')
    .max(72, 'La contraseña es demasiado larga'),
  telefono,
  ciudad: z.string().trim().max(80).optional().nullable(),
  // El rol admin nunca se crea por registro público
  rol: z.enum(['viajero', 'agencia']).default('viajero'),
});

const loginSchema = z.object({
  email: z.string().trim().toLowerCase().email('Correo inválido'),
  password: z.string().min(1, 'Escribe tu contraseña'),
});

const publico = (u) => ({
  id: u.id,
  email: u.email,
  nombre: u.nombre,
  telefono: u.telefono,
  ciudad: u.ciudad,
  rol: u.rol,
});

router.post(
  '/registro',
  limitador,
  validar(registroSchema),
  ah(async (req, res) => {
    const { nombre, email, password, telefono: tel, ciudad, rol } = req.body;
    const hash = await bcrypt.hash(password, 12);
    const { rows } = await query(
      `INSERT INTO usuarios (email, password_hash, nombre, telefono, ciudad, rol)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING id, email, nombre, telefono, ciudad, rol`,
      [email, hash, nombre, tel ?? null, ciudad ?? null, rol],
    );
    const usuario = rows[0];
    res.status(201).json({ token: firmarToken(usuario), usuario: publico(usuario) });
  }),
);

router.post(
  '/login',
  limitador,
  validar(loginSchema),
  ah(async (req, res) => {
    const { email, password } = req.body;
    const { rows } = await query('SELECT * FROM usuarios WHERE email = $1', [email]);
    const usuario = rows[0];
    // Se compara siempre para no revelar por tiempo si el correo existe
    const ok = await bcrypt.compare(password, usuario?.password_hash || HASH_FALSO);
    if (!usuario || !ok) throw new HttpError(401, 'Correo o contraseña incorrectos');
    if (!usuario.activo) throw new HttpError(403, 'Tu cuenta está desactivada');

    await query('UPDATE usuarios SET ultimo_acceso = now() WHERE id = $1', [usuario.id]);
    res.json({ token: firmarToken(usuario), usuario: publico(usuario) });
  }),
);

router.get(
  '/yo',
  autenticar,
  ah(async (req, res) => {
    let agencia = null;
    if (req.usuario.rol === 'agencia') {
      const { rows } = await query(
        'SELECT id, slug, nombre_comercial, estado, verificada FROM agencias WHERE usuario_id = $1',
        [req.usuario.id],
      );
      agencia = rows[0] || null;
    }
    res.json({ usuario: publico(req.usuario), agencia });
  }),
);

const perfilSchema = z.object({
  nombre: textoCorto(120),
  telefono,
  ciudad: z.string().trim().max(80).optional().nullable(),
});

router.put(
  '/yo',
  autenticar,
  validar(perfilSchema),
  ah(async (req, res) => {
    const { nombre, telefono: tel, ciudad } = req.body;
    const { rows } = await query(
      `UPDATE usuarios SET nombre = $2, telefono = $3, ciudad = $4 WHERE id = $1
       RETURNING id, email, nombre, telefono, ciudad, rol`,
      [req.usuario.id, nombre, tel ?? null, ciudad ?? null],
    );
    res.json({ usuario: publico(rows[0]) });
  }),
);

export default router;
