import { useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Alerta,
  Calificacion,
  Campo,
  Cargando,
  DatoFila,
  ErrorCarga,
  EstrellasInput,
  Estado,
  Logo,
  Modal,
  TablaTarjetas,
  Vacio,
  Verificada,
} from '../components/ui.jsx';
import { api, subirArchivo } from '../api.js';
import { enlaceWhatsapp, fecha, precio, useDatos } from '../util.js';

const hoy = () => new Date().toLocaleDateString('en-CA', { timeZone: 'America/Bogota' });

function FormComprobante({ solicitud, alTerminar }) {
  const [archivo, setArchivo] = useState(null);
  const [fechaViaje, setFechaViaje] = useState(solicitud.fecha_salida && solicitud.fecha_salida <= hoy() ? solicitud.fecha_salida : '');
  const [estado, setEstado] = useState({ enviando: false, error: '' });

  const enviar = async (e) => {
    e.preventDefault();
    if (!archivo) return setEstado({ error: 'Adjunta la factura, voucher o contrato del viaje' });
    setEstado({ enviando: true, error: '' });
    try {
      const subido = await subirArchivo(archivo);
      await api.post('/viajes', {
        agencia_id: solicitud.agencia_id,
        solicitud_id: solicitud.id,
        comprobante_url: subido.url,
        fecha_viaje: fechaViaje,
      });
      alTerminar();
    } catch (err) {
      setEstado({ error: err.message });
    }
  };

  return (
    <form className="pila" onSubmit={enviar}>
      <p className="suave" style={{ margin: 0 }}>
        Sube la factura, voucher o contrato de tu viaje con <strong>{solicitud.agencia}</strong>. Solo nuestro equipo lo verá;
        cuando lo aprobemos podrás dejar tu reseña.
      </p>
      <Alerta>{estado.error}</Alerta>
      <Campo etiqueta="Fecha del viaje">
        {(p) => <input {...p} type="date" required max={hoy()} value={fechaViaje} onChange={(e) => setFechaViaje(e.target.value)} />}
      </Campo>
      <Campo etiqueta="Comprobante (PDF o imagen, máx. 5 MB)">
        {(p) => (
          <input {...p} type="file" required accept="application/pdf,image/jpeg,image/png,image/webp" onChange={(e) => setArchivo(e.target.files[0] || null)} />
        )}
      </Campo>
      <button type="submit" className="btn btn-primario" disabled={estado.enviando}>
        {estado.enviando ? 'Subiendo…' : 'Enviar comprobante'}
      </button>
    </form>
  );
}

function FormResena({ viaje, alTerminar }) {
  const [f, setF] = useState({
    calificacion_general: 0,
    calificacion_precio: 0,
    calificacion_atencion: 0,
    calificacion_cumplimiento: 0,
    titulo: '',
    comentario: '',
  });
  const [estado, setEstado] = useState({ enviando: false, error: '', errores: {} });
  const fijar = (c) => (v) => setF((x) => ({ ...x, [c]: v }));
  const completas = [f.calificacion_general, f.calificacion_precio, f.calificacion_atencion, f.calificacion_cumplimiento].every(Boolean);

  const enviar = async (e) => {
    e.preventDefault();
    if (!completas) return setEstado({ error: 'Califica los cuatro criterios', errores: {} });
    setEstado({ enviando: true, error: '', errores: {} });
    try {
      await api.post('/resenas', { viaje_id: viaje.viaje_id, ...f });
      alTerminar();
    } catch (err) {
      setEstado({ error: err.message, errores: err.porCampo || {} });
    }
  };

  return (
    <form className="pila" onSubmit={enviar} noValidate>
      <Alerta>{estado.error}</Alerta>
      <EstrellasInput etiqueta="Calificación general" valor={f.calificacion_general} onChange={fijar('calificacion_general')} />
      <EstrellasInput etiqueta="Precio" valor={f.calificacion_precio} onChange={fijar('calificacion_precio')} />
      <EstrellasInput etiqueta="Atención" valor={f.calificacion_atencion} onChange={fijar('calificacion_atencion')} />
      <EstrellasInput etiqueta="Cumplimiento" valor={f.calificacion_cumplimiento} onChange={fijar('calificacion_cumplimiento')} />
      <Campo etiqueta="Título (opcional)" error={estado.errores?.titulo}>
        {(p) => <input {...p} maxLength={120} value={f.titulo} onChange={(e) => setF({ ...f, titulo: e.target.value })} />}
      </Campo>
      <Campo etiqueta="Cuéntanos tu experiencia" error={estado.errores?.comentario} ayuda="Mínimo 20 caracteres">
        {(p) => (
          <textarea {...p} rows={5} maxLength={3000} value={f.comentario} onChange={(e) => setF({ ...f, comentario: e.target.value })} />
        )}
      </Campo>
      <p className="suave pequeno" style={{ margin: 0 }}>
        Tu reseña se publica después de una revisión rápida. Se mostrará tu nombre y la inicial de tu apellido.
      </p>
      <button type="submit" className="btn btn-primario" disabled={estado.enviando}>
        {estado.enviando ? 'Enviando…' : 'Publicar reseña'}
      </button>
    </form>
  );
}

