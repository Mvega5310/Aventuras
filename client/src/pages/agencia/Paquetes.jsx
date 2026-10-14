import { useState } from 'react';
import Icono from '../../components/Icono.jsx';
import { Alerta, Campo, Cargando, DatoFila, ErrorCarga, Modal, TablaTarjetas, Vacio } from '../../components/ui.jsx';
import { api, subirArchivo } from '../../api.js';
import { precio, useCatalogos, useDatos } from '../../util.js';

const vacio = {
  titulo: '',
  destino_id: '',
  tipo_viaje_id: '',
  precio_desde: '',
  moneda: 'COP',
  duracion_dias: '',
  descripcion: '',
  incluye: '',
  no_incluye: '',
  imagen_url: '',
  activo: true,
};

const aLista = (texto) =>
  texto
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean);

function FormPaquete({ paquete, alGuardar }) {
  const { tipos, destinos } = useCatalogos();
  const [f, setF] = useState(
    paquete
      ? {
          ...vacio,
          ...paquete,
          tipo_viaje_id: paquete.tipo_viaje_id ?? '',
          precio_desde: paquete.precio_desde ?? '',
          duracion_dias: paquete.duracion_dias ?? '',
          descripcion: paquete.descripcion ?? '',
          imagen_url: paquete.imagen_url ?? '',
          incluye: (paquete.incluye || []).join('\n'),
          no_incluye: (paquete.no_incluye || []).join('\n'),
        }
      : vacio,
  );
  const [imagen, setImagen] = useState(null);
  const [estado, setEstado] = useState({ enviando: false, error: '', errores: {} });
  const cambiar = (c) => (e) => setF((v) => ({ ...v, [c]: e.target.type === 'checkbox' ? e.target.checked : e.target.value }));

  const enviar = async (e) => {
    e.preventDefault();
    setEstado({ enviando: true, error: '', errores: {} });
    try {
      let imagen_url = f.imagen_url || null;
      if (imagen) imagen_url = (await subirArchivo(imagen, { publico: true })).url;
      const cuerpo = {
        titulo: f.titulo,
        destino_id: Number(f.destino_id),
        tipo_viaje_id: f.tipo_viaje_id ? Number(f.tipo_viaje_id) : null,
        precio_desde: f.precio_desde === '' ? null : Number(f.precio_desde),
        moneda: f.moneda,
        duracion_dias: f.duracion_dias === '' ? null : Number(f.duracion_dias),
        descripcion: f.descripcion,
        incluye: aLista(f.incluye),
        no_incluye: aLista(f.no_incluye),
        imagen_url,
        activo: f.activo,
      };
      if (paquete) await api.put(`/mi-agencia/paquetes/${paquete.id}`, cuerpo);
      else await api.post('/mi-agencia/paquetes', cuerpo);
      alGuardar();
    } catch (err) {
      setEstado({ enviando: false, error: err.message, errores: err.porCampo || {} });
    }
  };

  const er = estado.errores || {};
  return (
    <form className="pila" onSubmit={enviar} noValidate>
      <Alerta>{estado.error}</Alerta>
      <Campo etiqueta="Nombre del paquete" error={er.titulo}>
        {(p) => <input {...p} required maxLength={140} value={f.titulo} onChange={cambiar('titulo')} />}
      </Campo>
      <div className="form-rejilla">
        <Campo etiqueta="Destino" error={er.destino_id}>
          {(p) => (
            <select {...p} required value={f.destino_id} onChange={cambiar('destino_id')}>
              <option value="">Elige un destino</option>
              {destinos.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.nombre}
                </option>
              ))}
            </select>
          )}
        </Campo>
        <Campo etiqueta="Tipo de viaje">
          {(p) => (
            <select {...p} value={f.tipo_viaje_id} onChange={cambiar('tipo_viaje_id')}>
              <option value="">Sin especificar</option>
              {tipos.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.nombre}
                </option>
              ))}
            </select>
          )}
        </Campo>
        <Campo etiqueta="Precio desde (por persona)" error={er.precio_desde}>
          {(p) => <input {...p} type="number" min="0" step="1000" inputMode="numeric" value={f.precio_desde} onChange={cambiar('precio_desde')} />}
        </Campo>
        <Campo etiqueta="Moneda">
          {(p) => (
            <select {...p} value={f.moneda} onChange={cambiar('moneda')}>
              <option value="COP">COP</option>
              <option value="USD">USD</option>
              <option value="EUR">EUR</option>
            </select>
          )}
        </Campo>
        <Campo etiqueta="Duración (días)" error={er.duracion_dias}>
          {(p) => <input {...p} type="number" min="1" max="365" value={f.duracion_dias} onChange={cambiar('duracion_dias')} />}
        </Campo>
      </div>
      <Campo etiqueta="Descripción">
        {(p) => <textarea {...p} rows={3} maxLength={3000} value={f.descripcion} onChange={cambiar('descripcion')} />}
      </Campo>
      <div className="form-rejilla">
        <Campo etiqueta="Incluye" ayuda="Uno por línea">
          {(p) => <textarea {...p} rows={4} value={f.incluye} onChange={cambiar('incluye')} placeholder={'Alojamiento\nTraslados'} />}
        </Campo>
        <Campo etiqueta="No incluye" ayuda="Uno por línea">
          {(p) => <textarea {...p} rows={4} value={f.no_incluye} onChange={cambiar('no_incluye')} placeholder="Tiquetes aéreos" />}
        </Campo>
      </div>
      <Campo etiqueta="Foto del paquete (opcional)" ayuda="JPG, PNG o WEBP, máx. 5 MB">
        {(p) => <input {...p} type="file" accept="image/jpeg,image/png,image/webp" onChange={(e) => setImagen(e.target.files[0] || null)} />}
      </Campo>
      <label className="casilla">
        <input type="checkbox" checked={f.activo} onChange={cambiar('activo')} />
        Publicado (visible en tu perfil)
      </label>
      <button type="submit" className="btn btn-primario" disabled={estado.enviando}>
        {estado.enviando ? 'Guardando…' : 'Guardar paquete'}
      </button>
    </form>
  );
}

