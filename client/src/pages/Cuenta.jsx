import { useState } from 'react';
import { Link, Navigate, useNavigate, useSearchParams } from 'react-router-dom';
import { Marca } from '../components/Layout.jsx';
import { Alerta, Campo } from '../components/ui.jsx';
import { inicioPorRol, useAuth } from '../auth.jsx';

// Solo se permite volver a rutas internas (evita redirecciones abiertas)
const destinoSeguro = (v) => (v && v.startsWith('/') && !v.startsWith('//') ? v : null);

function Envoltura({ titulo, subtitulo, children }) {
  return (
    <div className="contenedor pagina" style={{ maxWidth: 480 }}>
      <div className="tarjeta pila" style={{ padding: 28 }}>
        <Marca />
        <div>
          <h1 className="titulo-display" style={{ fontSize: 28 }}>
            {titulo}
          </h1>
          {subtitulo && (
            <p className="suave" style={{ margin: '6px 0 0' }}>
              {subtitulo}
            </p>
          )}
        </div>
        {children}
      </div>
    </div>
  );
}

export function Ingresar() {
  const { usuario, entrar } = useAuth();
  const [params] = useSearchParams();
  const navegar = useNavigate();
  const [f, setF] = useState({ email: '', password: '' });
  const [error, setError] = useState('');
  const [enviando, setEnviando] = useState(false);
  const volver = destinoSeguro(params.get('volver'));

  if (usuario) return <Navigate to={volver || inicioPorRol(usuario.rol)} replace />;

  const enviar = async (e) => {
    e.preventDefault();
    setEnviando(true);
    setError('');
    try {
      const u = await entrar(f);
      navegar(volver || inicioPorRol(u.rol), { replace: true });
    } catch (err) {
      setError(err.message);
    } finally {
      setEnviando(false);
    }
  };

  return (
    <Envoltura titulo="Ingresa a tu cuenta">
      <form className="pila" onSubmit={enviar}>
        <Alerta>{error}</Alerta>
        <Campo etiqueta="Correo">
          {(p) => (
            <input {...p} type="email" autoComplete="email" required value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} />
          )}
        </Campo>
        <Campo etiqueta="Contraseña">
          {(p) => (
            <input
              {...p}
              type="password"
              autoComplete="current-password"
              required
              value={f.password}
              onChange={(e) => setF({ ...f, password: e.target.value })}
            />
          )}
        </Campo>
        <button type="submit" className="btn btn-primario" disabled={enviando}>
          {enviando ? 'Ingresando…' : 'Ingresar'}
        </button>
        <p className="suave" style={{ margin: 0, textAlign: 'center' }}>
          ¿No tienes cuenta? <Link to={`/registro${volver ? `?volver=${encodeURIComponent(volver)}` : ''}`}>Regístrate</Link>
        </p>
      </form>
    </Envoltura>
  );
}

export function Registro() {
  const { usuario, registrarse } = useAuth();
  const [params] = useSearchParams();
  const navegar = useNavigate();
  const [rol, setRol] = useState(params.get('rol') === 'agencia' ? 'agencia' : 'viajero');
  const [f, setF] = useState({ nombre: '', email: '', telefono: '', password: '' });
  const [errores, setErrores] = useState({});
  const [error, setError] = useState('');
  const [enviando, setEnviando] = useState(false);
  const volver = destinoSeguro(params.get('volver'));

  if (usuario) return <Navigate to={inicioPorRol(usuario.rol)} replace />;

  const cambiar = (c) => (e) => setF((v) => ({ ...v, [c]: e.target.value }));
  const enviar = async (e) => {
    e.preventDefault();
    setEnviando(true);
    setError('');
    setErrores({});
    try {
      const u = await registrarse({ ...f, rol });
      navegar(rol === 'viajero' && volver ? volver : inicioPorRol(u.rol), { replace: true });
    } catch (err) {
      setError(err.message);
      setErrores(err.porCampo || {});
    } finally {
      setEnviando(false);
    }
  };

  return (
    <Envoltura
      titulo={rol === 'agencia' ? 'Registra tu agencia' : 'Crea tu cuenta'}
      subtitulo={
        rol === 'agencia'
          ? 'Después completarás los datos legales y subirás tu RNT para la verificación.'
          : 'Guarda agencias, pide cotizaciones y deja reseñas de tus viajes.'
      }
    >
      <div className="chips" role="group" aria-label="Tipo de cuenta">
        <button type="button" className="chip" aria-pressed={rol === 'viajero'} onClick={() => setRol('viajero')}>
          Soy viajero
        </button>
        <button type="button" className="chip" aria-pressed={rol === 'agencia'} onClick={() => setRol('agencia')}>
          Soy una agencia
        </button>
      </div>
      <form className="pila" onSubmit={enviar} noValidate>
        <Alerta>{error}</Alerta>
        <Campo etiqueta={rol === 'agencia' ? 'Nombre del responsable' : 'Nombre completo'} error={errores.nombre}>
          {(p) => <input {...p} autoComplete="name" required value={f.nombre} onChange={cambiar('nombre')} />}
        </Campo>
        <Campo etiqueta="Correo" error={errores.email}>
          {(p) => <input {...p} type="email" autoComplete="email" required value={f.email} onChange={cambiar('email')} />}
        </Campo>
        <Campo etiqueta="Celular (opcional)" error={errores.telefono}>
          {(p) => <input {...p} type="tel" autoComplete="tel" value={f.telefono} onChange={cambiar('telefono')} />}
        </Campo>
        <Campo etiqueta="Contraseña" error={errores.password} ayuda="Mínimo 8 caracteres">
          {(p) => (
            <input {...p} type="password" autoComplete="new-password" required minLength={8} value={f.password} onChange={cambiar('password')} />
          )}
        </Campo>
        <button type="submit" className="btn btn-primario" disabled={enviando}>
          {enviando ? 'Creando cuenta…' : 'Crear cuenta'}
        </button>
        <p className="suave" style={{ margin: 0, textAlign: 'center' }}>
          ¿Ya tienes cuenta? <Link to="/ingresar">Ingresa</Link>
        </p>
      </form>
    </Envoltura>
  );
}

export function NoEncontrada() {
  return (
    <div className="contenedor pagina">
      <div className="tarjeta vacio">
        <h1 className="titulo-display" style={{ fontSize: 28, marginBottom: 8 }}>
          Página no encontrada
        </h1>
        <p>El enlace puede estar roto o la página ya no existe.</p>
        <Link to="/" className="btn btn-primario">
          Ir al inicio
        </Link>
      </div>
    </div>
  );
}
