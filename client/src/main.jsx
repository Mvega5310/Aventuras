import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter, Navigate, Route, Routes, useLocation } from 'react-router-dom';
import './styles.css';
import { AuthProvider, useAuth } from './auth.jsx';
import Layout from './components/Layout.jsx';
import { Cargando } from './components/ui.jsx';
import Inicio from './pages/Inicio.jsx';
import Agencias from './pages/Agencias.jsx';
import AgenciaPerfil from './pages/AgenciaPerfil.jsx';
import { Ingresar, NoEncontrada, Registro } from './pages/Cuenta.jsx';
import { Favoritos, MisViajes } from './pages/MisViajes.jsx';
import PanelAgencia from './pages/agencia/PanelAgencia.jsx';
import PanelAdmin from './pages/admin/PanelAdmin.jsx';

/** Protege rutas por rol; sin sesión manda a ingresar y luego regresa. */
function Requiere({ rol, children }) {
  const { usuario, cargando } = useAuth();
  const ubicacion = useLocation();
  if (cargando) return <Cargando />;
  if (!usuario) return <Navigate to={`/ingresar?volver=${encodeURIComponent(ubicacion.pathname)}`} replace />;
  if (rol && usuario.rol !== rol) return <NoEncontrada />;
  return children;
}

function App() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route index element={<Inicio />} />
        <Route path="agencias" element={<Agencias />} />
        <Route path="agencias/:slug" element={<AgenciaPerfil />} />
        <Route path="ingresar" element={<Ingresar />} />
        <Route path="registro" element={<Registro />} />
        <Route path="mis-viajes" element={<Requiere rol="viajero"><MisViajes /></Requiere>} />
        <Route path="favoritos" element={<Requiere rol="viajero"><Favoritos /></Requiere>} />
        <Route path="panel/*" element={<Requiere rol="agencia"><PanelAgencia /></Requiere>} />
        <Route path="admin/*" element={<Requiere rol="admin"><PanelAdmin /></Requiere>} />
        <Route path="*" element={<NoEncontrada />} />
      </Route>
    </Routes>
  );
}

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <BrowserRouter>
      <AuthProvider>
        <App />
      </AuthProvider>
    </BrowserRouter>
  </StrictMode>,
);
