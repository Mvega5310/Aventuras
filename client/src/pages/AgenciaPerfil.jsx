import { useState } from 'react';
import { Link, useLocation, useParams } from 'react-router-dom';
import Icono from '../components/Icono.jsx';
import {
  Alerta,
  Calificacion,
  Campo,
  Cargando,
  DatoFila,
  ErrorCarga,
  Logo,
  Modal,
  Vacio,
  Verificada,
} from '../components/ui.jsx';
import { api, urlPublica } from '../api.js';
import { useAuth } from '../auth.jsx';
import { calificacion, enlaceWhatsapp, fecha, precio, useDatos } from '../util.js';

function FormCotizacion({ agencia, paqueteInicial, alEnviar }) {
  const { usuario } = useAuth();
  const ubicacion = useLocation();
  const [f, setF] = useState({
    paquete_id: paqueteInicial || '',
    fecha_salida: '',
    fecha_regreso: '',
    num_viajeros: 2,
    presupuesto_max: '',
    mensaje: '',
  });
  const [errores, setErrores] = useState({});
  const [error, setError] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [listo, setListo] = useState(false);
  const cambiar = (c) => (e) => setF((v) => ({ ...v, [c]: e.target.value }));

  if (!usuario) {
    const volver = encodeURIComponent(ubicacion.pathname);
    return (
      <div className="pila-sm">
        <p className="suave" style={{ margin: 0 }}>
          Crea tu cuenta gratis para pedir cotizaciones y guardar agencias.
        </p>
        <Link to={`/registro?volver=${volver}`} className="btn btn-primario">
          Crear cuenta
        </Link>
        <Link to={`/ingresar?volver=${volver}`} className="btn btn-fantasma">
          Ya tengo cuenta
        </Link>
      </div>
    );
  }
  if (usuario.rol !== 'viajero') {
    return <Alerta tipo="info">Las cotizaciones se piden con una cuenta de viajero.</Alerta>;
  }
  if (listo) {
    return (
      <div className="pila-sm">
        <Alerta tipo="exito">¡Solicitud enviada! La agencia te contactará pronto.</Alerta>
        <Link to="/mis-viajes" className="btn btn-borde">
          Ver mis solicitudes
        </Link>
      </div>
    );
  }

  const enviar = async (e) => {
    e.preventDefault();
    setEnviando(true);
    setError('');
    setErrores({});
    try {
      await api.post('/solicitudes', {
        agencia_id: agencia.id,
        paquete_id: f.paquete_id || null,
        fecha_salida: f.fecha_salida || null,
        fecha_regreso: f.fecha_regreso || null,
        num_viajeros: Number(f.num_viajeros) || 1,
        presupuesto_max: f.presupuesto_max ? Number(f.presupuesto_max) : null,
        mensaje: f.mensaje,
      });
      setListo(true);
      alEnviar?.();
    } catch (err) {
      setError(err.message);
      setErrores(err.porCampo || {});
    } finally {
      setEnviando(false);
    }
  };

  const hoy = new Date().toISOString().slice(0, 10);
  return (
    <form className="pila" onSubmit={enviar} noValidate>
      <Alerta>{error}</Alerta>
      {agencia.paquetes.length > 0 && (
        <Campo etiqueta="Paquete de interés">
          {(p) => (
            <select {...p} value={f.paquete_id} onChange={cambiar('paquete_id')}>
              <option value="">Viaje a la medida</option>
              {agencia.paquetes.map((pq) => (
                <option key={pq.id} value={pq.id}>
                  {pq.titulo}
                </option>
              ))}
            </select>
          )}
        </Campo>
      )}
      <div className="fila" style={{ flexWrap: 'nowrap', alignItems: 'flex-start' }}>
        <Campo etiqueta="Salida" error={errores.fecha_salida} className="flex-1">
          {(p) => <input {...p} type="date" min={hoy} value={f.fecha_salida} onChange={cambiar('fecha_salida')} />}
        </Campo>
        <Campo etiqueta="Regreso" error={errores.fecha_regreso}>
          {(p) => (
            <input {...p} type="date" min={f.fecha_salida || hoy} value={f.fecha_regreso} onChange={cambiar('fecha_regreso')} />
          )}
        </Campo>
      </div>
      <div className="fila" style={{ flexWrap: 'nowrap', alignItems: 'flex-start' }}>
        <Campo etiqueta="Viajeros" error={errores.num_viajeros}>
          {(p) => <input {...p} type="number" min="1" max="500" value={f.num_viajeros} onChange={cambiar('num_viajeros')} />}
        </Campo>
        <Campo etiqueta="Presupuesto total (COP)" error={errores.presupuesto_max}>
          {(p) => (
            <input {...p} type="number" min="0" step="50000" inputMode="numeric" value={f.presupuesto_max} onChange={cambiar('presupuesto_max')} />
          )}
        </Campo>
      </div>
      <Campo etiqueta="Mensaje" error={errores.mensaje}>
        {(p) => (
          <textarea {...p} rows={3} placeholder="Cuéntales qué buscas" value={f.mensaje} onChange={cambiar('mensaje')} maxLength={2000} />
        )}
      </Campo>
      <p className="suave pequeno" style={{ margin: 0 }}>
        La agencia verá tu nombre, correo y teléfono para responderte.
      </p>
      <button type="submit" className="btn btn-primario" disabled={enviando}>
        {enviando ? 'Enviando…' : 'Enviar solicitud'}
      </button>
    </form>
  );
}

