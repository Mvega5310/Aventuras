import { useState } from 'react';
import { Link, Route, Routes } from 'react-router-dom';
import Panel, { Kpi } from '../../components/Panel.jsx';
import {
  Alerta,
  Calificacion,
  Campo,
  Cargando,
  DatoFila,
  ErrorCarga,
  Estado,
  Modal,
  TablaTarjetas,
  Vacio,
} from '../../components/ui.jsx';
import { abrirArchivo, api } from '../../api.js';
import { etiquetasDocumento, etiquetasEstado, fecha, useDatos } from '../../util.js';

/** Ejecuta una acción de admin y recarga; devuelve [ejecutar, error] */
function useAccion(recargar) {
  const [error, setError] = useState('');
  const ejecutar = async (ruta, cuerpo = {}) => {
    setError('');
    try {
      await api.post(ruta, cuerpo);
      await recargar();
      return true;
    } catch (err) {
      setError(err.message);
      return false;
    }
  };
  return [ejecutar, error];
}

const verArchivo = (url) => abrirArchivo(url).catch((e) => window.alert(e.message));

function FiltroEstado({ opciones, valor, onChange }) {
  return (
    <div className="chips" role="group" aria-label="Filtrar por estado">
      {opciones.map((o) => (
        <button key={o} type="button" className="chip" aria-pressed={valor === o} onClick={() => onChange(o)}>
          {etiquetasEstado[o]}
        </button>
      ))}
    </div>
  );
}

/* ───────────── Resumen ───────────── */

function Resumen() {
  const { datos: r, error, cargando, recargar } = useDatos('/admin/resumen');
  if (cargando && !r) return <Cargando />;
  if (error) return <ErrorCarga error={error} reintentar={recargar} />;
  return (
    <div className="pila" style={{ gap: 24 }}>
      <h1 className="panel-titulo">Administración</h1>
      <div className="kpis">
        <Kpi titulo="Agencias por verificar" valor={r.agencias_pendientes} nota={`${r.documentos_pendientes} documentos por revisar`} />
        <Kpi titulo="Comprobantes de viaje" valor={r.comprobantes_pendientes} />
        <Kpi titulo="Reseñas por moderar" valor={r.resenas_pendientes} />
        <Kpi titulo="Reportes abiertos" valor={r.reportes_abiertos} />
      </div>
      <div className="kpis">
        <Kpi titulo="Agencias activas" valor={r.agencias_activas} />
        <Kpi titulo="Viajeros registrados" valor={r.viajeros} />
        <Kpi titulo="RNT por vencer (30 días)" valor={r.rnt_por_vencer} />
      </div>
      <div className="rejilla">
        <Link to="/admin/agencias" className="tarjeta tarjeta-enlace">
          <h2>Verificar agencias</h2>
          <span className="suave">Revisa RNT y documentos antes de publicarlas.</span>
        </Link>
        <Link to="/admin/comprobantes" className="tarjeta tarjeta-enlace">
          <h2>Revisar comprobantes</h2>
          <span className="suave">Habilitan al viajero para dejar su reseña.</span>
        </Link>
      </div>
    </div>
  );
}

/* ───────────── Agencias ───────────── */

