// Íconos de trazo simples (sin dependencias). Decorativos por defecto.
const trazos = {
  escudo: (
    <>
      <path d="M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6z" />
      <path d="M8.5 12l2.5 2.5 4.5-5" />
    </>
  ),
  buscar: (
    <>
      <circle cx="11" cy="11" r="7" />
      <path d="M20 20l-3.5-3.5" />
    </>
  ),
  inicio: <path d="M4 11l8-7 8 7v9H4z" />,
  corazon: <path d="M12 20s-7-4.6-7-10a4 4 0 017-2.6A4 4 0 0119 10c0 5.4-7 10-7 10z" />,
  usuario: (
    <>
      <circle cx="12" cy="8" r="4" />
      <path d="M4 21a8 8 0 0116 0" />
    </>
  ),
  maleta: (
    <>
      <rect x="3" y="7" width="18" height="13" rx="2" />
      <path d="M9 7V5a2 2 0 012-2h2a2 2 0 012 2v2" />
    </>
  ),
  sobre: (
    <>
      <rect x="3" y="5" width="18" height="14" rx="2" />
      <path d="M3 7l9 6 9-6" />
    </>
  ),
  paquete: (
    <>
      <path d="M4 8l8-4 8 4v8l-8 4-8-4z" />
      <path d="M4 8l8 4 8-4M12 12v8" />
    </>
  ),
  estrella: (
    <path d="M12 3l2.8 5.7 6.2.9-4.5 4.4 1 6.2L12 17.2 6.5 20.2l1-6.2L3 9.6l6.2-.9z" />
  ),
  documento: (
    <>
      <path d="M14 3H6a2 2 0 00-2 2v14a2 2 0 002 2h12a2 2 0 002-2V9z" />
      <path d="M14 3v6h6M8 13h8M8 17h5" />
    </>
  ),
  bandera: <path d="M5 21V4M5 4h11l-2 4 2 4H5" />,
  grafico: <path d="M4 20V10M10 20V4M16 20v-7M22 20H2" />,
  atras: <path d="M15 5l-7 7 7 7" />,
  cerrar: <path d="M6 6l12 12M18 6L6 18" />,
  filtros: (
    <>
      <path d="M4 7h10M18 7h2M4 17h2M10 17h10" />
      <circle cx="16" cy="7" r="2" />
      <circle cx="8" cy="17" r="2" />
    </>
  ),
  salir: <path d="M15 4h4v16h-4M10 17l5-5-5-5M15 12H3" />,
  mas: <path d="M12 5v14M5 12h14" />,
  editar: <path d="M4 20h4L19 9l-4-4L4 16zM14 6l4 4" />,
  basura: <path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13" />,
  whatsapp: (
    <path d="M4 20l1.3-4A8 8 0 1112 20a8 8 0 01-4-1.1zM9 9.5c0 3 2.5 5.5 5.5 5.5l1-1.5-2-1-1 1a4 4 0 01-2-2l1-1-1-2z" />
  ),
};

export default function Icono({ nombre, tamano = 20, color = 'currentColor', grosor = 2, etiqueta }) {
  return (
    <svg
      width={tamano}
      height={tamano}
      viewBox="0 0 24 24"
      fill="none"
      stroke={color}
      strokeWidth={grosor}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden={etiqueta ? undefined : 'true'}
      role={etiqueta ? 'img' : undefined}
      aria-label={etiqueta}
      focusable="false"
    >
      {trazos[nombre]}
    </svg>
  );
}

export function Estrella({ tamano = 16, llena = true }) {
  return (
    <svg width={tamano} height={tamano} viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <path
        d="M12 2l3.1 6.3 6.9 1-5 4.9 1.2 6.9L12 17.8 5.8 21.1 7 14.2 2 9.3l6.9-1z"
        fill={llena ? '#F2A900' : 'none'}
        stroke="#F2A900"
        strokeWidth={llena ? 0 : 1.6}
      />
    </svg>
  );
}
