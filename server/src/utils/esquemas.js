import { z } from 'zod';

export const uuid = z.string().uuid('Identificador inválido');
export const fecha = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Usa el formato AAAA-MM-DD');
export const textoCorto = (max = 120) => z.string().trim().min(1, 'Es obligatorio').max(max);
export const textoOpcional = (max = 2000) =>
  z
    .string()
    .trim()
    .max(max)
    .optional()
    .nullable()
    .transform((v) => (v ? v : null));
export const telefono = z
  .string()
  .trim()
  .regex(/^\+?[0-9 ()-]{7,20}$/, 'Teléfono inválido')
  .optional()
  .nullable()
  .or(z.literal('').transform(() => null));
export const url = z
  .string()
  .trim()
  .url('URL inválida')
  .max(500)
  .optional()
  .nullable()
  .or(z.literal('').transform(() => null));
// Ruta interna a un archivo subido (/api/archivos/<uuid>) o URL externa
export const urlArchivo = z
  .string()
  .trim()
  .max(500)
  .regex(/^(\/api\/archivos\/[0-9a-f-]{36}|https?:\/\/.+)$/i, 'Archivo inválido')
  .optional()
  .nullable()
  .or(z.literal('').transform(() => null));
export const calificacion = z.coerce.number().int().min(1).max(5);
export const dinero = z.coerce.number().min(0).max(1e12);

/** ¿La fecha AAAA-MM-DD es hoy o anterior? (hora de Colombia) */
export function noEsFutura(f) {
  const hoy = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Bogota' });
  return f <= hoy;
}
