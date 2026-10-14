# Rumbo Seguro — Directorio verificado de agencias de viaje

Plataforma donde los viajeros comparan agencias de viaje **con registro legal verificado (RNT)** y
**reseñas solo de clientes que comprobaron su viaje**. "Rumbo Seguro" es un nombre provisional.

| Capa      | Tecnología                                               |
|-----------|----------------------------------------------------------|
| Frontend  | React 18 + Vite + React Router (tablas en PC, tarjetas en móvil) |
| Backend   | Node.js 20+ · Express · Zod · JWT · Multer               |
| Base de datos | PostgreSQL 13+ (probado en 16)                       |

---

## 1. Arranque rápido (local)

Requisitos: **Node 20+** y **Docker** (o un PostgreSQL propio).

```bash
# 1) Base de datos
docker compose up -d

# 2) Backend
cd server
cp .env.example .env          # ajusta JWT_SECRET y ADMIN_PASSWORD
npm install
npm run seed                  # migra, crea destinos, admin y datos DEMO
npm run dev                   # API en http://localhost:4000

# 3) Frontend (otra terminal)
cd client
npm install
npm run dev                   # http://localhost:5173
```

### Cuentas de prueba (con `SEED_DEMO=true`)

| Rol      | Correo                          | Contraseña                    |
|----------|---------------------------------|-------------------------------|
| Admin    | el de `ADMIN_EMAIL`             | el de `ADMIN_PASSWORD`        |
| Agencia  | `agencia1@demo.local` … `agencia4@demo.local` | `Demo12345!`   |
| Viajero  | `viajero@demo.local`            | `Demo12345!`                  |

> Las agencias DEMO son ficticias. En producción usa `SEED_DEMO=false`.

### Pruebas

```bash
cd server
npm test        # usa TEST_DATABASE_URL — esa base se BORRA en cada corrida
```

Las pruebas recorren el flujo completo contra PostgreSQL real: registro, verificación de RNT,
directorio con filtros, cotizaciones, comprobante → reseña → recálculo de calificación,
favoritos, reportes, permisos por rol y acciones de admin.

---

## 2. Cómo funciona la confianza

1. **Agencia** se registra → completa datos legales (razón social, NIT, RNT) → sube su certificado de RNT.
2. **Admin** abre el documento, confirma el RNT en la consulta pública oficial y lo aprueba.
   La API **no deja publicar** una agencia sin un RNT aprobado.
3. Solo agencias `activa` + `verificada` aparecen en el directorio.
4. **Viajero** pide cotización → viaja → sube su comprobante (factura, voucher o contrato).
5. **Admin** aprueba el comprobante → el viajero puede dejar **una** reseña por viaje.
6. **Admin** modera la reseña → al publicarse, un trigger recalcula la calificación de la agencia.

Una vez verificada, la agencia no puede cambiar su razón social, NIT o RNT sin pasar por soporte.

---

## 3. Estructura

```
rumbo-seguro/
├── docker-compose.yml          PostgreSQL local (+ base de pruebas)
├── package.json                scripts para desplegar como un solo servicio
├── server/
│   ├── src/
│   │   ├── index.js            arranque (migra al iniciar)
│   │   ├── app.js              Express, seguridad, rutas
│   │   ├── config.js           variables de entorno
│   │   ├── db/
│   │   │   ├── migrations/     001_esquema_inicial.sql, 002_archivos.sql
│   │   │   ├── migrate.js      migrador con control de versiones
│   │   │   └── seed.js         destinos, admin y datos DEMO
│   │   ├── middleware/         auth (JWT + roles), validación (Zod), errores
│   │   └── routes/             auth, catalogos, agencias, miAgencia, viajero, admin, archivos
│   └── test/flujo.test.js      prueba de punta a punta
└── client/
    └── src/
        ├── api.js, auth.jsx    cliente HTTP y sesión
        ├── components/         Layout, Panel, ui (TablaTarjetas, Modal, Campo…)
        └── pages/              Inicio, Agencias, AgenciaPerfil, Cuenta, MisViajes,
                                agencia/ (panel) y admin/ (panel)
```

**Patrón PC/móvil:** el componente `TablaTarjetas` recibe las columnas (tabla en PC) y una función
`tarjeta` (vista móvil). El cambio ocurre a los 900 px.

---

## 4. API (resumen)

Todas las rutas van bajo `/api`. Autenticación: `Authorization: Bearer <token>`.

