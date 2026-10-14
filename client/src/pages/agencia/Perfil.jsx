import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Alerta, Campo, Estado, Logo } from '../../components/ui.jsx';
import { abrirArchivo, api, subirArchivo } from '../../api.js';
import { useAuth } from '../../auth.jsx';
import { etiquetasDocumento, fecha, useCatalogos } from '../../util.js';

const deptos = [
  'Amazonas', 'Antioquia', 'Arauca', 'Atlántico', 'Bogotá D.C.', 'Bolívar', 'Boyacá', 'Caldas',
  'Caquetá', 'Casanare', 'Cauca', 'Cesar', 'Chocó', 'Córdoba', 'Cundinamarca', 'Guainía',
  'Guaviare', 'Huila', 'La Guajira', 'Magdalena', 'Meta', 'Nariño', 'Norte de Santander',
  'Putumayo', 'Quindío', 'Risaralda', 'San Andrés y Providencia', 'Santander', 'Sucre', 'Tolima',
  'Valle del Cauca', 'Vaupés', 'Vichada',
];

function inicial(a) {
  return {
    razon_social: a?.razon_social || '',
    nombre_comercial: a?.nombre_comercial || '',
    nit: a?.nit || '',
    rnt: a?.rnt || '',
    rnt_vigente_hasta: a?.rnt_vigente_hasta || '',
    descripcion: a?.descripcion || '',
    ciudad: a?.ciudad || '',
    departamento: a?.departamento || '',
    direccion: a?.direccion || '',
    telefono: a?.telefono || '',
    whatsapp: a?.whatsapp || '',
    email_contacto: a?.email_contacto || '',
    sitio_web: a?.sitio_web || '',
    logo_url: a?.logo_url || '',
    anio_fundacion: a?.anio_fundacion || '',
    tipos: a?.tipos || [],
    destinos: a?.destinos || [],
  };
}

