import { useState } from 'react';
import { Alerta, Cargando, DatoFila, ErrorCarga, Estado, Modal, TablaTarjetas, Vacio } from '../../components/ui.jsx';
import { api } from '../../api.js';
import { enlaceWhatsapp, fecha, precio, useDatos } from '../../util.js';

const filtros = [
  ['', 'Todas'],
  ['nueva', 'Nuevas'],
  ['respondida', 'Respondidas'],
  ['cerrada', 'Cerradas'],
];

const rangoFechas = (s) => (s.fecha_salida ? `${fecha(s.fecha_salida)} – ${fecha(s.fecha_regreso)}` : 'Flexibles');
const presupuesto = (s) => (s.presupuesto_max ? `Hasta ${precio(s.presupuesto_max)}` : '—');

export default function SolicitudesAgencia() {
  const [estado, setEstado] = useState('');
  const { datos, error, cargando, recargar } = useDatos(`/mi-agencia/solicitudes${estado ? `?estado=${estado}` : ''}`);
  const [detalle, setDetalle] = useState(null);
  const [aviso, setAviso] = useState('');

  const cambiarEstado = async (s, nuevo) => {
    try {
      await api.patch(`/mi-agencia/solicitudes/${s.id}`, { estado: nuevo });
      recargar();
    } catch (err) {
      setAviso(err.message);
    }
  };

  const abrir = (s) => {
    setDetalle(s);
    if (s.estado === 'nueva') cambiarEstado(s, 'vista');
  };

  const mensajeWa = (s) =>
    `Hola ${s.viajero_nombre.split(' ')[0]}, te escribimos por tu solicitud en Rumbo Seguro${s.destino ? ` para ${s.destino}` : ''}.`;

  const acciones = (s, movil = false) => (
    <>
      {s.viajero_telefono && (
        <a
          className={`btn btn-whatsapp ${movil ? '' : 'btn-sm'}`}
          style={movil ? { flex: 1 } : undefined}
          href={enlaceWhatsapp(s.viajero_telefono, mensajeWa(s))}
          target="_blank"
          rel="noopener noreferrer"
          onClick={() => s.estado !== 'respondida' && cambiarEstado(s, 'respondida')}
        >
          WhatsApp
        </a>
      )}
      <button type="button" className={`btn btn-borde ${movil ? '' : 'btn-sm'}`} style={movil ? { flex: 1 } : undefined} onClick={() => abrir(s)}>
        Ver detalle
      </button>
    </>
  );

  return (
    <div className="pila">
      <h1 className="panel-titulo">Solicitudes de cotización</h1>
      <div className="chips" role="group" aria-label="Filtrar por estado">
        {filtros.map(([v, t]) => (
          <button key={t} type="button" className="chip" aria-pressed={estado === v} onClick={() => setEstado(v)}>
            {t}
          </button>
        ))}
      </div>
      <Alerta>{aviso}</Alerta>

      {cargando && !datos ? (
        <Cargando />
      ) : error ? (
        <ErrorCarga error={error} reintentar={recargar} />
      ) : datos.length === 0 ? (
        <Vacio titulo="No hay solicitudes aquí">Cuando un viajero te pida una cotización aparecerá en esta lista.</Vacio>
      ) : (
        <TablaTarjetas
          etiqueta="Solicitudes"
          filas={datos}
          columnas={[
            {
              titulo: 'Viajero',
              celda: (s) => (
                <div>
                  <strong>{s.viajero_nombre}</strong>
                  <div className="suave pequeno">Recibida {fecha(s.created_at)}</div>
                </div>
              ),
            },
            { titulo: 'Destino', celda: (s) => s.paquete || s.destino || 'A la medida' },
            { titulo: 'Fechas', celda: (s) => <span className="pequeno">{rangoFechas(s)}</span> },
            { titulo: 'Viajeros', celda: (s) => s.num_viajeros },
            { titulo: 'Presupuesto', celda: presupuesto },
            { titulo: 'Estado', celda: (s) => <Estado valor={s.estado} /> },
            { titulo: 'Acción', alinear: 'right', celda: (s) => <div className="acciones">{acciones(s)}</div> },
          ]}
          tarjeta={(s) => (
            <>
              <div className="fila-entre">
                <strong style={{ fontSize: 16 }}>{s.viajero_nombre}</strong>
                <Estado valor={s.estado} />
              </div>
              <DatoFila etiqueta="Destino">{s.paquete || s.destino || 'A la medida'}</DatoFila>
              <DatoFila etiqueta="Fechas">{rangoFechas(s)}</DatoFila>
              <DatoFila etiqueta="Viajeros">{s.num_viajeros}</DatoFila>
              <DatoFila etiqueta="Presupuesto">{presupuesto(s)}</DatoFila>
              <div className="fila" style={{ flexWrap: 'nowrap' }}>
                {acciones(s, true)}
              </div>
            </>
          )}
        />
      )}

      <Modal abierto={Boolean(detalle)} alCerrar={() => setDetalle(null)} titulo="Detalle de la solicitud">
        {detalle && (
          <div className="pila">
            <div className="pila-sm">
              <DatoFila etiqueta="Viajero">{detalle.viajero_nombre}</DatoFila>
              <DatoFila etiqueta="Correo">
                <a href={`mailto:${detalle.viajero_email}`}>{detalle.viajero_email}</a>
              </DatoFila>
              {detalle.viajero_telefono && <DatoFila etiqueta="Celular">{detalle.viajero_telefono}</DatoFila>}
              <DatoFila etiqueta="Destino">{detalle.paquete || detalle.destino || 'A la medida'}</DatoFila>
              <DatoFila etiqueta="Fechas">{rangoFechas(detalle)}</DatoFila>
              <DatoFila etiqueta="Viajeros">{detalle.num_viajeros}</DatoFila>
              <DatoFila etiqueta="Presupuesto">{presupuesto(detalle)}</DatoFila>
            </div>
            {detalle.mensaje && (
              <div style={{ background: 'var(--fondo)', borderRadius: 10, padding: 14, whiteSpace: 'pre-line' }}>{detalle.mensaje}</div>
            )}
            <div className="fila">
              {detalle.viajero_telefono && (
                <a
                  className="btn btn-whatsapp"
                  href={enlaceWhatsapp(detalle.viajero_telefono, mensajeWa(detalle))}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={() => cambiarEstado(detalle, 'respondida')}
                >
                  Responder por WhatsApp
                </a>
              )}
              <a className="btn btn-borde" href={`mailto:${detalle.viajero_email}`} onClick={() => cambiarEstado(detalle, 'respondida')}>
                Responder por correo
              </a>
              {detalle.estado !== 'cerrada' && detalle.estado !== 'cancelada' && (
                <button
                  type="button"
                  className="btn btn-fantasma"
                  onClick={() => {
                    cambiarEstado(detalle, 'cerrada');
                    setDetalle(null);
                  }}
                >
                  Marcar como cerrada
                </button>
              )}
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
