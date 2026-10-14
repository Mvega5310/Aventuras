/**
 * Prueba de punta a punta del flujo principal contra una base de datos real.
 * Usa TEST_DATABASE_URL (¡se borra por completo!). Ejecutar: npm test
 */
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import os from 'node:os';
import path from 'node:path';

if (!process.env.TEST_DATABASE_URL) {
  console.log('· TEST_DATABASE_URL no definida: se omiten las pruebas de integración');
  process.exit(0);
}
process.env.DATABASE_URL = process.env.TEST_DATABASE_URL;
process.env.NODE_ENV = 'test';
process.env.UPLOAD_DIR = path.join(os.tmpdir(), `rumbo-test-${process.pid}`);

const { default: request } = await import('supertest');
const { default: bcrypt } = await import('bcryptjs');
const { pool, query } = await import('../src/db/pool.js');
const { migrar } = await import('../src/db/migrate.js');
const { crearApp } = await import('../src/app.js');

const app = crearApp();
const api = () => request(app);
const auth = (token) => ({ Authorization: `Bearer ${token}` });
const PDF = Buffer.from('%PDF-1.4\n% documento de prueba\n');

const estado = {};

before(async () => {
  await query('DROP SCHEMA public CASCADE; CREATE SCHEMA public;');
  await migrar({ silencioso: true });
  await query(`INSERT INTO destinos (nombre, pais, es_nacional, slug)
               VALUES ('San Andrés', 'Colombia', true, 'san-andres')`);
  await query(
    `INSERT INTO usuarios (email, password_hash, nombre, rol) VALUES ('admin@test.co', $1, 'Admin', 'admin')`,
    [await bcrypt.hash('AdminTest123', 4)],
  );
});

after(async () => {
  await pool.end();
});

test('salud responde', async () => {
  const r = await api().get('/api/salud');
  assert.equal(r.status, 200);
  assert.equal(r.body.db, 'ok');
});

test('registro valida datos y no permite crear admins', async () => {
  const malo = await api().post('/api/auth/registro').send({ nombre: 'X', email: 'no-es-correo', password: '123' });
  assert.equal(malo.status, 400);
  assert.ok(malo.body.detalles.some((d) => d.campo === 'email'));

  const admin = await api()
    .post('/api/auth/registro')
    .send({ nombre: 'Pirata', email: 'pirata@test.co', password: 'Clave12345', rol: 'admin' });
  assert.equal(admin.status, 400);
});

test('la agencia se registra, crea su perfil y sube su RNT', async () => {
  const r = await api()
    .post('/api/auth/registro')
    .send({ nombre: 'Dueña Agencia', email: 'agencia@test.co', password: 'Clave12345', rol: 'agencia' });
  assert.equal(r.status, 201);
  estado.tokenAgencia = r.body.token;

  const tipos = (await api().get('/api/catalogos/tipos-viaje')).body;
  const destinos = (await api().get('/api/catalogos/destinos')).body;

  const perfil = await api()
    .post('/api/mi-agencia')
    .set(auth(estado.tokenAgencia))
    .send({
      razon_social: 'Agencia Prueba S.A.S.',
      nombre_comercial: 'Agencia Prueba',
      nit: '900123456-7',
      rnt: '12345',
      ciudad: 'Cartagena',
      departamento: 'Bolívar',
      whatsapp: '+57 300 123 4567',
      tipos: [tipos[0].id, tipos[4].id],
      destinos: [destinos[0].id],
    });
  assert.equal(perfil.status, 201, JSON.stringify(perfil.body));
  assert.equal(perfil.body.estado, 'pendiente');
  assert.equal(perfil.body.slug, 'agencia-prueba');
  estado.agencia = perfil.body;

  const paquete = await api()
    .post('/api/mi-agencia/paquetes')
    .set(auth(estado.tokenAgencia))
    .send({ destino_id: destinos[0].id, titulo: 'San Andrés 5 días', precio_desde: 1500000, incluye: ['Hotel'] });
  assert.equal(paquete.status, 201);
  estado.paquete = paquete.body;

  const archivo = await api()
    .post('/api/archivos')
    .set(auth(estado.tokenAgencia))
    .attach('archivo', PDF, { filename: 'rnt.pdf', contentType: 'application/pdf' });
  assert.equal(archivo.status, 201);
  estado.urlRnt = archivo.body.url;

  const verif = await api()
    .post('/api/mi-agencia/verificaciones')
    .set(auth(estado.tokenAgencia))
    .send({ tipo: 'rnt', documento_url: archivo.body.url });
  assert.equal(verif.status, 201);
  estado.verificacionId = verif.body.id;
});

test('una agencia pendiente no aparece en el directorio', async () => {
  const r = await api().get('/api/agencias');
  assert.equal(r.body.datos.length, 0);
  assert.equal((await api().get('/api/agencias/agencia-prueba')).status, 404);
});

