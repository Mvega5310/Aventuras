import { useEffect, useId, useRef } from 'react';
import Icono, { Estrella } from './Icono.jsx';
import { urlPublica } from '../api.js';
import { calificacion, etiquetasEstado, iniciales } from '../util.js';

export function Cargando({ texto = 'Cargando…' }) {
  return (
    <div className="cargando" role="status">
      <div className="spinner" aria-hidden="true" />
      <span className="sr-only">{texto}</span>
    </div>
  );
}

export function Vacio({ titulo, children, accion }) {
  return (
    <div className="tarjeta vacio">
      <h2>{titulo}</h2>
      {children && <p style={{ margin: '0 0 16px' }}>{children}</p>}
      {accion}
    </div>
  );
}

export function Alerta({ tipo = 'error', children }) {
  if (!children) return null;
  return (
    <div className={`alerta alerta-${tipo}`} role={tipo === 'error' ? 'alert' : 'status'}>
      {children}
    </div>
  );
}

export function ErrorCarga({ error, reintentar }) {
  return (
    <Vacio
      titulo="No pudimos cargar esta información"
      accion={
        reintentar && (
          <button type="button" className="btn btn-borde" onClick={reintentar}>
            Reintentar
          </button>
        )
      }
    >
      {error?.message}
    </Vacio>
  );
}

export function Verificada({ texto = 'RNT verificado' }) {
  return (
    <span className="insignia insignia-verde">
      <Icono nombre="escudo" tamano={14} grosor={2.4} />
      {texto}
    </span>
  );
}

const coloresEstado = {
  nueva: 'ambar',
  pendiente: 'ambar',
  abierto: 'ambar',
  vista: 'teal',
  respondida: 'verde',
  aprobada: 'verde',
  activa: 'verde',
  publicada: 'verde',
  resuelto: 'verde',
  rechazada: 'roja',
  suspendida: 'roja',
  cancelada: 'gris',
  cerrada: 'gris',
  oculta: 'gris',
  descartado: 'gris',
};

export function Estado({ valor }) {
  return (
    <span className={`insignia insignia-${coloresEstado[valor] || 'gris'}`}>
      {etiquetasEstado[valor] || valor}
    </span>
  );
}

export function Calificacion({ valor, total, tamano = 16 }) {
  return (
    <span className="estrellas">
      <Estrella tamano={tamano} />
      <strong>{total ? calificacion(valor) : 'Nueva'}</strong>
      {total > 0 && (
        <span className="suave">
          ({total} {total === 1 ? 'reseña' : 'reseñas'})
        </span>
      )}
    </span>
  );
}

export function Logo({ url, nombre, grande = false }) {
  return (
    <div className={`logo${grande ? ' logo-grande' : ''}`}>
      {url ? <img src={urlPublica(url)} alt="" /> : iniciales(nombre)}
    </div>
  );
}

export function Campo({ etiqueta, error, ayuda, children, className = '', id: idDado }) {
  const idAuto = useId();
  const id = idDado || idAuto;
  // children es una función que recibe los atributos de accesibilidad del control
  const hijo = children({
    id,
    'aria-invalid': error ? 'true' : undefined,
    'aria-describedby': error ? `${id}-error` : ayuda ? `${id}-ayuda` : undefined,
  });
  return (
    <div className={`campo ${className}`}>
      <label htmlFor={id}>{etiqueta}</label>
      {hijo}
      {ayuda && !error && (
        <span className="ayuda" id={`${id}-ayuda`}>
          {ayuda}
        </span>
      )}
      {error && (
        <span className="error" id={`${id}-error`}>
          {error}
        </span>
      )}
    </div>
  );
}

/** Modal accesible con <dialog>. En móvil se muestra como hoja inferior. */
export function Modal({ abierto, alCerrar, titulo, children }) {
  const ref = useRef(null);
  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (abierto && !d.open) d.showModal();
    if (!abierto && d.open) d.close();
  }, [abierto]);

  return (
    <dialog
      ref={ref}
      className="modal"
      aria-labelledby="modal-titulo"
      onClose={alCerrar}
      onClick={(e) => {
        if (e.target === ref.current) alCerrar();
      }}
    >
      {abierto && (
        <>
          <div className="modal-cabecera">
            <h2 id="modal-titulo">{titulo}</h2>
            <button type="button" className="btn btn-fantasma btn-icono" onClick={alCerrar} aria-label="Cerrar">
              <Icono nombre="cerrar" />
            </button>
          </div>
          <div className="modal-cuerpo">{children}</div>
        </>
      )}
    </dialog>
  );
}

/**
 * Lista responsiva: tabla en PC y tarjetas en móvil.
 *  columnas: [{ titulo, celda: (fila) => JSX, alinear? }]
 *  tarjeta:  (fila) => JSX
 */
export function TablaTarjetas({ filas, columnas, tarjeta, clave = 'id', etiqueta }) {
  return (
    <>
      <div className="tabla-caja solo-pc">
        <div className="tabla-scroll">
          <table className="tabla" aria-label={etiqueta}>
            <thead>
              <tr>
                {columnas.map((c) => (
                  <th key={c.titulo} style={{ textAlign: c.alinear || 'left' }} scope="col">
                    {c.titulo}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filas.map((f) => (
                <tr key={f[clave]}>
                  {columnas.map((c) => (
                    <td key={c.titulo} style={{ textAlign: c.alinear || 'left' }}>
                      {c.celda(f)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      <div className="lista-tarjetas solo-movil" aria-label={etiqueta}>
        {filas.map((f) => (
          <article key={f[clave]} className="tarjeta pila-sm">
            {tarjeta(f)}
          </article>
        ))}
      </div>
    </>
  );
}

export function DatoFila({ etiqueta, children }) {
  return (
    <div className="dato-fila">
      <span>{etiqueta}</span>
      <strong>{children}</strong>
    </div>
  );
}

/** Selector de estrellas 1–5 accesible (radio group) */
export function EstrellasInput({ etiqueta, valor, onChange }) {
  const nombre = useId();
  return (
    <fieldset className="campo" style={{ border: 0, margin: 0, padding: 0 }}>
      <legend className="etiqueta" style={{ padding: 0, marginBottom: 6 }}>
        {etiqueta}
      </legend>
      <div className="estrellas-input" role="radiogroup">
        {[1, 2, 3, 4, 5].map((n) => (
          <button
            key={n}
            type="button"
            role="radio"
            aria-checked={valor === n}
            aria-label={`${n} de 5`}
            name={nombre}
            onClick={() => onChange(n)}
          >
            <Estrella tamano={28} llena={n <= valor} />
          </button>
        ))}
      </div>
    </fieldset>
  );
}
