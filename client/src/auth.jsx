import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { api, eventos, token } from './api.js';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [usuario, setUsuario] = useState(null);
  const [agencia, setAgencia] = useState(null);
  const [cargando, setCargando] = useState(Boolean(token.leer()));

  const refrescar = useCallback(async () => {
    if (!token.leer()) {
      setUsuario(null);
      setAgencia(null);
      setCargando(false);
      return;
    }
    try {
      const datos = await api.get('/auth/yo');
      setUsuario(datos.usuario);
      setAgencia(datos.agencia);
    } catch {
      token.borrar();
      setUsuario(null);
      setAgencia(null);
    } finally {
      setCargando(false);
    }
  }, []);

  useEffect(() => {
    refrescar();
  }, [refrescar]);

  const salir = useCallback(() => {
    token.borrar();
    setUsuario(null);
    setAgencia(null);
  }, []);

  useEffect(() => {
    eventos.addEventListener('sesion-vencida', salir);
    return () => eventos.removeEventListener('sesion-vencida', salir);
  }, [salir]);

  const entrar = useCallback(
    async (credenciales) => {
      const datos = await api.post('/auth/login', credenciales);
      token.guardar(datos.token);
      await refrescar();
      return datos.usuario;
    },
    [refrescar],
  );

  const registrarse = useCallback(
    async (datosRegistro) => {
      const datos = await api.post('/auth/registro', datosRegistro);
      token.guardar(datos.token);
      await refrescar();
      return datos.usuario;
    },
    [refrescar],
  );

  const valor = useMemo(
    () => ({ usuario, agencia, cargando, entrar, registrarse, salir, refrescar }),
    [usuario, agencia, cargando, entrar, registrarse, salir, refrescar],
  );

  return <AuthContext.Provider value={valor}>{children}</AuthContext.Provider>;
}

export const useAuth = () => useContext(AuthContext);

/** Ruta de inicio según el rol */
export const inicioPorRol = (rol) =>
  rol === 'admin' ? '/admin' : rol === 'agencia' ? '/panel' : '/mis-viajes';