test('el admin no puede activar sin RNT aprobado; luego lo aprueba', async () => {
  const login = await api().post('/api/auth/login').send({ email: 'admin@test.co', password: 'AdminTest123' });
  assert.equal(login.status, 200);
  estado.tokenAdmin = login.body.token;

  const doc = await api().get(estado.urlRnt).set(auth(estado.tokenAdmin));
  assert.equal(doc.status, 200);
  assert.equal(doc.headers['content-type'], 'application/pdf');

  const temprano = await api()
    .post(`/api/admin/agencias/${estado.agencia.id}/aprobar`)
    .set(auth(estado.tokenAdmin))
    .send({});
  assert.equal(temprano.status, 409);

  assert.equal(
    (await api().post(`/api/admin/verificaciones/${estado.verificacionId}/aprobar`).set(auth(estado.tokenAdmin)).send({}))
      .status,
    200,
  );
  const ok = await api()
    .post(`/api/admin/agencias/${estado.agencia.id}/aprobar`)
    .set(auth(estado.tokenAdmin))
    .send({});
  assert.equal(ok.status, 200);
  assert.equal(ok.body.verificada, true);
});

test('el directorio filtra por destino, tipo y precio', async () => {
  const todas = await api().get('/api/agencias');
  assert.equal(todas.body.datos.length, 1);
  assert.equal(todas.body.datos[0].precio_desde, 1500000);

  assert.equal((await api().get('/api/agencias?destino=san-andres')).body.datos.length, 1);
  assert.equal((await api().get('/api/agencias?destino=no-existe')).body.datos.length, 0);
  assert.equal((await api().get('/api/agencias?tipo=familiar')).body.datos.length, 1);
  assert.equal((await api().get('/api/agencias?precio_max=1000000')).body.datos.length, 0);
  assert.equal((await api().get('/api/agencias?q=prueba')).body.datos.length, 1);

  const perfil = await api().get('/api/agencias/agencia-prueba');
  assert.equal(perfil.status, 200);
  assert.equal(perfil.body.paquetes.length, 1);
});

test('el viajero pide cotización y la agencia la responde', async () => {
  const r = await api()
    .post('/api/auth/registro')
    .send({ nombre: 'Laura Gómez', email: 'laura@test.co', password: 'Clave12345' });
  estado.tokenViajero = r.body.token;

  const fechasMal = await api()
    .post('/api/solicitudes')
    .set(auth(estado.tokenViajero))
    .send({ agencia_id: estado.agencia.id, fecha_salida: '2027-01-10', fecha_regreso: '2027-01-05' });
  assert.equal(fechasMal.status, 400);

  const s = await api()
    .post('/api/solicitudes')
    .set(auth(estado.tokenViajero))
    .send({ agencia_id: estado.agencia.id, paquete_id: estado.paquete.id, num_viajeros: 4, mensaje: 'Hola' });
  assert.equal(s.status, 201);
  estado.solicitud = s.body;

  // Una agencia no puede pedir cotizaciones
  assert.equal(
    (await api().post('/api/solicitudes').set(auth(estado.tokenAgencia)).send({ agencia_id: estado.agencia.id })).status,
    403,
  );

  const recibidas = await api().get('/api/mi-agencia/solicitudes').set(auth(estado.tokenAgencia));
  assert.equal(recibidas.body.length, 1);
  assert.equal(recibidas.body[0].viajero_email, 'laura@test.co');

  const resp = await api()
    .patch(`/api/mi-agencia/solicitudes/${estado.solicitud.id}`)
    .set(auth(estado.tokenAgencia))
    .send({ estado: 'respondida' });
  assert.equal(resp.status, 200);
  assert.ok(resp.body.respondida_en);
});

