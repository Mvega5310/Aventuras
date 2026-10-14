import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import Icono from '../components/Icono.jsx';
import { Pie } from '../components/Layout.jsx';
import { Calificacion, Logo, Verificada } from '../components/ui.jsx';
import { useCatalogos, useDatos } from '../util.js';

const motivos = [
  {
    titulo: 'Registro legal verificado',
    texto: 'Revisamos el RNT y los documentos de cada agencia antes de publicarla.',
  },
  {
    titulo: 'Reseñas de viajes reales',
    texto: 'Solo opinan clientes que presentaron el comprobante de su viaje.',
  },
  {
    titulo: 'Contacto directo',
    texto: 'Pide tu cotización o escribe por WhatsApp sin intermediarios.',
  },
];

export default function Inicio() {
  const navegar = useNavigate();
  const { tipos, destinos } = useCatalogos();
  const { datos: destacadas } = useDatos('/agencias?limit=3');
  const [filtros, setFiltros] = useState({ destino: '', tipo: '', precio_max: '' });

  const buscar = (e) => {
    e.preventDefault();
    const p = new URLSearchParams(Object.entries(filtros).filter(([, v]) => v));
    navegar(`/agencias?${p}`);
  };
  const cambiar = (campo) => (e) => setFiltros((f) => ({ ...f, [campo]: e.target.value }));
  const populares = destinos.filter((d) => d.es_nacional).slice(0, 6);

  return (
    <>
      <section className="hero">
        <div className="contenedor">
          <p className="hero-antetitulo">Agencias de viaje verificadas en Colombia</p>
          <h1>Viaja con agencias en las que sí puedes confiar</h1>
          <p>
            Comparamos agencias con registro legal vigente y calificaciones de clientes que de verdad
            viajaron con ellas.
          </p>
        </div>
      </section>

      <div className="contenedor">
        <form className="buscador" onSubmit={buscar} role="search">
          <div className="campo">
            <label htmlFor="b-destino">¿A dónde quieres ir?</label>
            <select id="b-destino" value={filtros.destino} onChange={cambiar('destino')}>
              <option value="">Cualquier destino</option>
              {destinos.map((d) => (
                <option key={d.id} value={d.slug}>
                  {d.nombre}
                  {d.es_nacional ? '' : ` (${d.pais})`}
                </option>
              ))}
            </select>
          </div>
          <div className="campo">
            <label htmlFor="b-tipo">Tipo de viaje</label>
            <select id="b-tipo" value={filtros.tipo} onChange={cambiar('tipo')}>
              <option value="">Cualquiera</option>
              {tipos.map((t) => (
                <option key={t.id} value={t.slug}>
                  {t.nombre}
                </option>
              ))}
            </select>
          </div>
          <div className="campo solo-pc">
            <label htmlFor="b-precio">Presupuesto por persona</label>
            <select id="b-precio" value={filtros.precio_max} onChange={cambiar('precio_max')}>
              <option value="">Cualquiera</option>
              <option value="1000000">Hasta $1.000.000</option>
              <option value="2000000">Hasta $2.000.000</option>
              <option value="3000000">Hasta $3.000.000</option>
              <option value="5000000">Hasta $5.000.000</option>
            </select>
          </div>
          <div className="solo-pc" />
          <button type="submit" className="btn btn-primario">
            <Icono nombre="buscar" tamano={18} />
            Buscar agencias
          </button>
        </form>

        <section className="seccion">
          <h2 className="seccion-titulo">Elige tu tipo de viaje</h2>
          <div className="chips">
            {tipos.map((t) => (
              <Link key={t.id} to={`/agencias?tipo=${t.slug}`} className="chip">
                {t.nombre}
              </Link>
            ))}
          </div>
        </section>

        <section className="seccion" aria-labelledby="t-destinos">
          <div className="fila-entre" style={{ marginBottom: 20 }}>
            <h2 id="t-destinos" className="seccion-titulo" style={{ margin: 0 }}>
              Destinos populares
            </h2>
            <Link to="/agencias" style={{ fontWeight: 600 }}>
              Ver todas las agencias
            </Link>
          </div>
          <div className="rejilla" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(170px, 1fr))' }}>
            {populares.map((d) => (
              <Link key={d.id} to={`/agencias?destino=${d.slug}`} className="tarjeta tarjeta-enlace" style={{ padding: 0, overflow: 'hidden', gap: 0 }}>
                <div className="foto" style={{ height: 110 }}>
                  [Foto de {d.nombre}]
                </div>
                <div style={{ padding: '12px 14px' }}>
                  <div style={{ fontWeight: 700 }}>{d.nombre}</div>
                  <div className="suave pequeno">{d.region}</div>
                </div>
              </Link>
            ))}
          </div>
        </section>

        {destacadas?.datos?.length > 0 && (
          <section className="seccion" aria-labelledby="t-mejores">
            <h2 id="t-mejores" className="seccion-titulo">
              Agencias mejor calificadas
            </h2>
            <div className="rejilla">
              {destacadas.datos.map((a) => (
                <Link key={a.id} to={`/agencias/${a.slug}`} className="tarjeta tarjeta-enlace">
                  <div className="fila" style={{ flexWrap: 'nowrap' }}>
                    <Logo url={a.logo_url} nombre={a.nombre_comercial} />
                    <div>
                      <div style={{ fontWeight: 700, fontSize: 17 }}>{a.nombre_comercial}</div>
                      <div className="suave">{a.ciudad}</div>
                    </div>
                  </div>
                  <div className="fila">
                    <Calificacion valor={a.calificacion_promedio} total={a.total_resenas} />
                    <Verificada />
                  </div>
                </Link>
              ))}
            </div>
          </section>
        )}

        <section className="seccion" aria-labelledby="t-confianza">
          <h2 id="t-confianza" className="seccion-titulo">
            Cómo verificamos
          </h2>
          <div className="rejilla">
            {motivos.map((m) => (
              <div key={m.titulo} className="tarjeta pila-sm">
                <span className="logo" style={{ width: 40, height: 40, borderRadius: 10 }}>
                  <Icono nombre="escudo" color="#0E7C86" />
                </span>
                <h3 style={{ fontSize: 18, marginTop: 4 }}>{m.titulo}</h3>
                <p className="suave" style={{ margin: 0 }}>
                  {m.texto}
                </p>
              </div>
            ))}
          </div>
        </section>
      </div>
      <Pie />
    </>
  );
}
