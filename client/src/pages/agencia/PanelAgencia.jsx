import { Link, Route, Routes } from 'react-router-dom';
import Panel, { Kpi } from '../../components/Panel.jsx';
import { Alerta, Cargando, ErrorCarga } from '../../components/ui.jsx';
import { calificacion, fecha, useDatos } from '../../util.js';
import SolicitudesAgencia from './Solicitudes.jsx';
import PaquetesAgencia from './Paquetes.jsx';
import ResenasAgencia from './Resenas.jsx';
import PerfilAgencia from './Perfil.jsx';

function AvisoEstado({ agencia }) {
  if (agencia.estado === 'activa') return null;
  const textos = {
    pendiente: [
      'aviso',
      'Tu agencia está en revisión. Asegúrate de haber subido tu RNT en "Perfil y documentos"; te publicaremos cuando lo verifiquemos.',
    ],
    rechazada: [
      'error',
      `No pudimos verificar tu agencia${agencia.notas_revision ? `: ${agencia.notas_revision}` : ''}. Corrige tus datos o documentos y se enviará de nuevo a revisión.`,
    ],
    suspendida: [
      'error',
      `Tu agencia está suspendida y no aparece en el directorio${agencia.notas_revision ? `: ${agencia.notas_revision}` : ''}. Escríbenos para resolverlo.`,
    ],
  };
  const [tipo, texto] = textos[agencia.estado] || [];
  return <Alerta tipo={tipo}>{texto}</Alerta>;
}

function Resumen({ agencia }) {
  const { datos: r, error, cargando, recargar } = useDatos('/mi-agencia/resumen');
  if (cargando && !r) return <Cargando />;
  if (error) return <ErrorCarga error={error} reintentar={recargar} />;

  const diasRnt = r.rnt_vigente_hasta
    ? Math.ceil((new Date(`${r.rnt_vigente_hasta}T12:00:00`) - new Date()) / 86_400_000)
    : null;

  return (
    <div className="pila" style={{ gap: 24 }}>
      <div className="fila-entre">
        <div>
          <h1 className="panel-titulo">Hola, {agencia.nombre_comercial}</h1>
          <p className="suave" style={{ margin: '6px 0 0' }}>
            Gestiona tus solicitudes, paquetes y reseñas.
          </p>
        </div>
        {r.estado === 'activa' && (
          <Link to={`/agencias/${r.slug}`} className="btn btn-borde">
            Ver mi perfil público
          </Link>
        )}
      </div>
      <AvisoEstado agencia={agencia} />
      {diasRnt !== null && diasRnt <= 30 && (
        <Alerta tipo="aviso">
          {diasRnt < 0
            ? 'Tu RNT está vencido. Renuévalo y sube el nuevo certificado.'
            : `Tu RNT vence en ${diasRnt} días (${fecha(r.rnt_vigente_hasta)}).`}
        </Alerta>
      )}
      <div className="kpis">
        <Kpi titulo="Solicitudes nuevas" valor={r.solicitudes_nuevas} nota={`${r.solicitudes_total} en total`} />
        <Kpi titulo="Calificación" valor={r.total_resenas ? calificacion(r.calificacion_promedio) : '—'} nota={`${r.total_resenas} reseñas`} />
        <Kpi titulo="Reseñas sin responder" valor={r.resenas_sin_respuesta} />
        <Kpi titulo="Paquetes activos" valor={r.paquetes_activos} nota={`Plan ${r.plan}`} />
      </div>
      <div className="rejilla">
        <Link to="/panel/solicitudes" className="tarjeta tarjeta-enlace">
          <h2>Responder solicitudes</h2>
          <span className="suave">Contesta rápido: los viajeros eligen a quien responde primero.</span>
        </Link>
        <Link to="/panel/paquetes" className="tarjeta tarjeta-enlace">
          <h2>Publicar paquetes</h2>
          <span className="suave">Los paquetes con precio aparecen en los filtros de presupuesto.</span>
        </Link>
        <Link to="/panel/resenas" className="tarjeta tarjeta-enlace">
          <h2>Responder reseñas</h2>
          <span className="suave">Responder a tus clientes mejora la confianza en tu agencia.</span>
        </Link>
      </div>
    </div>
  );
}

export default function PanelAgencia() {
  const { datos: agencia, error, cargando, recargar } = useDatos('/mi-agencia');
  const { datos: resumen } = useDatos(agencia ? '/mi-agencia/resumen' : null, [agencia?.updated_at]);

  if (cargando && agencia === null && !error) return <Cargando />;
  if (error) return <div className="contenedor pagina"><ErrorCarga error={error} reintentar={recargar} /></div>;

  // Primera vez: registrar los datos de la agencia
  if (!agencia) {
    return (
      <div className="contenedor pagina" style={{ maxWidth: 900 }}>
        <PerfilAgencia agencia={null} alGuardar={recargar} />
      </div>
    );
  }

  const enlaces = [
    { a: '/panel', texto: 'Resumen', fin: true },
    { a: '/panel/solicitudes', texto: 'Solicitudes', contador: resumen?.solicitudes_nuevas },
    { a: '/panel/paquetes', texto: 'Paquetes' },
    { a: '/panel/resenas', texto: 'Reseñas', contador: resumen?.resenas_sin_respuesta },
    { a: '/panel/perfil', texto: 'Perfil y documentos' },
  ];

  return (
    <Panel etiqueta="Panel de agencia" enlaces={enlaces}>
      <Routes>
        <Route index element={<Resumen agencia={agencia} />} />
        <Route path="solicitudes" element={<SolicitudesAgencia />} />
        <Route path="paquetes" element={<PaquetesAgencia />} />
        <Route path="resenas" element={<ResenasAgencia />} />
        <Route path="perfil" element={<PerfilAgencia agencia={agencia} alGuardar={recargar} />} />
      </Routes>
    </Panel>
  );
}