function EstadoViaje({ s, alComprobante, alResena }) {
  if (s.resena_id) return <Estado valor={s.resena_estado === 'publicada' ? 'publicada' : 'pendiente'} />;
  if (s.viaje_estado === 'aprobada')
    return (
      <button type="button" className="btn btn-primario btn-sm" onClick={alResena}>
        Dejar reseña
      </button>
    );
  if (s.viaje_estado === 'pendiente') return <span className="insignia insignia-ambar">Comprobante en revisión</span>;
  if (s.viaje_estado === 'rechazada') return <span className="insignia insignia-roja">Comprobante rechazado</span>;
  if (s.estado === 'cancelada') return <span className="suave">—</span>;
  return (
    <button type="button" className="btn btn-borde btn-sm" onClick={alComprobante}>
      Ya viajé
    </button>
  );
}

export function MisViajes() {
  const { datos, error, cargando, recargar } = useDatos('/solicitudes');
  const [comprobante, setComprobante] = useState(null);
  const [resena, setResena] = useState(null);
  const [aviso, setAviso] = useState('');

  const cancelar = async (s) => {
    try {
      await api.post(`/solicitudes/${s.id}/cancelar`);
      recargar();
    } catch (err) {
      setAviso(err.message);
    }
  };

  const terminar = (mensaje) => () => {
    setComprobante(null);
    setResena(null);
    setAviso(mensaje);
    recargar();
  };

  return (
    <div className="contenedor pagina pila">
      <div>
        <h1 className="titulo-display" style={{ fontSize: 'clamp(24px, 4vw, 32px)' }}>
          Mis viajes y cotizaciones
        </h1>
        <p className="suave" style={{ margin: '6px 0 0' }}>
          Cuando viajes, sube tu comprobante para poder calificar a la agencia.
        </p>
      </div>
      <Alerta tipo="exito">{aviso}</Alerta>

      {cargando && !datos ? (
        <Cargando />
      ) : error ? (
        <ErrorCarga error={error} reintentar={recargar} />
      ) : datos.length === 0 ? (
        <Vacio titulo="Aún no has pedido cotizaciones" accion={<Link to="/agencias" className="btn btn-primario">Buscar agencias</Link>}>
          Encuentra una agencia verificada y pídele una cotización.
        </Vacio>
      ) : (
        <TablaTarjetas
          etiqueta="Mis solicitudes"
          filas={datos}
          columnas={[
            {
              titulo: 'Agencia',
              celda: (s) => (
                <Link to={`/agencias/${s.agencia_slug}`} style={{ fontWeight: 700 }}>
                  {s.agencia}
                </Link>
              ),
            },
            { titulo: 'Destino', celda: (s) => s.paquete || s.destino || 'A la medida' },
            {
              titulo: 'Fechas',
              celda: (s) => <span className="pequeno">{s.fecha_salida ? `${fecha(s.fecha_salida)} – ${fecha(s.fecha_regreso)}` : 'Flexibles'}</span>,
            },
            { titulo: 'Viajeros', celda: (s) => s.num_viajeros },
            { titulo: 'Estado', celda: (s) => <Estado valor={s.estado} /> },
            {
              titulo: 'Viaje',
              celda: (s) => <EstadoViaje s={s} alComprobante={() => setComprobante(s)} alResena={() => setResena(s)} />,
            },
            {
              titulo: '',
              alinear: 'right',
              celda: (s) => (
                <div className="acciones">
                  {s.agencia_whatsapp && (
                    <a className="btn btn-whatsapp btn-sm" href={enlaceWhatsapp(s.agencia_whatsapp)} target="_blank" rel="noopener noreferrer">
                      WhatsApp
                    </a>
                  )}
                  {['nueva', 'vista'].includes(s.estado) && (
                    <button type="button" className="btn btn-fantasma btn-sm" onClick={() => cancelar(s)}>
                      Cancelar
                    </button>
                  )}
                </div>
              ),
            },
          ]}
          tarjeta={(s) => (
            <>
              <div className="fila-entre">
                <Link to={`/agencias/${s.agencia_slug}`} style={{ fontWeight: 700, fontSize: 16, color: 'var(--texto)' }}>
                  {s.agencia}
                </Link>
                <Estado valor={s.estado} />
              </div>
              <DatoFila etiqueta="Destino">{s.paquete || s.destino || 'A la medida'}</DatoFila>
              <DatoFila etiqueta="Fechas">{s.fecha_salida ? `${fecha(s.fecha_salida)} – ${fecha(s.fecha_regreso)}` : 'Flexibles'}</DatoFila>
              <DatoFila etiqueta="Viajeros">{s.num_viajeros}</DatoFila>
              {s.presupuesto_max && <DatoFila etiqueta="Presupuesto">{precio(s.presupuesto_max)}</DatoFila>}
              <div className="fila" style={{ flexWrap: 'nowrap' }}>
                {s.agencia_whatsapp && (
                  <a className="btn btn-whatsapp" style={{ flex: 1 }} href={enlaceWhatsapp(s.agencia_whatsapp)} target="_blank" rel="noopener noreferrer">
                    WhatsApp
                  </a>
                )}
                <div style={{ flex: 1, display: 'flex', justifyContent: 'center' }}>
                  <EstadoViaje s={s} alComprobante={() => setComprobante(s)} alResena={() => setResena(s)} />
                </div>
              </div>
              {['nueva', 'vista'].includes(s.estado) && (
                <button type="button" className="btn btn-fantasma btn-sm" onClick={() => cancelar(s)}>
                  Cancelar solicitud
                </button>
              )}
            </>
          )}
        />
      )}

      <Modal abierto={Boolean(comprobante)} alCerrar={() => setComprobante(null)} titulo="Registrar mi viaje">
        {comprobante && <FormComprobante solicitud={comprobante} alTerminar={terminar('Recibimos tu comprobante. Te avisaremos cuando puedas reseñar.')} />}
      </Modal>
      <Modal abierto={Boolean(resena)} alCerrar={() => setResena(null)} titulo={resena ? `Califica a ${resena.agencia}` : ''}>
        {resena && <FormResena viaje={resena} alTerminar={terminar('¡Gracias! Tu reseña se publicará tras una revisión rápida.')} />}
      </Modal>
    </div>
  );
}