function DetalleAgencia({ agencia, ejecutar, error, alCerrar }) {
  const [notas, setNotas] = useState(agencia.notas_revision || '');
  const [plan, setPlan] = useState({ plan: agencia.plan, vence_en: '', monto: '' });
  const rntAprobado = agencia.verificaciones.some((v) => v.tipo === 'rnt' && v.estado === 'aprobada');

  const decidir = async (accion) => {
    if (await ejecutar(`/admin/agencias/${agencia.id}/${accion}`, { notas })) alCerrar();
  };

  return (
    <div className="pila">
      <Alerta>{error}</Alerta>
      <div className="pila-sm">
        <DatoFila etiqueta="Razón social">{agencia.razon_social}</DatoFila>
        <DatoFila etiqueta="NIT">{agencia.nit}</DatoFila>
        <DatoFila etiqueta="RNT">{agencia.rnt}</DatoFila>
        <DatoFila etiqueta="RNT vigente hasta">{fecha(agencia.rnt_vigente_hasta)}</DatoFila>
        <DatoFila etiqueta="Ubicación">
          {agencia.ciudad}, {agencia.departamento}
        </DatoFila>
        <DatoFila etiqueta="Cuenta">
          {agencia.cuenta_nombre} · {agencia.cuenta_email}
        </DatoFila>
        <DatoFila etiqueta="Estado">
          <Estado valor={agencia.estado} />
        </DatoFila>
      </div>
      <Alerta tipo="info">
        Confirma el número de RNT en la consulta pública del Registro Nacional de Turismo antes de aprobar.
      </Alerta>

      <h3>Documentos</h3>
      {agencia.verificaciones.length === 0 ? (
        <p className="suave" style={{ margin: 0 }}>
          La agencia aún no ha subido documentos.
        </p>
      ) : (
        agencia.verificaciones.map((v) => (
          <div key={v.id} className="pila-sm" style={{ border: '1px solid var(--linea)', borderRadius: 12, padding: 12 }}>
            <div className="fila-entre">
              <strong>{etiquetasDocumento[v.tipo]}</strong>
              <Estado valor={v.estado} />
            </div>
            <div className="fila">
              {v.documento_url && (
                <button type="button" className="btn btn-borde btn-sm" onClick={() => verArchivo(v.documento_url)}>
                  Ver documento
                </button>
              )}
              {v.estado === 'pendiente' && (
                <>
                  <button type="button" className="btn btn-whatsapp btn-sm" onClick={() => ejecutar(`/admin/verificaciones/${v.id}/aprobar`)}>
                    Aprobar
                  </button>
                  <button type="button" className="btn btn-peligro btn-sm" onClick={() => ejecutar(`/admin/verificaciones/${v.id}/rechazar`, { notas })}>
                    Rechazar
                  </button>
                </>
              )}
            </div>
          </div>
        ))
      )}

      <Campo etiqueta="Notas para la agencia" ayuda="Se muestran a la agencia si rechazas o suspendes">
        {(p) => <textarea {...p} rows={2} maxLength={1000} value={notas} onChange={(e) => setNotas(e.target.value)} />}
      </Campo>
      <div className="fila">
        {agencia.estado !== 'activa' && (
          <button type="button" className="btn btn-whatsapp" disabled={!rntAprobado} onClick={() => decidir('aprobar')}>
            Aprobar y publicar
          </button>
        )}
        {agencia.estado === 'pendiente' && (
          <button type="button" className="btn btn-peligro" onClick={() => decidir('rechazar')}>
            Rechazar
          </button>
        )}
        {agencia.estado === 'activa' && (
          <button type="button" className="btn btn-peligro" onClick={() => decidir('suspender')}>
            Suspender
          </button>
        )}
      </div>
      {!rntAprobado && agencia.estado !== 'activa' && (
        <p className="suave pequeno" style={{ margin: 0 }}>
          Para publicarla primero aprueba su documento de RNT.
        </p>
      )}

      {agencia.estado === 'activa' && (
        <form
          className="pila-sm"
          onSubmit={async (e) => {
            e.preventDefault();
            try {
              await api.put(`/admin/agencias/${agencia.id}/plan`, {
                plan: plan.plan,
                vence_en: plan.vence_en || null,
                monto: Number(plan.monto) || 0,
              });
              alCerrar();
            } catch (err) {
              window.alert(err.message);
            }
          }}
        >
          <h3>Plan</h3>
          <div className="form-rejilla">
            <Campo etiqueta="Plan">
              {(p) => (
                <select {...p} value={plan.plan} onChange={(e) => setPlan({ ...plan, plan: e.target.value })}>
                  <option value="gratis">Gratis</option>
                  <option value="destacado">Destacado</option>
                  <option value="premium">Premium</option>
                </select>
              )}
            </Campo>
            <Campo etiqueta="Vence">
              {(p) => <input {...p} type="date" value={plan.vence_en} onChange={(e) => setPlan({ ...plan, vence_en: e.target.value })} />}
            </Campo>
            <Campo etiqueta="Monto pagado (COP)">
              {(p) => <input {...p} type="number" min="0" value={plan.monto} onChange={(e) => setPlan({ ...plan, monto: e.target.value })} />}
            </Campo>
          </div>
          <button type="submit" className="btn btn-oscuro" style={{ alignSelf: 'flex-start' }}>
            Guardar plan
          </button>
        </form>
      )}
    </div>
  );
}

