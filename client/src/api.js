const BASE = import.meta.env.VITE_API_URL || '';
const CLAVE_TOKEN = 'rumbo_token';

export const token = {
  leer: () => {
    try {
      return localStorage.getItem(CLAVE_TOKEN);
    } catch {
      return null;
    }
  },
  guardar: (t) => {
    try {
      localStorage.setItem(CLAVE_TOKEN, t);
    } catch {
      /* almacenamiento no disponible */
    }
  },
  borrar: () => {
    try {
      localStorage.removeItem(CLAVE_TOKEN);
    } catch {
      /* almacenamiento no disponible */
    }
  },
};

export class ApiError extends Error {
  constructor(status, cuerpo) {
    super(cuerpo?.error || 'No se pudo completar la acción');
    this.status = status;
    this.detalles = cuerpo?.detalles || [];
  }
  /** Mensajes por campo: { email: 'Correo inválido' } */
  get porCampo() {
    return Object.fromEntries(this.detalles.map((d) => [d.campo, d.mensaje]));
  }
}

// Avisa a la app cuando la sesión vence para cerrar sesión de forma global
export const eventos = new EventTarget();

async function solicitar(metodo, ruta, cuerpo, opciones = {}) {
  const cabeceras = { ...(opciones.cabeceras || {}) };
  const t = token.leer();
  if (t) cabeceras.Authorization = `Bearer ${t}`;
  const esForm = cuerpo instanceof FormData;
  if (cuerpo !== undefined && !esForm) cabeceras['Content-Type'] = 'application/json';

  let res;
  try {
    res = await fetch(`${BASE}/api${ruta}`, {
      method: metodo,
      headers: cabeceras,
      body: cuerpo === undefined ? undefined : esForm ? cuerpo : JSON.stringify(cuerpo),
    });
  } catch {
    throw new ApiError(0, { error: 'Sin conexión con el servidor. Revisa tu internet.' });
  }

  if (res.status === 401 && t) eventos.dispatchEvent(new Event('sesion-vencida'));
  if (res.status === 204) return null;

  const datos = await res.json().catch(() => null);
  if (!res.ok) throw new ApiError(res.status, datos);
  return datos;
}

export const api = {
  get: (ruta) => solicitar('GET', ruta),
  post: (ruta, cuerpo = {}) => solicitar('POST', ruta, cuerpo),
  put: (ruta, cuerpo = {}) => solicitar('PUT', ruta, cuerpo),
  patch: (ruta, cuerpo = {}) => solicitar('PATCH', ruta, cuerpo),
  delete: (ruta) => solicitar('DELETE', ruta),
};

/** Sube un archivo y devuelve { id, url, nombre, ... } */
export function subirArchivo(archivo, { publico = false } = {}) {
  const form = new FormData();
  form.append('archivo', archivo);
  form.append('publico', String(publico));
  return solicitar('POST', '/archivos', form);
}

/** Abre un archivo privado en otra pestaña (con la sesión del usuario). */
export async function abrirArchivo(url) {
  if (/^https?:\/\//.test(url)) {
    window.open(url, '_blank', 'noopener');
    return;
  }
  const ventana = window.open('', '_blank');
  const t = token.leer();
  const res = await fetch(`${BASE}${url}`, { headers: t ? { Authorization: `Bearer ${t}` } : {} });
  if (!res.ok) {
    ventana?.close();
    throw new ApiError(res.status, { error: 'No se pudo abrir el archivo' });
  }
  const blob = await res.blob();
  const enlace = URL.createObjectURL(blob);
  if (ventana) ventana.location.href = enlace;
  else window.open(enlace, '_blank');
  setTimeout(() => URL.revokeObjectURL(enlace), 60_000);
}

/** URL utilizable en <img> para archivos públicos o externos */
export const urlPublica = (url) => (url && url.startsWith('/api/') ? `${BASE}${url}` : url);
