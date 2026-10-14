import bcrypt from 'bcryptjs';
import { fileURLToPath } from 'node:url';
import { pool, transaccion } from './pool.js';
import { migrar } from './migrate.js';
import { slugify } from '../utils/slug.js';

const destinos = [
  ['Cartagena', 'Colombia', 'Bolívar', true],
  ['Islas del Rosario', 'Colombia', 'Bolívar', true],
  ['San Andrés', 'Colombia', 'San Andrés y Providencia', true],
  ['Providencia', 'Colombia', 'San Andrés y Providencia', true],
  ['Santa Marta', 'Colombia', 'Magdalena', true],
  ['Parque Tayrona', 'Colombia', 'Magdalena', true],
  ['Barranquilla', 'Colombia', 'Atlántico', true],
  ['Eje Cafetero', 'Colombia', 'Quindío y Risaralda', true],
  ['Medellín', 'Colombia', 'Antioquia', true],
  ['Guatapé', 'Colombia', 'Antioquia', true],
  ['Bogotá', 'Colombia', 'Cundinamarca', true],
  ['Villa de Leyva', 'Colombia', 'Boyacá', true],
  ['San Gil', 'Colombia', 'Santander', true],
  ['Cali', 'Colombia', 'Valle del Cauca', true],
  ['Leticia (Amazonas)', 'Colombia', 'Amazonas', true],
  ['Punta Cana', 'República Dominicana', null, false],
  ['Cancún', 'México', null, false],
  ['Panamá', 'Panamá', null, false],
  ['Miami', 'Estados Unidos', null, false],
  ['Madrid', 'España', null, false],
];

// Agencias DEMO: nombres y documentos ficticios, solo para desarrollo
const agenciasDemo = [
  {
    nombre: 'Caribe Vive Tours', ciudad: 'Cartagena', depto: 'Bolívar', nit: '900000001-1', rnt: '90001',
    tipos: ['familiar', 'playa', 'romantico'], destinos: ['cartagena', 'islas-del-rosario', 'san-andres'],
    paquetes: [
      ['San Andrés todo incluido', 'san-andres', 'playa', 1450000, 5],
      ['Pasadía Islas del Rosario', 'islas-del-rosario', 'playa', 320000, 1],
      ['Cartagena histórica', 'cartagena', 'cultural', 890000, 3],
    ],
  },
  {
    nombre: 'Mundo Expediciones', ciudad: 'Bogotá', depto: 'Cundinamarca', nit: '900000002-2', rnt: '90002',
    tipos: ['aventura', 'cultural', 'ecoturismo'], destinos: ['san-gil', 'villa-de-leyva', 'san-andres'],
    paquetes: [
      ['Aventura en San Gil', 'san-gil', 'aventura', 980000, 3],
      ['San Andrés y Providencia', 'san-andres', 'aventura', 1890000, 6],
    ],
  },
  {
    nombre: 'Ruta Azul Viajes', ciudad: 'Barranquilla', depto: 'Atlántico', nit: '900000003-3', rnt: '90003',
    tipos: ['familiar', 'romantico'], destinos: ['santa-marta', 'parque-tayrona', 'san-andres'],
    paquetes: [
      ['Santa Marta y Tayrona', 'santa-marta', 'familiar', 1150000, 4],
      ['Luna de miel en San Andrés', 'san-andres', 'romantico', 1320000, 5],
    ],
  },
  {
    nombre: 'Trópico Aventuras', ciudad: 'Medellín', depto: 'Antioquia', nit: '900000004-4', rnt: '90004',
    tipos: ['aventura', 'ecoturismo', 'estudiantil'], destinos: ['guatape', 'eje-cafetero', 'medellin'],
    paquetes: [
      ['Guatapé y El Peñol', 'guatape', 'familiar', 280000, 1],
      ['Eje Cafetero esencial', 'eje-cafetero', 'ecoturismo', 1240000, 4],
    ],
  },
];