function Agencias() {
  const [estado, setEstado] = useState('pendiente');
  const { datos, error, cargando, recargar } = useDatos(`/admin/agencias?estado=${estado}`);
  const [abierta, setAbierta] = useState(null);
  const [ejecutar, errorAccion] = useAccion(recargar);
  const actual = abierta && datos?.find((a) => a.id === abierta);

  const resumenDocs = (a) => {
    if (!a.verificaciones.length) return <span className="insignia insignia-roja">Sin documentos</span>;
    const pendientes = a.verificaciones.filter((v) => v.estado === 'pendiente').length;
    return (
      <span className="pequeno">
        {a.verificaciones.map((v) => etiquetasDocumento[v.tipo].split(' (')[0].replace('Registro Nacional de Turismo', 'RNT')).join(', ')}
        {pendientes > 0 && <span className="insignia insignia-ambar" style={{ marginLeft: 6 }}>{pendientes} por revisar</span>}
      </span>
    );
  };

  return (
    <div className="pila">
      <h1 className="panel-titulo">Agencias</h1>
      <FiltroEstado opciones={['pendiente', 'activa', 'suspendida', 'rechazada']} valor={estado} onChange={setEstado} />
      {cargando && !datos ? (
        <Cargando />
      ) : error ? (
        <ErrorCarga error={error} reintentar={recargar} />
      ) : datos.length === 0 ? (
        <Vacio titulo={`No hay agencias en estado "${etiquetasEstado[estado].toLowerCase()}"`} />
      ) : (
        <TablaTarjetas
          etiqueta="Agencias"
          filas={datos}
          columnas={[
            {
              titulo: 'Agencia',
              celda: (a) => (
                <div>
                  <strong>{a.nombre_comercial}</strong>
                  <div className="suave pequeno">NIT {a.nit}</div>
                </div>
              ),
            },
            { titulo: 'RNT', celda: (a) => a.rnt },
            { titulo: 'Ciudad', celda: (a) => a.ciudad },
            { titulo: 'Documentos', celda: resumenDocs },
            { titulo: 'Registrada', celda: (a) => <span className="pequeno">{fecha(a.created_at)}</span> },
            {
              titulo: 'Acción',
              alinear: 'right',
              celda: (a) => (
                <button type="button" className="btn btn-primario btn-sm" onClick={() => setAbierta(a.id)}>
                  Revisar
                </button>
              ),
            },
          ]}
          tarjeta={(a) => (
            <>
              <div>
                <strong style={{ fontSize: 16 }}>{a.nombre_comercial}</strong>
                <div className="suave pequeno">
                  {a.ciudad} · {fecha(a.created_at)}
                </div>
              </div>
              <DatoFila etiqueta="RNT">{a.rnt}</DatoFila>
              <DatoFila etiqueta="NIT">{a.nit}</DatoFila>
              <div>{resumenDocs(a)}</div>
              <button type="button" className="btn btn-primario" onClick={() => setAbierta(a.id)}>
                Revisar
              </button>
            </>
          )}
        />
      )}
      <Modal abierto={Boolean(actual)} alCerrar={() => setAbierta(null)} titulo={actual?.nombre_comercial || ''}>
        {actual && <DetalleAgencia agencia={actual} ejecutar={ejecutar} error={errorAccion} alCerrar={() => setAbierta(null)} />}
      </Modal>
    </div>
  );
}

/* ───────────── Comprobantes de viaje ───────────── */

