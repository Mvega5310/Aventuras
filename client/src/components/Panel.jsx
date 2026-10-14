import { NavLink } from 'react-router-dom';

/** Estructura de panel: menú lateral en PC y pestañas desplazables en móvil. */
export default function Panel({ etiqueta, enlaces, children }) {
  return (
    <div className="panel">
      <nav className="panel-menu" aria-label={etiqueta}>
        <div className="panel-etiqueta">{etiqueta}</div>
        {enlaces.map((e) => (
          <NavLink key={e.a} to={e.a} end={e.fin}>
            <span>{e.texto}</span>
            {e.contador > 0 && <span className="contador">{e.contador}</span>}
          </NavLink>
        ))}
      </nav>
      <div>
        <nav className="panel-tabs solo-movil" aria-label={etiqueta}>
          <div className="chips">
            {enlaces.map((e) => (
              <NavLink key={e.a} to={e.a} end={e.fin} className="chip">
                {e.texto}
                {e.contador > 0 ? ` (${e.contador})` : ''}
              </NavLink>
            ))}
          </div>
        </nav>
        <div className="panel-contenido">{children}</div>
      </div>
    </div>
  );
}

export function Kpi({ titulo, valor, nota }) {
  return (
    <div className="tarjeta">
      <div className="suave pequeno">{titulo}</div>
      <div className="kpi-valor">{valor}</div>
      {nota && <div className="suave pequeno">{nota}</div>}
    </div>
  );
}