function FormReporte({ cuerpo, alTerminar }) {
  const [motivo, setMotivo] = useState('');
  const [estado, setEstado] = useState({ enviando: false, error: '', listo: false });
  if (estado.listo) return <Alerta tipo="exito">Gracias. Nuestro equipo revisará tu reporte.</Alerta>;
  return (
    <form
      className="pila"
      onSubmit={async (e) => {
        e.preventDefault();
        setEstado({ enviando: true, error: '' });
        try {
          await api.post('/reportes', { ...cuerpo, motivo });
          setEstado({ listo: true });
          setTimeout(alTerminar, 1500);
        } catch (err) {
          setEstado({ error: err.message });
        }
      }}
    >
      <Alerta>{estado.error}</Alerta>
      <Campo etiqueta="¿Qué está pasando?">
        {(p) => <textarea {...p} required rows={4} maxLength={1000} value={motivo} onChange={(e) => setMotivo(e.target.value)} />}
      </Campo>
      <button type="submit" className="btn btn-primario" disabled={estado.enviando || !motivo.trim()}>
        Enviar reporte
      </button>
    </form>
  );
}

export default function AgenciaPerfil() {
  const { slug } = useParams();
  const { usuario } = useAuth();
  const { datos: a, error, cargando, recargar, setDatos } = useDatos(`/agencias/${slug}`);
  const [cotizar, setCotizar] = useState(null); // null | { paquete }
  const [reporte, setReporte] = useState(null);

  if (cargando && !a) return <Cargando />;
  if (error?.status === 404) {
    return (
      <div className="contenedor pagina">
        <Vacio titulo="Agencia no encontrada" accion={<Link to="/agencias" className="btn btn-primario">Ver agencias</Link>}>
          Puede que ya no esté activa en el directorio.
        </Vacio>
      </div>
    );
  }
  if (error) return <div className="contenedor pagina"><ErrorCarga error={error} reintentar={recargar} /></div>;

  const esViajero = usuario?.rol === 'viajero';
  const whatsapp = enlaceWhatsapp(a.whatsapp, `Hola ${a.nombre_comercial}, los encontré en Rumbo Seguro.`);

  const alternarFavorito = async () => {
    const nuevo = !a.es_favorito;
    setDatos({ ...a, es_favorito: nuevo });
    try {
      if (nuevo) await api.put(`/favoritos/${a.id}`);
      else await api.delete(`/favoritos/${a.id}`);
    } catch {
      setDatos({ ...a, es_favorito: !nuevo });
    }
  };

  const criterios = [
    ['Precio', a.criterios?.precio],
    ['Atención', a.criterios?.atencion],
    ['Cumplimiento', a.criterios?.cumplimiento],
  ];

  return (
    <div className="contenedor pagina con-barra-accion">
      <p className="solo-pc" style={{ margin: '0 0 16px' }}>
        <Link to="/agencias" style={{ textDecoration: 'none' }}>
          ← Volver a resultados
        </Link>
      </p>

      <section className="perfil-cabecera">
        <div className="foto perfil-portada">
          {a.portada_url ? <img src={urlPublica(a.portada_url)} alt="" /> : null}
        </div>
        <div className="perfil-cuerpo">
          <div className="fila" style={{ alignItems: 'flex-end', gap: 20 }}>
            <div style={{ marginTop: -36 }}>
              <Logo url={a.logo_url} nombre={a.nombre_comercial} grande />
            </div>
            <div className="pila-sm" style={{ gap: 6 }}>
              <h1 className="titulo-display" style={{ fontSize: 'clamp(24px, 4vw, 34px)' }}>
                {a.nombre_comercial}
              </h1>
              <div className="fila" style={{ gap: 10 }}>
                <Verificada />
                {a.destacada && <span className="insignia insignia-ambar">Destacada</span>}
                <span className="suave">
                  {a.ciudad}, {a.departamento}
                </span>
                <Calificacion valor={a.calificacion_promedio} total={a.total_resenas} />
              </div>
            </div>
          </div>
          <div className="fila solo-pc">
            {esViajero && (
              <button
                type="button"
                className="btn btn-fantasma btn-icono"
                onClick={alternarFavorito}
                aria-pressed={a.es_favorito}
                aria-label={a.es_favorito ? 'Quitar de favoritos' : 'Guardar en favoritos'}
              >
                <Icono nombre="corazon" color={a.es_favorito ? '#B23A2B' : 'currentColor'} />
              </button>
            )}
            {whatsapp && (
              <a href={whatsapp} className="btn btn-whatsapp" target="_blank" rel="noopener noreferrer">
                Escribir por WhatsApp
              </a>
            )}
            <a href="#cotizar" className="btn btn-primario">
              Solicitar cotización
            </a>
          </div>
        </div>
      </section>

      <div className="perfil-columnas">
        <div className="pila" style={{ gap: 24 }}>
          {(a.descripcion || a.tipos.length > 0) && (
            <section className="tarjeta pila-sm">
              <h2>Sobre la agencia</h2>
              {a.descripcion && (
                <p style={{ margin: 0, color: 'var(--texto-2)', whiteSpace: 'pre-line' }}>{a.descripcion}</p>
              )}
              <div className="opciones" style={{ marginTop: 4 }}>
                {a.tipos.map((t) => (
                  <span key={t.id} className="insignia insignia-teal">
                    {t.nombre}
                  </span>
                ))}
              </div>
              {a.destinos.length > 0 && (
                <p className="suave pequeno" style={{ margin: '4px 0 0' }}>
                  Destinos: {a.destinos.map((d) => d.nombre).join(', ')}
                </p>
              )}
            </section>
          )}

          <section className="tarjeta pila">
            <h2>Paquetes</h2>
            {a.paquetes.length === 0 ? (
              <p className="suave" style={{ margin: 0 }}>
                Esta agencia arma viajes a la medida. Pide tu cotización.
              </p>
            ) : (
              <div className="rejilla" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 16 }}>
                {a.paquetes.map((p) => (
                  <article key={p.id} className="tarjeta" style={{ padding: 0, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
                    <div className="foto" style={{ height: 110 }}>
                      {p.imagen_url ? <img src={urlPublica(p.imagen_url)} alt="" /> : `[Foto de ${p.destino}]`}
                    </div>
                    <div className="pila-sm" style={{ padding: 16, flex: 1 }}>
                      <h3 style={{ fontSize: 16 }}>{p.titulo}</h3>
                      <span className="suave pequeno">
                        {p.destino}
                        {p.duracion_dias ? ` · ${p.duracion_dias} ${p.duracion_dias === 1 ? 'día' : 'días'}` : ''}
                      </span>
                      {p.incluye?.length > 0 && <span className="pequeno">Incluye: {p.incluye.join(', ')}</span>}
                      <div style={{ marginTop: 'auto' }}>
                        <div className="suave pequeno">Desde</div>
                        <strong style={{ fontSize: 18 }}>{precio(p.precio_desde, p.moneda)}</strong>
                      </div>
                      <button type="button" className="btn btn-borde btn-sm" onClick={() => setCotizar({ paquete: p.id })}>
                        Cotizar este paquete
                      </button>
                    </div>
                  </article>
                ))}
              </div>
            )}
          </section>

          <section className="tarjeta pila">
            <div>
              <h2>Reseñas de clientes verificados</h2>
              <p className="suave pequeno" style={{ margin: '4px 0 0' }}>
                Solo opinan personas que presentaron el comprobante de su viaje.
              </p>
            </div>
            {a.total_resenas === 0 ? (
              <p className="suave" style={{ margin: 0 }}>
                Esta agencia aún no tiene reseñas publicadas.
              </p>
            ) : (
              <>
                <div className="fila" style={{ alignItems: 'flex-start', gap: 24 }}>
                  <div>
                    <div className="titulo-display" style={{ fontSize: 48, lineHeight: 1 }}>
                      {calificacion(a.calificacion_promedio)}
                    </div>
                    <div className="suave pequeno">de 5 · {a.total_resenas} reseñas</div>
                  </div>
                  <div className="pila-sm" style={{ flex: '1 1 260px' }}>
                    {criterios.map(([nombre, valor]) => (
                      <div key={nombre} className="fila" style={{ flexWrap: 'nowrap' }}>
                        <span style={{ width: 110 }} className="pequeno">
                          {nombre}
                        </span>
                        <div className="barra-criterio" role="img" aria-label={`${nombre}: ${calificacion(valor)} de 5`}>
                          <div style={{ width: `${((valor || 0) / 5) * 100}%` }} />
                        </div>
                        <strong style={{ width: 32, textAlign: 'right' }}>{calificacion(valor)}</strong>
                      </div>
                    ))}
                  </div>
                </div>
                {a.resenas.map((r) => (
                  <article key={r.id} className="pila-sm" style={{ border: '1px solid var(--linea)', borderRadius: 14, padding: 16 }}>
                    <div className="fila-entre pequeno">
                      <strong>{r.autor}</strong>
                      <span className="suave">Viajó en {fecha(r.fecha_viaje, { month: 'long', year: 'numeric' })}</span>
                    </div>
                    <div className="fila" style={{ gap: 8 }}>
                      <Calificacion valor={r.calificacion_general} total={1} />
                      <span className="insignia insignia-verde">Viaje verificado</span>
                    </div>
                    {r.titulo && <strong>{r.titulo}</strong>}
                    <p style={{ margin: 0, color: 'var(--texto-2)', whiteSpace: 'pre-line' }}>{r.comentario}</p>
                    {r.respuesta && (
                      <div style={{ background: 'var(--fondo)', borderRadius: 10, padding: 12 }}>
                        <div className="pequeno" style={{ fontWeight: 700 }}>
                          Respuesta de la agencia
                        </div>
                        <p style={{ margin: '4px 0 0', whiteSpace: 'pre-line' }}>{r.respuesta}</p>
                      </div>
                    )}
                    {usuario && (
                      <button
                        type="button"
                        className="btn btn-fantasma btn-sm"
                        style={{ alignSelf: 'flex-start' }}
                        onClick={() => setReporte({ tipo: 'resena', resena_id: r.id })}
                      >
                        Reportar reseña
                      </button>
                    )}
                  </article>
                ))}
              </>
            )}
          </section>
        </div>

        <aside className="pila" style={{ gap: 24 }}>
          <section id="cotizar" className="tarjeta pila solo-pc">
            <h2 style={{ fontSize: 18 }}>Solicita tu cotización</h2>
            <FormCotizacion agencia={a} />
          </section>

          <section className="tarjeta pila-sm">
            <h2 style={{ fontSize: 18 }}>Datos legales</h2>
            <DatoFila etiqueta="RNT">{a.rnt}</DatoFila>
            <DatoFila etiqueta="NIT">{a.nit}</DatoFila>
            <DatoFila etiqueta="Razón social">{a.razon_social}</DatoFila>
            {a.rnt_vigente_hasta && <DatoFila etiqueta="RNT vigente hasta">{fecha(a.rnt_vigente_hasta)}</DatoFila>}
            {a.anio_fundacion && <DatoFila etiqueta="Operando desde">{a.anio_fundacion}</DatoFila>}
            {a.verificada_en && <DatoFila etiqueta="Verificada el">{fecha(a.verificada_en)}</DatoFila>}
            {a.sitio_web && (
              <a href={a.sitio_web} target="_blank" rel="noopener noreferrer nofollow" className="pequeno">
                Sitio web de la agencia
              </a>
            )}
            {usuario && (
              <button
                type="button"
                className="btn btn-fantasma btn-sm"
                style={{ alignSelf: 'flex-start' }}
                onClick={() => setReporte({ tipo: 'agencia', agencia_id: a.id })}
              >
                Reportar esta agencia
              </button>
            )}
          </section>
        </aside>
      </div>

      <div className="barra-accion-movil solo-movil">
        {esViajero && (
          <button
            type="button"
            className="btn btn-fantasma btn-icono"
            onClick={alternarFavorito}
            aria-pressed={a.es_favorito}
            aria-label={a.es_favorito ? 'Quitar de favoritos' : 'Guardar en favoritos'}
          >
            <Icono nombre="corazon" color={a.es_favorito ? '#B23A2B' : 'currentColor'} />
          </button>
        )}
        {whatsapp && (
          <a href={whatsapp} className="btn btn-whatsapp" style={{ flex: 1 }} target="_blank" rel="noopener noreferrer">
            WhatsApp
          </a>
        )}
        <button type="button" className="btn btn-primario" style={{ flex: 1.3 }} onClick={() => setCotizar({})}>
          Cotizar
        </button>
      </div>

      <Modal abierto={Boolean(cotizar)} alCerrar={() => setCotizar(null)} titulo={`Cotizar con ${a.nombre_comercial}`}>
        {cotizar && <FormCotizacion agencia={a} paqueteInicial={cotizar.paquete} />}
      </Modal>
      <Modal abierto={Boolean(reporte)} alCerrar={() => setReporte(null)} titulo="Reportar">
        {reporte && <FormReporte cuerpo={reporte} alTerminar={() => setReporte(null)} />}
      </Modal>
    </div>
  );
}