| Método | Ruta | Quién | Descripción |
|---|---|---|---|
| POST | `/auth/registro` · `/auth/login` | público | Cuenta de viajero o agencia; devuelve token |
| GET/PUT | `/auth/yo` | sesión | Perfil del usuario |
| GET | `/catalogos/tipos-viaje` · `/destinos` · `/ciudades` | público | Catálogos |
| GET | `/agencias?destino=&tipo=&ciudad=&min_calificacion=&precio_max=&q=&orden=&page=` | público | Directorio |
| GET | `/agencias/:slug` | público | Perfil, paquetes, criterios y reseñas |
| GET/POST/PUT | `/mi-agencia` | agencia | Datos de la agencia |
| POST | `/mi-agencia/verificaciones` | agencia | Enviar documento (RNT, Cámara, RUT, cédula) |
| GET | `/mi-agencia/resumen` | agencia | Indicadores del panel |
| CRUD | `/mi-agencia/paquetes` | agencia | Paquetes |
| GET/PATCH | `/mi-agencia/solicitudes` | agencia | Solicitudes recibidas |
| GET/PUT | `/mi-agencia/resenas` · `/:id/respuesta` | agencia | Reseñas y respuestas |
| POST/GET | `/solicitudes` · `/:id/cancelar` | viajero | Cotizaciones |
| POST/GET | `/viajes` | viajero | Comprobantes de viaje |
| POST | `/resenas` | viajero | Reseña (requiere viaje aprobado) |
| GET/PUT/DELETE | `/favoritos/:agenciaId` | viajero | Favoritos |
| POST | `/reportes` | sesión | Reportar agencia o reseña |
| POST/GET | `/archivos` · `/archivos/:id` | sesión | Subir / ver archivos (privados por defecto) |
| GET/POST | `/admin/...` | admin | Resumen, agencias, verificaciones, comprobantes, reseñas, reportes, planes |

---

## 5. Despliegue en Railway (un solo servicio)

1. Sube el repositorio a GitHub y crea un proyecto en Railway con **PostgreSQL**.
2. Agrega un servicio desde el repositorio (raíz del proyecto):
   - **Build command:** `npm run build`
   - **Start command:** `npm start`
3. Crea un **Volume** montado en `/data` (para los archivos subidos).
4. Variables del servicio:

   ```
   DATABASE_URL=${{Postgres.DATABASE_URL}}
   DATABASE_SSL=false            # true si usas la URL pública
   NODE_ENV=production
   JWT_SECRET=<64+ caracteres aleatorios>
   SERVE_CLIENT=true
   CLIENT_DIST=../client/dist
   CLIENT_URL=https://tu-dominio.up.railway.app
   UPLOAD_DIR=/data/uploads
   ADMIN_EMAIL=<tu correo>
   ADMIN_PASSWORD=<clave fuerte>
   SEED_DEMO=false
   ```
5. Primer despliegue: las migraciones corren solas al arrancar. Luego ejecuta una vez
   `npm run seed` (Railway → servicio → *Run command*) para crear destinos y el admin.

**Salud:** `GET /api/salud` → `{ "ok": true, "db": "ok" }` (úsalo como healthcheck).

---

## 6. Seguridad incluida

- Contraseñas con bcrypt (costo 12); JWT con expiración; el rol `admin` no se puede crear por registro.
- Límite de 20 intentos de login/registro cada 15 min por IP.
- Validación de toda entrada con Zod y consultas parametrizadas (sin SQL armado con texto del usuario).
- Archivos: solo PDF/JPG/PNG/WEBP, máx. 5 MB, nombre aleatorio en disco; los privados solo los ven su
  dueño y los admin (la agencia no ve el comprobante del viajero).
- Helmet, CORS restringido a `CLIENT_URL`, límite de tamaño del cuerpo JSON.
- Las reseñas muestran solo nombre e inicial del apellido.
- Antispam: máximo 3 solicitudes abiertas por viajero con la misma agencia.

## 7. Pendientes sugeridos para la siguiente fase

- Verificación de correo y recuperación de contraseña (requiere un proveedor de correo).
- Notificaciones por correo/WhatsApp cuando llega una solicitud o se aprueba un documento.
- Almacenamiento de archivos en S3/R2 si se escala a varias instancias.
- Cobro en línea de planes (Wompi o Mercado Pago) — hoy el admin registra el plan manualmente.
- Fotos reales de destinos (hoy hay marcadores `[Foto]`).
