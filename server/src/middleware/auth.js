import jwt from 'jsonwebtoken';
import { config } from '../config.js';
import { query } from '../db/pool.js';
import { HttpError, prohibido } from '../utils/http.js';

export function firmarToken(usuario) {
  return jwt.sign({ sub: usuario.id, rol: usuario.rol }, config.jwtSecret, {
    expiresIn: config.jwtExpira,
  });
}

async function cargarUsuario(req) {
  const cabecera = req.headers.authorization || '';
  const [tipo, token] = cabecera.split(' ');
  if (tipo !== 'Bearer' || !token) return null;

  let payload;
  try {
    payload = jwt.verify(token, config.jwtSecret);
  } catch {
    throw new HttpError(401, 'Sesión inválida o vencida. Ingresa de nuevo.');
  }

  const { rows } = await query(
    'SELECT id, email, nombre, telefono, ciudad, rol, activo FROM usuarios WHERE id = $1',
    [payload.sub],
  );
  const usuario = rows[0];
  if (!usuario || !usuario.activo) {
    throw new HttpError(401, 'Tu cuenta no está activa.');
  }
  return usuario;
}

/** Exige sesión. Deja el usuario en req.usuario. */
export async function autenticar(req, res, next) {
  try {
    const usuario = await cargarUsuario(req);
    if (!usuario) throw new HttpError(401, 'Debes iniciar sesión.');
    req.usuario = usuario;
    next();
  } catch (err) {
    next(err);
  }
}

/** Sesión opcional: si hay token válido, deja req.usuario; si no, sigue sin usuario. */
export async function autenticarOpcional(req, res, next) {
  try {
    req.usuario = await cargarUsuario(req);
    next();
  } catch {
    req.usuario = null;
    next();
  }
}

/** Exige uno de los roles dados (usar después de autenticar). */
export const exigirRol = (...roles) => (req, res, next) => {
  if (!req.usuario || !roles.includes(req.usuario.rol)) return next(prohibido());
  next();
};
