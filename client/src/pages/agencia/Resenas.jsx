import { useState } from 'react';
import { Alerta, Calificacion, Campo, Cargando, ErrorCarga, Vacio } from '../../components/ui.jsx';
import { api } from '../../api.js';
import { fecha, useDatos } from '../../util.js';

function Respuesta({ resena, alGuardar }) {
  const [abierta, setAbierta] = useState(!resena.respuesta);
  const [texto, setTexto] = useState(resena.respuesta || '');
  const [estado, setEstado] = useState({ enviando: false, error: '' });

  if (!abierta) {
    return (
      <div style={{ background: 'var(--fondo)', borderRadius: 10, padding: 12 }}>
        <div className="fila-entre pequeno">
          <strong>Tu respuesta</strong>
          <button type="button" className="btn btn-fantasma btn-sm" onClick={() => setAbierta(true)}>
            Editar
          </button>
        </div>
        <p style={{ margin: '4px 0 0', whiteSpace: 'pre-line' }}>{resena.respuesta}</p>
      </div>
    );
  }

  return (
    <form
      className="pila-sm"
      onSubmit={async (e) => {
        e.preventDefault();
        setEstado({ enviando: true, error: '' });
        try {
          await api.put(`/mi-agencia/resenas/${resena.id}/respuesta`, { texto });
          setAbierta(false);
          alGuardar();
        } catch (err) {
          setEstado({ error: err.message });
        }
      }}
    >
      <Alerta>{estado.error}</Alerta>
      <Campo etiqueta="Responder públicamente">
        {(p) => <textarea {...p} rows={3} maxLength={2000} value={texto} onChange={(e) => setTexto(e.target.value)} />}
      </Campo>
      <div className="fila">
        <button type="submit" className="btn btn-primario btn-sm" disabled={estado.enviando || !texto.trim()}>
          Publicar respuesta
        </button>
        {resena.respuesta && (
          <button type="button" className="btn btn-fantasma btn-sm" onClick={() => setAbierta(false)}>
            Cancelar
          </button>
        )}
      </div>
    </form>
  );
}

export default function ResenasAgencia() {
  const { datos, error, cargando, recargar } = useDatos('/mi-agencia/resenas');

  return (
    <div className="pila">
      <h1 className="panel-titulo">Reseñas</h1>
      <p className="suave" style={{ margin: 0 }}>
        Las reseñas vienen de clientes con viaje verificado. Tus respuestas son públicas.
      </p>
      {cargando && !datos ? (
        <Cargando />
      ) : error ? (
        <ErrorCarga error={error} reintentar={recargar} />
      ) : datos.length === 0 ? (
        <Vacio titulo="Aún no tienes reseñas publicadas">
          Invita a tus clientes a registrar su viaje en Rumbo Seguro para que puedan calificarte.
        </Vacio>
      ) : (
        <div className="lista-tarjetas">
          {datos.map((r) => (
            <article key={r.id} className="tarjeta pila-sm">
              <div className="fila-entre">
                <strong>{r.autor}</strong>
                <span className="suave pequeno">{fecha(r.created_at)}</span>
              </div>
              <div className="fila pequeno" style={{ gap: 14 }}>
                <Calificacion valor={r.calificacion_general} total={1} />
                <span className="suave">
                  Precio {r.calificacion_precio} · Atención {r.calificacion_atencion} · Cumplimiento {r.calificacion_cumplimiento}
                </span>
              </div>
              {r.titulo && <strong>{r.titulo}</strong>}
              <p style={{ margin: 0, whiteSpace: 'pre-line', color: 'var(--texto-2)' }}>{r.comentario}</p>
              <Respuesta resena={r} alGuardar={recargar} />
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