export default function PaquetesAgencia() {
  const { datos, error, cargando, recargar } = useDatos('/mi-agencia/paquetes');
  const [editando, setEditando] = useState(null); // null | 'nuevo' | paquete
  const [aviso, setAviso] = useState('');

  const eliminar = async (p) => {
    if (!window.confirm(`¿Eliminar "${p.titulo}"? Esta acción no se puede deshacer.`)) return;
    try {
      await api.delete(`/mi-agencia/paquetes/${p.id}`);
      recargar();
    } catch (err) {
      setAviso(err.message);
    }
  };

  const botones = (p, movil) => (
    <>
      <button type="button" className={`btn btn-borde ${movil ? '' : 'btn-sm'}`} style={movil ? { flex: 1 } : undefined} onClick={() => setEditando(p)}>
        <Icono nombre="editar" tamano={16} /> Editar
      </button>
      <button type="button" className={`btn btn-peligro ${movil ? '' : 'btn-sm'}`} onClick={() => eliminar(p)} aria-label={`Eliminar ${p.titulo}`}>
        <Icono nombre="basura" tamano={16} />
      </button>
    </>
  );

  return (
    <div className="pila">
      <div className="fila-entre">
        <h1 className="panel-titulo">Paquetes</h1>
        <button type="button" className="btn btn-primario" onClick={() => setEditando('nuevo')}>
          <Icono nombre="mas" tamano={18} /> Nuevo paquete
        </button>
      </div>
      <Alerta>{aviso}</Alerta>

      {cargando && !datos ? (
        <Cargando />
      ) : error ? (
        <ErrorCarga error={error} reintentar={recargar} />
      ) : datos.length === 0 ? (
        <Vacio titulo="Aún no tienes paquetes">Publica tus planes con precio para aparecer en las búsquedas por presupuesto.</Vacio>
      ) : (
        <TablaTarjetas
          etiqueta="Paquetes"
          filas={datos}
          columnas={[
            { titulo: 'Paquete', celda: (p) => <strong>{p.titulo}</strong> },
            { titulo: 'Destino', celda: (p) => p.destino },
            { titulo: 'Duración', celda: (p) => (p.duracion_dias ? `${p.duracion_dias} días` : '—') },
            { titulo: 'Desde', celda: (p) => precio(p.precio_desde, p.moneda) },
            {
              titulo: 'Estado',
              celda: (p) => (
                <span className={`insignia ${p.activo ? 'insignia-verde' : 'insignia-gris'}`}>{p.activo ? 'Publicado' : 'Oculto'}</span>
              ),
            },
            { titulo: '', alinear: 'right', celda: (p) => <div className="acciones">{botones(p)}</div> },
          ]}
          tarjeta={(p) => (
            <>
              <div className="fila-entre">
                <strong style={{ fontSize: 16 }}>{p.titulo}</strong>
                <span className={`insignia ${p.activo ? 'insignia-verde' : 'insignia-gris'}`}>{p.activo ? 'Publicado' : 'Oculto'}</span>
              </div>
              <DatoFila etiqueta="Destino">{p.destino}</DatoFila>
              <DatoFila etiqueta="Duración">{p.duracion_dias ? `${p.duracion_dias} días` : '—'}</DatoFila>
              <DatoFila etiqueta="Desde">{precio(p.precio_desde, p.moneda)}</DatoFila>
              <div className="fila" style={{ flexWrap: 'nowrap' }}>
                {botones(p, true)}
              </div>
            </>
          )}
        />
      )}

      <Modal abierto={Boolean(editando)} alCerrar={() => setEditando(null)} titulo={editando === 'nuevo' ? 'Nuevo paquete' : 'Editar paquete'}>
        {editando && (
          <FormPaquete
            paquete={editando === 'nuevo' ? null : editando}
            alGuardar={() => {
              setEditando(null);
              recargar();
            }}
          />
        )}
      </Modal>
    </div>
  );
}
