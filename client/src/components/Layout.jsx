import { Link, NavLink, Outlet, useNavigate } from 'react-router-dom';
import Icono from './Icono.jsx';
import { useAuth } from '../auth.jsx';

export function Marca() {
  return (
    <Link to="/" className="marca">
      <span className="marca-icono">
        <Icono nombre="escudo" color="#fff" />
      </span>
      <span className="marca-nombre">Rumbo Seguro</span>
    </Link>
  );
}

function enlacesPorRol(usuario) {
  if (!usuario) {
    return [
      { a: '/', texto: 'Inicio', icono: 'inicio', fin: true },
      { a: '/agencias', texto: 'Agencias', icono: 'buscar' },
      { a: '/ingresar', texto: 'Ingresar', icono: 'usuario' },
    ];
  }
  if (usuario.rol === 'agencia') {
    return [
      { a: '/agencias', texto: 'Directorio', icono: 'buscar' },
      { a: '/panel', texto: 'Mi panel', icono: 'grafico' },
    ];
  }
  if (usuario.rol === 'admin') {
    return [
      { a: '/agencias', texto: 'Directorio', icono: 'buscar' },
      { a: '/admin', texto: 'Administración', icono: 'escudo' },
    ];
  }
  return [
    { a: '/', texto: 'Inicio', icono: 'inicio', fin: true },
    { a: '/agencias', texto: 'Buscar', icono: 'buscar' },
    { a: '/favoritos', texto: 'Favoritos', icono: 'corazon' },
    { a: '/mis-viajes', texto: 'Mis viajes', icono: 'maleta' },
  ];
}

export default function Layout() {
  const { usuario, salir } = useAuth();
  const navegar = useNavigate();
  const enlaces = enlacesPorRol(usuario);

  const cerrarSesion = () => {
    salir();
    navegar('/');
  };

  return (
    <>
      <a href="#contenido" className="sr-only">
        Saltar al contenido
      </a>
      <header className="encabezado">
        <div className="contenedor">
          <Marca />
          <nav className="nav-principal solo-pc" aria-label="Principal">
            {enlaces
              .filter((e) => e.a !== '/ingresar')
              .map((e) => (
                <NavLink key={e.a} to={e.a} end={e.fin}>
                  {e.texto}
                </NavLink>
              ))}
            {!usuario && (
              <NavLink to="/registro?rol=agencia" className={() => ''}>
                Soy una agencia
              </NavLink>
            )}
            {usuario ? (
              <button type="button" className="btn btn-oscuro btn-sm" onClick={cerrarSesion}>
                Salir
              </button>
            ) : (
              <Link to="/ingresar" className="btn btn-oscuro btn-sm">
                Ingresar
              </Link>
            )}
          </nav>
          {usuario && (
            <button
              type="button"
              className="btn btn-fantasma btn-icono solo-movil"
              onClick={cerrarSesion}
              aria-label="Cerrar sesión"
            >
              <Icono nombre="salir" />
            </button>
          )}
        </div>
      </header>

      <main id="contenido" className="app-principal">
        <Outlet />
      </main>

      <nav className="barra-movil solo-movil" aria-label="Navegación inferior">
        {enlaces.map((e) => (
          <NavLink key={e.a} to={e.a} end={e.fin}>
            <Icono nombre={e.icono} tamano={22} />
            {e.texto}
          </NavLink>
        ))}
      </nav>
    </>
  );
}

export function Pie() {
  return (
    <footer className="pie">
      <div className="contenedor fila-entre">
        <span>© {new Date().getFullYear()} Rumbo Seguro · Agencias de viaje verificadas</span>
        <span>
          <Link to="/registro?rol=agencia" style={{ color: '#c9dce2' }}>
            Registra tu agencia
          </Link>
        </span>
      </div>
    </footer>
  );
}
