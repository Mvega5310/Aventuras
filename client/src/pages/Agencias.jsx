import { useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import Icono from '../components/Icono.jsx';
import {
  Calificacion,
  Cargando,
  ErrorCarga,
  Logo,
  Modal,
  TablaTarjetas,
  Vacio,
  Verificada,
} from '../components/ui.jsx';
import { enlaceWhatsapp, precio, useCatalogos, useDatos } from '../util.js';

const filtrosVacios = { destino: '', tipo: '', ciudad: '', min_calificacion: '', precio_max: '', q: '' };

function Filtros({ valores, alAplicar, tipos, destinos, ciudades }) {
  // El componente se monta de nuevo (prop key) cuando cambian los filtros de la URL
  const [f, setF] = useState(valores);
  const cambiar = (campo) => (e) => setF((v) => ({ ...v, [campo]: e.target.value }));

  return (
    <form
      className="pila"
      onSubmit={(e) => {
        e.preventDefault();
        alAplicar(f);
      }}
    >
      <div className="campo">
        <label htmlFor="f-q">Nombre de la agencia</label>
        <input id="f-q" type="search" value={f.q} onChange={cambiar('q')} placeholder="Buscar por nombre" />
      </div>
      <div className="campo">
        <label htmlFor="f-destino">Destino</label>
        <select id="f-destino" value={f.destino} onChange={cambiar('destino')}>
          <option value="">Todos</option>
          {destinos.map((d) => (
            <option key={d.id} value={d.slug}>
              {d.nombre}
            </option>
          ))}
        </select>
      </div>
      <div className="campo">
        <label htmlFor="f-tipo">Tipo de viaje</label>
        <select id="f-tipo" value={f.tipo} onChange={cambiar('tipo')}>
          <option value="">Cualquiera</option>
          {tipos.map((t) => (
            <option key={t.id} value={t.slug}>
              {t.nombre}
            </option>
          ))}
        </select>
      </div>
      <div className="campo">
        <label htmlFor="f-ciudad">Ciudad de la agencia</label>
        <select id="f-ciudad" value={f.ciudad} onChange={cambiar('ciudad')}>
          <option value="">Todas</option>
          {ciudades.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
      </div>
      <div className="campo">
        <label htmlFor="f-precio">Precio máximo por persona</label>
        <select id="f-precio" value={f.precio_max} onChange={cambiar('precio_max')}>
          <option value="">Cualquiera</option>
          <option value="1000000">Hasta $1.000.000</option>
          <option value="2000000">Hasta $2.000.000</option>
          <option value="3000000">Hasta $3.000.000</option>
          <option value="5000000">Hasta $5.000.000</option>
        </select>
      </div>
      <fieldset className="campo" style={{ border: 0, padding: 0, margin: 0 }}>
        <legend className="etiqueta" style={{ padding: 0, marginBottom: 6 }}>
          Calificación mínima
        </legend>
        {[
          ['4.5', '4,5 o más'],
          ['4', '4,0 o más'],
          ['', 'Todas'],
        ].map(([v, texto]) => (
          <label key={texto} className="casilla">
            <input
              type="radio"
              name="min_calificacion"
              value={v}
              checked={f.min_calificacion === v}
              onChange={cambiar('min_calificacion')}
            />
            {texto}
          </label>
        ))}
      </fieldset>
      <button type="submit" className="btn btn-primario">
        Aplicar filtros
      </button>
      <button type="button" className="btn btn-fantasma" onClick={() => alAplicar(filtrosVacios)}>
        Limpiar
      </button>
    </form>
  );
}

export default function Agencias() {
  const [params, setParams] = useSearchParams();
  const [filtrosMovil, setFiltrosMovil] = useState(false);
  const { tipos, destinos } = useCatalogos();
  const { datos: ciudades } = useDatos('/catalogos/ciudades');
  const consulta = params.toString();
  const { datos, error, cargando, recargar } = useDatos(`/agencias?${consulta}`);

  const valores = Object.fromEntries(Object.keys(filtrosVacios).map((k) => [k, params.get(k) || '']));
  const orden = params.get('orden') || 'calificacion';
  const pagina = Number(params.get('page')) || 1;
  const destino = destinos.find((d) => d.slug === valores.destino);
  const activos = Object.values(valores).filter(Boolean).length;

  const aplicar = (f) => {
    const p = new URLSearchParams(Object.entries(f).filter(([, v]) => v));
    if (orden !== 'calificacion') p.set('orden', orden);
    setParams(p);
    setFiltrosMovil(false);
  };
  const cambiarParam = (clave, valor) => {
    const p = new URLSearchParams(params);
    if (valor) p.set(clave, valor);
    else p.delete(clave);
    if (clave !== 'page') p.delete('page');
    setParams(p);
  };

  const agencias = datos?.datos || [];
  const total = datos?.paginacion?.total ?? 0;

  return (
    <div className="contenedor pagina">
      <div className="fila-entre" style={{ marginBottom: 20, alignItems: 'flex-end' }}>
        <div>
          <h1 className="titulo-display" style={{ fontSize: 'clamp(24px, 4vw, 34px)' }}>
            {destino ? `Agencias para viajar a ${destino.nombre}` : 'Agencias verificadas'}
          </h1>
          <p className="suave" style={{ margin: '6px 0 0' }}>
            {cargando ? 'Buscando…' : `${total} ${total === 1 ? 'agencia verificada' : 'agencias verificadas'}`}
          </p>
        </div>
        <div className="campo solo-pc" style={{ minWidth: 220 }}>
          <label htmlFor="orden">Ordenar por</label>
          <select id="orden" value={orden} onChange={(e) => cambiarParam('orden', e.target.value)}>
            <option value="calificacion">Mejor calificación</option>
            <option value="resenas">Más reseñas</option>
            <option value="precio">Menor precio</option>
          </select>
        </div>
      </div>

      <div className="chips solo-movil" style={{ marginBottom: 16 }}>
        <button type="button" className="chip active" onClick={() => setFiltrosMovil(true)}>
          <Icono nombre="filtros" tamano={16} />
          &nbsp;Filtros{activos ? ` (${activos})` : ''}
        </button>
        {[
          ['calificacion', 'Mejor calificadas'],
          ['resenas', 'Más reseñas'],
          ['precio', 'Menor precio'],
        ].map(([v, t]) => (
          <button
            key={v}
            type="button"
            className="chip"
            aria-pressed={orden === v}
            onClick={() => cambiarParam('orden', v === 'calificacion' ? '' : v)}
          >
            {t}
          </button>
        ))}
      </div>

      <div className="resultados">
        <aside className="tarjeta solo-pc" aria-label="Filtros">
          <Filtros key={consulta} valores={valores} alAplicar={aplicar} tipos={tipos} destinos={destinos} ciudades={ciudades || []} />
        </aside>

        <section aria-live="polite">
          {cargando && !datos ? (
            <Cargando />
          ) : error ? (
            <ErrorCarga error={error} reintentar={recargar} />
          ) : agencias.length === 0 ? (
            <Vacio
              titulo="No encontramos agencias con esos filtros"
              accion={
                <button type="button" className="btn btn-borde" onClick={() => aplicar(filtrosVacios)}>
                  Quitar filtros
                </button>
              }
            >
              Prueba con otro destino o amplía el presupuesto.
            </Vacio>
          ) : (
            <TablaTarjetas
              etiqueta="Agencias"
              filas={agencias}
              columnas={[
                {
                  titulo: 'Agencia',
                  celda: (a) => (
                    <div className="fila" style={{ flexWrap: 'nowrap' }}>
                      <Logo url={a.logo_url} nombre={a.nombre_comercial} />
                      <div>
                        <Link to={`/agencias/${a.slug}`} style={{ fontWeight: 700, color: 'var(--texto)', textDecoration: 'none' }}>
                          {a.nombre_comercial}
                        </Link>
                        <div className="suave pequeno">{a.ciudad}</div>
                        <div className="fila" style={{ gap: 6, marginTop: 3 }}>
                          <Verificada />
                          {a.destacada && <span className="insignia insignia-ambar">Destacada</span>}
                        </div>
                      </div>
                    </div>
                  ),
                },
                {
                  titulo: 'Calificación',
                  celda: (a) => <Calificacion valor={a.calificacion_promedio} total={a.total_resenas} />,
                },
                {
                  titulo: 'Tipos de viaje',
                  celda: (a) => <span className="suave pequeno">{a.tipos.slice(0, 2).join(', ') || '—'}</span>,
                },
                {
                  titulo: 'Desde',
                  celda: (a) => <strong>{precio(a.precio_desde)}</strong>,
                },
                {
                  titulo: 'Contacto',
                  alinear: 'right',
                  celda: (a) => (
                    <div className="acciones">
                      <Link to={`/agencias/${a.slug}`} className="btn btn-borde btn-sm">
                        Ver perfil
                      </Link>
                      {a.whatsapp && (
                        <a
                          href={enlaceWhatsapp(a.whatsapp, `Hola ${a.nombre_comercial}, los encontré en Rumbo Seguro.`)}
                          className="btn btn-whatsapp btn-sm btn-icono"
                          target="_blank"
                          rel="noopener noreferrer"
                          aria-label={`WhatsApp de ${a.nombre_comercial}`}
                          title="WhatsApp"
                        >
                          <Icono nombre="whatsapp" tamano={18} />
                        </a>
                      )}
                    </div>
                  ),
                },
              ]}
              tarjeta={(a) => (
                <>
                  <div className="fila" style={{ flexWrap: 'nowrap' }}>
                    <Logo url={a.logo_url} nombre={a.nombre_comercial} />
                    <div style={{ minWidth: 0, flex: 1 }}>
                      <Link to={`/agencias/${a.slug}`} style={{ fontWeight: 700, fontSize: 16, color: 'var(--texto)', textDecoration: 'none' }}>
                        {a.nombre_comercial}
                      </Link>
                      <div className="suave">{a.ciudad}</div>
                    </div>
                  </div>
                  <div className="fila" style={{ gap: 8 }}>
                    <Calificacion valor={a.calificacion_promedio} total={a.total_resenas} />
                    <Verificada />
                    {a.destacada && <span className="insignia insignia-ambar">Destacada</span>}
                  </div>
                  {a.tipos.length > 0 && <div className="suave pequeno">{a.tipos.join(' · ')}</div>}
                  <div className="fila-entre">
                    <span className="suave pequeno">Desde</span>
                    <strong style={{ fontSize: 20 }}>{precio(a.precio_desde)}</strong>
                  </div>
                  <div className="fila" style={{ flexWrap: 'nowrap' }}>
                    <Link to={`/agencias/${a.slug}`} className="btn btn-borde" style={{ flex: 1 }}>
                      Ver perfil
                    </Link>
                    {a.whatsapp && (
                      <a
                        href={enlaceWhatsapp(a.whatsapp, `Hola ${a.nombre_comercial}, los encontré en Rumbo Seguro.`)}
                        className="btn btn-whatsapp"
                        style={{ flex: 1 }}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        WhatsApp
                      </a>
                    )}
                  </div>
                </>
              )}
            />
          )}

          {datos?.paginacion?.paginas > 1 && (
            <nav className="fila-entre" style={{ marginTop: 16 }} aria-label="Paginación">
              <span className="suave pequeno">
                Página {pagina} de {datos.paginacion.paginas}
              </span>
              <div className="fila">
                <button
                  type="button"
                  className="btn btn-borde btn-sm"
                  disabled={pagina <= 1}
                  onClick={() => cambiarParam('page', String(pagina - 1))}
                >
                  Anterior
                </button>
                <button
                  type="button"
                  className="btn btn-borde btn-sm"
                  disabled={pagina >= datos.paginacion.paginas}
                  onClick={() => cambiarParam('page', String(pagina + 1))}
                >
                  Siguiente
                </button>
              </div>
            </nav>
          )}
        </section>
      </div>

      <Modal abierto={filtrosMovil} alCerrar={() => setFiltrosMovil(false)} titulo="Filtros">
        <Filtros key={consulta} valores={valores} alAplicar={aplicar} tipos={tipos} destinos={destinos} ciudades={ciudades || []} />
      </Modal>
    </div>
  );
}
