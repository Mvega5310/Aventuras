import { solicitudInvalida } from '../utils/http.js';

/**
 * Valida req[origen] con un esquema zod y reemplaza el valor por el resultado limpio.
 * Uso: router.post('/', validar(esquema), handler)  ·  validar(esquema, 'query')
 */
export const validar = (esquema, origen = 'body') => (req, res, next) => {
  const resultado = esquema.safeParse(req[origen] ?? {});
  if (!resultado.success) {
    const detalles = resultado.error.issues.map((i) => ({
      campo: i.path.join('.'),
      mensaje: i.message,
    }));
    return next(solicitudInvalida('Revisa los datos enviados', detalles));
  }
  if (origen === 'query') {
    req.consulta = resultado.data; // req.query es de solo lectura en algunos entornos
  } else {
    req[origen] = resultado.data;
  }
  next();
};