function Documentos({ agencia, alCambiar }) {
  const [tipo, setTipo] = useState('rnt');
  const [archivo, setArchivo] = useState(null);
  const [estado, setEstado] = useState({ enviando: false, error: '', ok: '' });

  const enviar = async (e) => {
    e.preventDefault();
    if (!archivo) return setEstado({ error: 'Elige el archivo del documento' });
    setEstado({ enviando: true });
    try {
      const subido = await subirArchivo(archivo);
      await api.post('/mi-agencia/verificaciones', { tipo, documento_url: subido.url });
      setArchivo(null);
      e.target.reset();
      setEstado({ ok: 'Documento enviado. Lo revisaremos pronto.' });
      alCambiar();
    } catch (err) {
      setEstado({ error: err.message });
    }
  };

  const rntAprobado = agencia.verificaciones.some((v) => v.tipo === 'rnt' && v.estado === 'aprobada');

  return (
    <section className="tarjeta pila">
      <div>
        <h2>Documentos de verificación</h2>
        <p className="suave" style={{ margin: '4px 0 0' }}>
          El certificado de RNT vigente es obligatorio para aparecer en el directorio. Solo nuestro equipo ve estos archivos.
        </p>
      </div>
      {!rntAprobado && agencia.verificaciones.every((v) => v.tipo !== 'rnt') && (
        <Alerta tipo="aviso">Aún no has subido tu certificado de RNT.</Alerta>
      )}
      {agencia.verificaciones.length > 0 && (
        <div className="lista-tarjetas">
          {agencia.verificaciones.map((v) => (
            <div key={v.id} className="fila-entre" style={{ border: '1px solid var(--linea)', borderRadius: 12, padding: 12 }}>
              <div>
                <strong>{etiquetasDocumento[v.tipo]}</strong>
                <div className="suave pequeno">
                  Enviado {fecha(v.created_at)}
                  {v.notas ? ` · ${v.notas}` : ''}
                </div>
              </div>
              <div className="fila">
                <Estado valor={v.estado} />
                {v.documento_url && (
                  <button type="button" className="btn btn-fantasma btn-sm" onClick={() => abrirArchivo(v.documento_url).catch(() => {})}>
                    Ver
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
      <form className="form-rejilla" onSubmit={enviar} style={{ alignItems: 'end' }}>
        <Campo etiqueta="Tipo de documento">
          {(p) => (
            <select {...p} value={tipo} onChange={(e) => setTipo(e.target.value)}>
              {Object.entries(etiquetasDocumento).map(([v, t]) => (
                <option key={v} value={v}>
                  {t}
                </option>
              ))}
            </select>
          )}
        </Campo>
        <Campo etiqueta="Archivo (PDF o imagen)">
          {(p) => <input {...p} type="file" accept="application/pdf,image/jpeg,image/png,image/webp" onChange={(e) => setArchivo(e.target.files[0] || null)} />}
        </Campo>
        <button type="submit" className="btn btn-oscuro" disabled={estado.enviando}>
          {estado.enviando ? 'Subiendo…' : 'Enviar documento'}
        </button>
        <div className="ancho-completo">
          <Alerta>{estado.error}</Alerta>
          <Alerta tipo="exito">{estado.ok}</Alerta>
        </div>
      </form>
    </section>
  );
}

export default function PerfilAgencia({ agencia, alGuardar }) {
  const { refrescar } = useAuth();
  const navegar = useNavigate();
  const { tipos, destinos } = useCatalogos();
  const [f, setF] = useState(() => inicial(agencia));
  const [logo, setLogo] = useState(null);
  const [estado, setEstado] = useState({ enviando: false, error: '', ok: '', errores: {} });
  const bloqueado = Boolean(agencia?.verificada);

  const cambiar = (c) => (e) => setF((v) => ({ ...v, [c]: e.target.value }));
  const alternar = (c, id) => () =>
    setF((v) => ({ ...v, [c]: v[c].includes(id) ? v[c].filter((x) => x !== id) : [...v[c], id] }));

  const guardar = async (e) => {
    e.preventDefault();
    setEstado({ enviando: true, errores: {} });
    try {
      let logo_url = f.logo_url || null;
      if (logo) logo_url = (await subirArchivo(logo, { publico: true })).url;
      const cuerpo = {
        ...f,
        logo_url,
        rnt_vigente_hasta: f.rnt_vigente_hasta || null,
        anio_fundacion: f.anio_fundacion ? Number(f.anio_fundacion) : null,
      };
      if (agencia) await api.put('/mi-agencia', cuerpo);
      else await api.post('/mi-agencia', cuerpo);
      setLogo(null);
      setEstado({ ok: agencia ? 'Cambios guardados' : '' });
      await refrescar();
      alGuardar();
      // Recién creada: lleva al paso 2 (documentos)
      if (!agencia) navegar('/panel/perfil');
    } catch (err) {
      setEstado({ error: err.message, errores: err.porCampo || {} });
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  const er = estado.errores || {};
  return (
    <div className="pila" style={{ gap: 24 }}>
      <div>
        <h1 className="panel-titulo">{agencia ? 'Perfil y documentos' : 'Registra los datos de tu agencia'}</h1>
        {!agencia && (
          <p className="suave" style={{ margin: '6px 0 0' }}>
            Paso 1 de 2: completa tus datos. Paso 2: sube tu certificado de RNT para la verificación.
          </p>
        )}
      </div>
      <Alerta>{estado.error}</Alerta>
      <Alerta tipo="exito">{estado.ok}</Alerta>

      <form className="pila" style={{ gap: 24 }} onSubmit={guardar} noValidate>
        <section className="tarjeta pila">
          <h2>Datos legales</h2>
          {bloqueado && (
            <Alerta tipo="info">Tu agencia ya está verificada. Para cambiar razón social, NIT o RNT escríbenos a soporte.</Alerta>
          )}
          <div className="form-rejilla">
            <Campo etiqueta="Razón social" error={er.razon_social}>
              {(p) => <input {...p} required disabled={bloqueado} value={f.razon_social} onChange={cambiar('razon_social')} />}
            </Campo>
            <Campo etiqueta="NIT" error={er.nit} ayuda="Ej. 900123456-7">
              {(p) => <input {...p} required disabled={bloqueado} value={f.nit} onChange={cambiar('nit')} />}
            </Campo>
            <Campo etiqueta="Número de RNT" error={er.rnt}>
              {(p) => <input {...p} required inputMode="numeric" disabled={bloqueado} value={f.rnt} onChange={cambiar('rnt')} />}
            </Campo>
            <Campo etiqueta="RNT vigente hasta" error={er.rnt_vigente_hasta}>
              {(p) => <input {...p} type="date" value={f.rnt_vigente_hasta} onChange={cambiar('rnt_vigente_hasta')} />}
            </Campo>
          </div>
        </section>

        <section className="tarjeta pila">
          <h2>Perfil público</h2>
          <div className="fila" style={{ flexWrap: 'nowrap' }}>
            <Logo url={f.logo_url} nombre={f.nombre_comercial || 'A'} />
            <Campo etiqueta="Logo (opcional)" className="flex-1">
              {(p) => <input {...p} type="file" accept="image/jpeg,image/png,image/webp" onChange={(e) => setLogo(e.target.files[0] || null)} />}
            </Campo>
          </div>
          <div className="form-rejilla">
            <Campo etiqueta="Nombre comercial" error={er.nombre_comercial}>
              {(p) => <input {...p} required value={f.nombre_comercial} onChange={cambiar('nombre_comercial')} />}
            </Campo>
            <Campo etiqueta="Año de fundación" error={er.anio_fundacion}>
              {(p) => <input {...p} type="number" min="1900" max="2100" value={f.anio_fundacion} onChange={cambiar('anio_fundacion')} />}
            </Campo>
            <Campo etiqueta="Ciudad" error={er.ciudad}>
              {(p) => <input {...p} required value={f.ciudad} onChange={cambiar('ciudad')} />}
            </Campo>
            <Campo etiqueta="Departamento" error={er.departamento}>
              {(p) => (
                <select {...p} required value={f.departamento} onChange={cambiar('departamento')}>
                  <option value="">Elige uno</option>
                  {deptos.map((d) => (
                    <option key={d}>{d}</option>
                  ))}
                </select>
              )}
            </Campo>
            <Campo etiqueta="Dirección" error={er.direccion}>
              {(p) => <input {...p} value={f.direccion} onChange={cambiar('direccion')} />}
            </Campo>
            <Campo etiqueta="WhatsApp" error={er.whatsapp} ayuda="Ej. 300 123 4567">
              {(p) => <input {...p} type="tel" value={f.whatsapp} onChange={cambiar('whatsapp')} />}
            </Campo>
            <Campo etiqueta="Teléfono fijo" error={er.telefono}>
              {(p) => <input {...p} type="tel" value={f.telefono} onChange={cambiar('telefono')} />}
            </Campo>
            <Campo etiqueta="Correo de contacto" error={er.email_contacto}>
              {(p) => <input {...p} type="email" value={f.email_contacto} onChange={cambiar('email_contacto')} />}
            </Campo>
            <Campo etiqueta="Sitio web" error={er.sitio_web} ayuda="Incluye https://">
              {(p) => <input {...p} type="url" value={f.sitio_web} onChange={cambiar('sitio_web')} />}
            </Campo>
          </div>
          <Campo etiqueta="Descripción" error={er.descripcion}>
            {(p) => <textarea {...p} rows={4} maxLength={3000} value={f.descripcion} onChange={cambiar('descripcion')} />}
          </Campo>
          <fieldset className="campo" style={{ border: 0, padding: 0, margin: 0 }}>
            <legend className="etiqueta" style={{ padding: 0, marginBottom: 8 }}>
              Tipos de viaje que ofreces
            </legend>
            <div className="opciones">
              {tipos.map((t) => (
                <button key={t.id} type="button" className="chip" aria-pressed={f.tipos.includes(t.id)} onClick={alternar('tipos', t.id)}>
                  {t.nombre}
                </button>
              ))}
            </div>
          </fieldset>
          <fieldset className="campo" style={{ border: 0, padding: 0, margin: 0 }}>
            <legend className="etiqueta" style={{ padding: 0, marginBottom: 8 }}>
              Destinos donde operas
            </legend>
            <div className="opciones">
              {destinos.map((d) => (
                <button key={d.id} type="button" className="chip" aria-pressed={f.destinos.includes(d.id)} onClick={alternar('destinos', d.id)}>
                  {d.nombre}
                </button>
              ))}
            </div>
          </fieldset>
        </section>

        <button type="submit" className="btn btn-primario" style={{ alignSelf: 'flex-start' }} disabled={estado.enviando}>
          {estado.enviando ? 'Guardando…' : agencia ? 'Guardar cambios' : 'Guardar y continuar'}
        </button>
      </form>

      {agencia && <Documentos agencia={agencia} alCambiar={alGuardar} />}
    </div>
  );
}