function Comprobantes() {
  const [estado, setEstado] = useState('pendiente');
  const { datos, error, cargando, recargar } = useDatos(`/admin/viajes?estado=${estado}`);
  const [ejecutar, errorAccion] = useAccion(recargar);

  const acciones = (v, movil) =>
    v.estado === 'pendiente' && (
      <>
        <button type="button" className={`btn btn-whatsapp ${movil ? '' : 'btn-sm'}`} style={movil ? { flex: 1 } : undefined} onClick={() => ejecutar(`/admin/viajes/${v.id}/aprobar`)}>
          Aprobar
        </button>
        <button
          type="button"
          className={`btn btn-peligro ${movil ? '' : 'btn-sm'}`}
          style={movil ? { flex: 1 } : undefined}
          onClick={() => {
            const notas = window.prompt('Motivo del rechazo (lo verá el viajero):') ?? null;
            if (notas !== null) ejecutar(`/admin/viajes/${v.id}/rechazar`, { notas });
          }}
        >
          Rechazar
        </button>
      </>
    );

  return (
    <div className="pila">
      <h1 className="panel-titulo">Comprobantes de viaje</h1>
      <p className="suave" style={{ margin: 0 }}>
        Verifica que el documento corresponda a la agencia, al viajero y a una fecha real.
      </p>
      <FiltroEstado opciones={['pendiente', 'aprobada', 'rechazada']} valor={estado} onChange={setEstado} />
      <Alerta>{errorAccion}</Alerta>
      {cargando && !datos ? (
        <Cargando />
      ) : error ? (
        <ErrorCarga error={error} reintentar={recargar} />
      ) : datos.length === 0 ? (
        <Vacio titulo="No hay comprobantes aquí" />
      ) : (
        <TablaTarjetas
          etiqueta="Comprobantes"
          filas={datos}
          columnas={[
            {
              titulo: 'Viajero',
              celda: (v) => (
                <div>
                  <strong>{v.viajero}</strong>
                  <div className="suave pequeno">{v.viajero_email}</div>
                </div>
              ),
            },
            { titulo: 'Agencia', celda: (v) => v.agencia },
            { titulo: 'Fecha del viaje', celda: (v) => fecha(v.fecha_viaje) },
            { titulo: 'Enviado', celda: (v) => <span className="pequeno">{fecha(v.created_at)}</span> },
            {
              titulo: 'Comprobante',
              celda: (v) => (
                <button type="button" className="btn btn-borde btn-sm" onClick={() => verArchivo(v.comprobante_url)}>
                  Ver
                </button>
              ),
            },
            { titulo: 'Decisión', alinear: 'right', celda: (v) => <div className="acciones">{acciones(v) || <Estado valor={v.estado} />}</div> },
          ]}
          tarjeta={(v) => (
            <>
              <div className="fila-entre">
                <strong style={{ fontSize: 16 }}>{v.viajero}</strong>
                <Estado valor={v.estado} />
              </div>
              <DatoFila etiqueta="Agencia">{v.agencia}</DatoFila>
              <DatoFila etiqueta="Fecha del viaje">{fecha(v.fecha_viaje)}</DatoFila>
              <button type="button" className="btn btn-borde" onClick={() => verArchivo(v.comprobante_url)}>
                Ver comprobante
              </button>
              <div className="fila" style={{ flexWrap: 'nowrap' }}>
                {acciones(v, true)}
              </div>
            </>
          )}
        />
      )}
    </div>
  );
}

/* ───────────── Reseñas ───────────── */

function Resenas() {
  const [estado, setEstado] = useState('pendiente');
  const { datos, error, cargando, recargar } = useDatos(`/admin/resenas?estado=${estado}`);
  const [ejecutar, errorAccion] = useAccion(recargar);

  const acciones = (r, movil) => {
    const cls = movil ? '' : 'btn-sm';
    const st = movil ? { flex: 1 } : undefined;
    return (
      <>
        {r.estado !== 'publicada' && (
          <button type="button" className={`btn btn-whatsapp ${cls}`} style={st} onClick={() => ejecutar(`/admin/resenas/${r.id}/publicar`)}>
            Publicar
          </button>
        )}
        {r.estado === 'publicada' && (
          <button type="button" className={`btn btn-borde ${cls}`} style={st} onClick={() => ejecutar(`/admin/resenas/${r.id}/ocultar`)}>
            Ocultar
          </button>
        )}
        {r.estado === 'pendiente' && (
          <button type="button" className={`btn btn-peligro ${cls}`} style={st} onClick={() => ejecutar(`/admin/resenas/${r.id}/rechazar`)}>
            Rechazar
          </button>
        )}
      </>
    );
  };

  return (
    <div className="pila">
      <h1 className="panel-titulo">Moderación de reseñas</h1>
      <FiltroEstado opciones={['pendiente', 'publicada', 'oculta', 'rechazada']} valor={estado} onChange={setEstado} />
      <Alerta>{errorAccion}</Alerta>
      {cargando && !datos ? (
        <Cargando />
      ) : error ? (
        <ErrorCarga error={error} reintentar={recargar} />
      ) : datos.length === 0 ? (
        <Vacio titulo="No hay reseñas aquí" />
      ) : (
        <TablaTarjetas
          etiqueta="Reseñas"
          filas={datos}
          columnas={[
            {
              titulo: 'Reseña',
              celda: (r) => (
                <div style={{ maxWidth: 460 }}>
                  {r.titulo && <strong>{r.titulo}</strong>}
                  <p style={{ margin: '2px 0 0', whiteSpace: 'pre-line' }}>{r.comentario}</p>
                </div>
              ),
            },
            { titulo: 'Agencia', celda: (r) => r.agencia },
            { titulo: 'Viajero', celda: (r) => r.viajero },
            { titulo: 'Nota', celda: (r) => <Calificacion valor={r.calificacion_general} total={1} /> },
            { titulo: 'Decisión', alinear: 'right', celda: (r) => <div className="acciones">{acciones(r)}</div> },
          ]}
          tarjeta={(r) => (
            <>
              <div className="fila-entre">
                <strong>{r.agencia}</strong>
                <Calificacion valor={r.calificacion_general} total={1} />
              </div>
              <span className="suave pequeno">
                {r.viajero} · viajó {fecha(r.fecha_viaje)}
              </span>
              {r.titulo && <strong>{r.titulo}</strong>}
              <p style={{ margin: 0, whiteSpace: 'pre-line' }}>{r.comentario}</p>
              <div className="fila" style={{ flexWrap: 'nowrap' }}>
                {acciones(r, true)}
              </div>
            </>
          )}
        />
      )}
    </div>
  );
}