test('solo se reseña con comprobante aprobado y la calificación se recalcula', async () => {
  const archivo = await api()
    .post('/api/archivos')
    .set(auth(estado.tokenViajero))
    .attach('archivo', PDF, { filename: 'factura.pdf', contentType: 'application/pdf' });
  estado.urlComprobante = archivo.body.url;

  // La agencia no puede ver el comprobante privado del viajero
  assert.equal((await api().get(estado.urlComprobante).set(auth(estado.tokenAgencia))).status, 404);
  assert.equal((await api().get(estado.urlComprobante)).status, 404);

  const futuro = await api()
    .post('/api/viajes')
    .set(auth(estado.tokenViajero))
    .send({ agencia_id: estado.agencia.id, comprobante_url: estado.urlComprobante, fecha_viaje: '2099-01-01' });
  assert.equal(futuro.status, 400);

  const v = await api()
    .post('/api/viajes')
    .set(auth(estado.tokenViajero))
    .send({
      agencia_id: estado.agencia.id,
      solicitud_id: estado.solicitud.id,
      comprobante_url: estado.urlComprobante,
      fecha_viaje: '2026-01-15',
    });
  assert.equal(v.status, 201);
  estado.viaje = v.body;

  const resena = {
    viaje_id: estado.viaje.id,
    calificacion_general: 4,
    calificacion_precio: 4,
    calificacion_atencion: 5,
    calificacion_cumplimiento: 4,
    comentario: 'Muy buena atención, todo salió como lo prometieron.',
  };
  assert.equal((await api().post('/api/resenas').set(auth(estado.tokenViajero)).send(resena)).status, 409);

  await api().post(`/api/admin/viajes/${estado.viaje.id}/aprobar`).set(auth(estado.tokenAdmin)).send({});
  const r = await api().post('/api/resenas').set(auth(estado.tokenViajero)).send(resena);
  assert.equal(r.status, 201);
  assert.equal(r.body.estado, 'pendiente');

  // Una sola reseña por viaje
  assert.equal((await api().post('/api/resenas').set(auth(estado.tokenViajero)).send(resena)).status, 409);

  // Aún no cuenta en el promedio
  assert.equal((await api().get('/api/agencias/agencia-prueba')).body.total_resenas, 0);

  await api().post(`/api/admin/resenas/${r.body.id}/publicar`).set(auth(estado.tokenAdmin));
  const perfil = (await api().get('/api/agencias/agencia-prueba')).body;
  assert.equal(perfil.total_resenas, 1);
  assert.equal(perfil.calificacion_promedio, 4);
  assert.equal(perfil.resenas[0].autor, 'Laura G.');
  estado.resenaId = r.body.id;
});

test('la agencia responde la reseña y el viajero guarda favoritos y reporta', async () => {
  const resp = await api()
    .put(`/api/mi-agencia/resenas/${estado.resenaId}/respuesta`)
    .set(auth(estado.tokenAgencia))
    .send({ texto: '¡Gracias Laura!' });
  assert.equal(resp.status, 200);
  assert.equal((await api().get('/api/agencias/agencia-prueba')).body.resenas[0].respuesta, '¡Gracias Laura!');

  assert.equal(
    (await api().put(`/api/favoritos/${estado.agencia.id}`).set(auth(estado.tokenViajero))).status,
    204,
  );
  const favs = await api().get('/api/favoritos').set(auth(estado.tokenViajero));
  assert.equal(favs.body.length, 1);

  const rep = await api()
    .post('/api/reportes')
    .set(auth(estado.tokenViajero))
    .send({ tipo: 'agencia', agencia_id: estado.agencia.id, motivo: 'Prueba de reporte' });
  assert.equal(rep.status, 201);

  const resumen = await api().get('/api/admin/resumen').set(auth(estado.tokenAdmin));
  assert.equal(resumen.body.reportes_abiertos, 1);
});

test('permisos: un viajero no entra al admin y la agencia verificada no cambia su NIT', async () => {
  assert.equal((await api().get('/api/admin/resumen').set(auth(estado.tokenViajero))).status, 403);
  assert.equal((await api().get('/api/admin/resumen')).status, 401);

  const cambio = await api()
    .put('/api/mi-agencia')
    .set(auth(estado.tokenAgencia))
    .send({
      nit: '999999999-9',
      nombre_comercial: 'Agencia Prueba',
      ciudad: 'Cartagena',
      departamento: 'Bolívar',
    });
  assert.equal(cambio.status, 409);
});

test('admin: plan destacado, suspender y rechazar', async () => {
  const plan = await api()
    .put(`/api/admin/agencias/${estado.agencia.id}/plan`)
    .set(auth(estado.tokenAdmin))
    .send({ plan: 'destacado', vence_en: '2099-12-31', monto: 150000 });
  assert.equal(plan.status, 200, JSON.stringify(plan.body));
  assert.equal((await api().get('/api/agencias')).body.datos[0].destacada, true);

  const lista = await api().get('/api/admin/agencias?estado=activa').set(auth(estado.tokenAdmin));
  assert.equal(lista.body[0].verificaciones.length, 1);

  const susp = await api()
    .post(`/api/admin/agencias/${estado.agencia.id}/suspender`)
    .set(auth(estado.tokenAdmin))
    .send({ notas: 'Revisión por reporte' });
  assert.equal(susp.body.estado, 'suspendida');
  assert.equal((await api().get('/api/agencias')).body.datos.length, 0);

  const rech = await api()
    .post(`/api/admin/agencias/${estado.agencia.id}/rechazar`)
    .set(auth(estado.tokenAdmin))
    .send({});
  assert.equal(rech.body.verificada, false);

  const solicitudes = await api().get('/api/solicitudes').set(auth(estado.tokenViajero));
  assert.equal(solicitudes.body[0].viaje_estado, 'aprobada');
});
