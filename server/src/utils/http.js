export class HttpError extends Error {
  constructor(status, mensaje, detalles) {
    super(mensaje);
    this.status = status;
    this.detalles = detalles;
  }
}

export const noEncontrado = (que = 'Recurso') => new HttpError(404, `${que} no encontrado`);
export const prohibido = (mensaje = 'No tienes permiso para esta acción') => new HttpError(403, mensaje);
export const solicitudInvalida = (mensaje, detalles) => new HttpError(400, mensaje, detalles);

/** Envuelve un handler async para que los errores lleguen al middleware de errores. */
export const ah = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

/** Lee page/limit del query string con límites seguros. */
export function paginacion(q, { limitePorDefecto = 20, limiteMaximo = 50 } = {}) {
  const page = Math.max(1, Number.parseInt(q.page, 10) || 1);
  const limit = Math.min(limiteMaximo, Math.max(1, Number.parseInt(q.limit, 10) || limitePorDefecto));
  return { page, limit, offset: (page - 1) * limit };
}