export function Favoritos() {
  const { datos, error, cargando, recargar } = useDatos('/favoritos');

  const quitar = async (id) => {
    await api.delete(`/favoritos/${id}`).catch(() => {});
    recargar();
  };

  return (
    <div className="contenedor pagina pila">
      <h1 className="titulo-display" style={{ fontSize: 'clamp(24px, 4vw, 32px)' }}>
        Agencias guardadas
      </h1>
      {cargando && !datos ? (
        <Cargando />
      ) : error ? (
        <ErrorCarga error={error} reintentar={recargar} />
      ) : datos.length === 0 ? (
        <Vacio titulo="Aún no guardas agencias" accion={<Link to="/agencias" className="btn btn-primario">Explorar agencias</Link>}>
          Toca el corazón en el perfil de una agencia para guardarla aquí.
        </Vacio>
      ) : (
        <div className="rejilla">
          {datos.map((a) => (
            <article key={a.id} className="tarjeta pila-sm">
              <div className="fila" style={{ flexWrap: 'nowrap' }}>
                <Logo url={a.logo_url} nombre={a.nombre_comercial} />
                <div style={{ minWidth: 0 }}>
                  <Link to={`/agencias/${a.slug}`} style={{ fontWeight: 700, color: 'var(--texto)' }}>
                    {a.nombre_comercial}
                  </Link>
                  <div className="suave">{a.ciudad}</div>
                </div>
              </div>
              <div className="fila">
                <Calificacion valor={a.calificacion_promedio} total={a.total_resenas} />
                <Verificada />
              </div>
              <div className="fila" style={{ flexWrap: 'nowrap' }}>
                <Link to={`/agencias/${a.slug}`} className="btn btn-borde" style={{ flex: 1 }}>
                  Ver perfil
                </Link>
                <button type="button" className="btn btn-fantasma" onClick={() => quitar(a.id)}>
                  Quitar
                </button>
              </div>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