async function seed() {
  await migrar();

  await transaccion(async (db) => {
    for (const [nombre, pais, region, nacional] of destinos) {
      await db.query(
        `INSERT INTO destinos (nombre, pais, region, es_nacional, slug)
         VALUES ($1, $2, $3, $4, $5) ON CONFLICT (slug) DO NOTHING`,
        [nombre, pais, region, nacional, slugify(nombre)],
      );
    }
    console.log(`✓ ${destinos.length} destinos`);

    const adminEmail = (process.env.ADMIN_EMAIL || '').toLowerCase();
    const adminPassword = process.env.ADMIN_PASSWORD;
    if (adminEmail && adminPassword) {
      if (adminPassword.length < 10) throw new Error('ADMIN_PASSWORD debe tener al menos 10 caracteres');
      await db.query(
        `INSERT INTO usuarios (email, password_hash, nombre, rol, email_verificado)
         VALUES ($1, $2, 'Administrador', 'admin', true)
         ON CONFLICT (email) DO UPDATE SET rol = 'admin'`,
        [adminEmail, await bcrypt.hash(adminPassword, 12)],
      );
      console.log(`✓ Admin: ${adminEmail}`);
    } else {
      console.log('· Sin ADMIN_EMAIL/ADMIN_PASSWORD: no se creó el administrador');
    }

    if (process.env.SEED_DEMO !== 'true') return;

    const hashDemo = await bcrypt.hash('Demo12345!', 12);
    const ids = async (tabla, slugs) =>
      (await db.query(`SELECT id FROM ${tabla} WHERE slug = ANY($1)`, [slugs])).rows.map((r) => r.id);
    const idDe = async (tabla, slug) =>
      (await db.query(`SELECT id FROM ${tabla} WHERE slug = $1`, [slug])).rows[0]?.id ?? null;

    for (const [i, a] of agenciasDemo.entries()) {
      const email = `agencia${i + 1}@demo.local`;
      const { rows: u } = await db.query(
        `INSERT INTO usuarios (email, password_hash, nombre, rol, email_verificado)
         VALUES ($1, $2, $3, 'agencia', true)
         ON CONFLICT (email) DO UPDATE SET nombre = EXCLUDED.nombre RETURNING id`,
        [email, hashDemo, a.nombre],
      );
      const { rows: ag } = await db.query(
        `INSERT INTO agencias (usuario_id, razon_social, nombre_comercial, slug, nit, rnt,
                               rnt_vigente_hasta, descripcion, ciudad, departamento, whatsapp,
                               estado, verificada, verificada_en, anio_fundacion)
         VALUES ($1, $2, $3, $4, $5, $6, current_date + 300, $7, $8, $9, $10,
                 'activa', true, now(), $11)
         ON CONFLICT (usuario_id) DO UPDATE SET nombre_comercial = EXCLUDED.nombre_comercial
         RETURNING id`,
        [
          u[0].id, `${a.nombre} S.A.S. (DEMO)`, a.nombre, slugify(a.nombre), a.nit, a.rnt,
          `Agencia de demostración con datos ficticios. Especializada en ${a.tipos.join(', ')}.`,
          a.ciudad, a.depto, `+57 300 000 000${i + 1}`, 2010 + i,
        ],
      );
      const agenciaId = ag[0].id;

      await db.query('DELETE FROM agencia_tipos_viaje WHERE agencia_id = $1', [agenciaId]);
      await db.query('DELETE FROM agencia_destinos WHERE agencia_id = $1', [agenciaId]);
      await db.query(
        'INSERT INTO agencia_tipos_viaje SELECT $1, unnest($2::smallint[])',
        [agenciaId, await ids('tipos_viaje', a.tipos)],
      );
      await db.query(
        'INSERT INTO agencia_destinos SELECT $1, unnest($2::int[])',
        [agenciaId, await ids('destinos', a.destinos)],
      );
      await db.query(
        `INSERT INTO verificaciones (agencia_id, tipo, estado, notas, revisado_en)
         SELECT $1, 'rnt', 'aprobada', 'Datos DEMO', now()
          WHERE NOT EXISTS (SELECT 1 FROM verificaciones WHERE agencia_id = $1 AND tipo = 'rnt')`,
        [agenciaId],
      );

      await db.query('DELETE FROM paquetes WHERE agencia_id = $1', [agenciaId]);
      for (const [titulo, destino, tipo, precio, dias] of a.paquetes) {
        await db.query(
          `INSERT INTO paquetes (agencia_id, destino_id, tipo_viaje_id, titulo, descripcion,
                                 precio_desde, duracion_dias, incluye, no_incluye)
           VALUES ($1, $2, $3, $4, 'Paquete de demostración.', $5, $6,
                   '["Alojamiento","Traslados","Asistencia"]', '["Tiquetes aéreos"]')`,
          [agenciaId, await idDe('destinos', destino), await idDe('tipos_viaje', tipo), titulo, precio, dias],
        );
      }
    }
    console.log(`✓ ${agenciasDemo.length} agencias DEMO (contraseña: Demo12345!)`);

    await db.query(
      `INSERT INTO usuarios (email, password_hash, nombre, rol, email_verificado)
       VALUES ('viajero@demo.local', $1, 'Viajero Demo', 'viajero', true)
       ON CONFLICT (email) DO NOTHING`,
      [hashDemo],
    );
    console.log('✓ Viajero DEMO: viajero@demo.local / Demo12345!');
  });
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  seed()
    .then(() => pool.end())
    .catch((err) => {
      console.error(err.message);
      process.exit(1);
    });
}