/* ───────────── Reportes ───────────── */

function Reportes() {
  const [estado, setEstado] = useState('abierto');
  const { datos, error, cargando, recargar } = useDatos(`/admin/reportes?estado=${estado}`);
  const [ejecutar, errorAccion] = useAccion(recargar);

  const acciones = (r, movil) =>
    r.estado === 'abierto' && (
      <>
        <button type="button" className={`btn btn-primario ${movil ? '' : 'btn-sm'}`} style={movil ? { flex: 1 } : undefined} onClick={() => ejecutar(`/admin/reportes/${r.id}/resolver`)}>
          Resuelto
        </button>
        <button type="button" className={`btn btn-fantasma ${movil ? '' : 'btn-sm'}`} style={movil ? { flex: 1 } : undefined} onClick={() => ejecutar(`/admin/reportes/${r.id}/descartar`)}>
          Descartar
        </button>
      </>
    );

  return (
    <div className="pila">
      <h1 className="panel-titulo">Reportes</h1>
      <FiltroEstado opciones={['abierto', 'resuelto', 'descartado']} valor={estado} onChange={setEstado} />
      <Alerta>{errorAccion}</Alerta>
      {cargando && !datos ? (
        <Cargando />
      ) : error ? (
        <ErrorCarga error={error} reintentar={recargar} />
      ) : datos.length === 0 ? (
        <Vacio titulo="No hay reportes aquí" />
      ) : (
        <TablaTarjetas
          etiqueta="Reportes"
          filas={datos}
          columnas={[
            { titulo: 'Tipo', celda: (r) => (r.tipo === 'resena' ? 'Reseña' : 'Agencia') },
            { titulo: 'Agencia', celda: (r) => r.agencia },
            {
              titulo: 'Motivo',
              celda: (r) => (
                <div style={{ maxWidth: 420 }}>
                  {r.motivo}
                  {r.resena_comentario && <div className="suave pequeno">Reseña: “{r.resena_comentario.slice(0, 140)}”</div>}
                </div>
              ),
            },
            { titulo: 'Reportado por', celda: (r) => r.reportado_por_nombre },
            { titulo: 'Fecha', celda: (r) => <span className="pequeno">{fecha(r.created_at)}</span> },
            { titulo: '', alinear: 'right', celda: (r) => <div className="acciones">{acciones(r) || <Estado valor={r.estado} />}</div> },
          ]}
          tarjeta={(r) => (
            <>
              <div className="fila-entre">
                <strong>
                  {r.tipo === 'resena' ? 'Reseña' : 'Agencia'} · {r.agencia}
                </strong>
                <Estado valor={r.estado} />
              </div>
              <p style={{ margin: 0 }}>{r.motivo}</p>
              <span className="suave pequeno">
                {r.reportado_por_nombre} · {fecha(r.created_at)}
              </span>
              <div className="fila" style={{ flexWrap: 'nowrap' }}>
                {acciones(r, true)}
              </div>
            </>
          )}
        />
      )}
    </div>
  );
}

export default function PanelAdmin() {
  const { datos: r } = useDatos('/admin/resumen');
  const enlaces = [
    { a: '/admin', texto: 'Resumen', fin: true },
    { a: '/admin/agencias', texto: 'Agencias', contador: r?.agencias_pendientes },
    { a: '/admin/comprobantes', texto: 'Comprobantes', contador: r?.comprobantes_pendientes },
    { a: '/admin/resenas', texto: 'Reseñas', contador: r?.resenas_pendientes },
    { a: '/admin/reportes', texto: 'Reportes', contador: r?.reportes_abiertos },
  ];
  return (
    <Panel etiqueta="Administración" enlaces={enlaces}>
      <Routes>
        <Route index element={<Resumen />} />
        <Route path="agencias" element={<Agencias />} />
        <Route path="comprobantes" element={<Comprobantes />} />
        <Route path="resenas" element={<Resenas />} />
        <Route path="reportes" element={<Reportes />} />
      </Routes>
    </Panel>
  );
}
