import { useCallback, useEffect, useState } from 'react';
import { api } from './api.js';

const formatoCop = new Intl.NumberFormat('es-CO', {
  style: 'currency',
  currency: 'COP',
  maximumFractionDigits: 0,
});

export function precio(valor, moneda = 'COP') {
  if (valor === null || valor === undefined) return 'A consultar';
  if (moneda === 'COP') return formatoCop.format(valor);
  return new Intl.NumberFormat('es-CO', { style: 'currency', currency: moneda }).format(valor);
}

export function fecha(valor, opciones = { day: 'numeric', month: 'short', year: 'numeric' }) {
  if (!valor) return '—';
  // Fechas 'AAAA-MM-DD' se interpretan como locales para no correr un día
  const d = /^\d{4}-\d{2}-\d{2}$/.test(valor) ? new Date(`${valor}T12:00:00`) : new Date(valor);
  return d.toLocaleDateString('es-CO', opciones);
}

export const calificacion = (n) =>
  Number(n || 0).toLocaleString('es-CO', { minimumFractionDigits: 1, maximumFractionDigits: 1 });

export const iniciales = (nombre = '') =>
  nombre
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0].toUpperCase())
    .join('');

/** Enlace de WhatsApp a partir de un número colombiano o internacional */
export function enlaceWhatsapp(numero, mensaje = '') {
  if (!numero) return null;
  let digitos = numero.replace(/\D/g, '');
  if (digitos.length === 10 && digitos.startsWith('3')) digitos = `57${digitos}`;
  return `https://wa.me/${digitos}${mensaje ? `?text=${encodeURIComponent(mensaje)}` : ''}`;
}

export const etiquetasEstado = {
  nueva: 'Nueva',
  vista: 'Vista',
  respondida: 'Respondida',
  cerrada: 'Cerrada',
  cancelada: 'Cancelada',
  pendiente: 'Pendiente',
  aprobada: 'Aprobada',
  rechazada: 'Rechazada',
  activa: 'Activa',
  suspendida: 'Suspendida',
  publicada: 'Publicada',
  oculta: 'Oculta',
  abierto: 'Abierto',
  resuelto: 'Resuelto',
  descartado: 'Descartado',
};

export const etiquetasDocumento = {
  rnt: 'Registro Nacional de Turismo (RNT)',
  camara_comercio: 'Cámara de Comercio',
  rut: 'RUT',
  identidad_representante: 'Cédula del representante legal',
};

/** Carga datos de la API con estado de carga y error. */
export function useDatos(ruta, dependencias = []) {
  const [datos, setDatos] = useState(null);
  const [error, setError] = useState(null);
  const [cargando, setCargando] = useState(true);

  const recargar = useCallback(async () => {
    if (!ruta) return;
    setCargando(true);
    setError(null);
    try {
      setDatos(await api.get(ruta));
    } catch (e) {
      setError(e);
    } finally {
      setCargando(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ruta, ...dependencias]);

  useEffect(() => {
    recargar();
  }, [recargar]);

  return { datos, error, cargando, recargar, setDatos };
}

/** Catálogos (tipos de viaje y destinos), cacheados en memoria */
let cacheCatalogos = null;
export function useCatalogos() {
  const [catalogos, setCatalogos] = useState(cacheCatalogos || { tipos: [], destinos: [] });
  useEffect(() => {
    if (cacheCatalogos) return;
    Promise.all([api.get('/catalogos/tipos-viaje'), api.get('/catalogos/destinos')])
      .then(([tipos, destinos]) => {
        cacheCatalogos = { tipos, destinos };
        setCatalogos(cacheCatalogos);
      })
      .catch(() => {});
  }, []);
  return catalogos;
}
