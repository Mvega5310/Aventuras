import multer from 'multer';
import { config } from '../config.js';
import { HttpError } from '../utils/http.js';

// Traduce errores de PostgreSQL a respuestas HTTP entendibles
const erroresPg = {
  23505: [409, 'Ya existe un registro con esos datos'],
  23503: [400, 'Hace referencia a un registro que no existe'],
  23514: [400, 'Algún valor no cumple las reglas permitidas'],
  23502: [400, 'Falta un dato obligatorio'],
  '22P02': [400, 'Formato de dato inválido'],
  P0001: [400, null], // RAISE EXCEPTION en triggers: se usa su propio mensaje
};

const unicos = {
  usuarios_email_key: 'Ya existe una cuenta con ese correo',
  agencias_nit_key: 'Ya hay una agencia registrada con ese NIT',
  agencias_rnt_key: 'Ya hay una agencia registrada con ese RNT',
  agencias_usuario_id_key: 'Tu cuenta ya tiene una agencia registrada',
  resenas_viaje_id_key: 'Ya dejaste una reseña para este viaje',
  viajes_verificados_solicitud_id_key: 'Esa solicitud ya tiene un comprobante registrado',
};

export function noEncontradaRuta(req, res) {
  res.status(404).json({ error: 'Ruta no encontrada' });
}

// eslint-disable-next-line no-unused-vars
export function manejarErrores(err, req, res, next) {
  if (err instanceof HttpError) {
    return res.status(err.status).json({ error: err.message, detalles: err.detalles });
  }

  if (err instanceof multer.MulterError) {
    const mensaje =
      err.code === 'LIMIT_FILE_SIZE'
        ? `El archivo supera ${config.maxUploadMb} MB`
        : 'No se pudo procesar el archivo';
    return res.status(400).json({ error: mensaje });
  }

  if (err.type === 'entity.parse.failed') {
    return res.status(400).json({ error: 'JSON inválido' });
  }

  if (err.code && erroresPg[err.code]) {
    const [status, mensaje] = erroresPg[err.code];
    return res.status(status).json({ error: unicos[err.constraint] || mensaje || err.message });
  }

  console.error(err);
  res.status(500).json({
    error: 'Ocurrió un error inesperado',
    ...(config.esProduccion ? {} : { detalle: err.message }),
  });
}
