-- =====================================================================
-- Directorio verificado de agencias de viajes (Colombia)
-- PostgreSQL 13+
-- Ejecutar: psql "$DATABASE_URL" -f schema.sql
-- =====================================================================


-- ---------------------------------------------------------------------
-- Extensiones
-- ---------------------------------------------------------------------
CREATE EXTENSION IF NOT EXISTS pgcrypto;   -- gen_random_uuid()
CREATE EXTENSION IF NOT EXISTS citext;     -- emails sin distinguir mayúsculas
CREATE EXTENSION IF NOT EXISTS pg_trgm;    -- búsqueda por texto aproximado

-- ---------------------------------------------------------------------
-- Tipos enumerados
-- ---------------------------------------------------------------------
CREATE TYPE rol_usuario        AS ENUM ('viajero', 'agencia', 'admin');
CREATE TYPE estado_agencia     AS ENUM ('pendiente', 'activa', 'suspendida', 'rechazada');
CREATE TYPE tipo_verificacion  AS ENUM ('rnt', 'camara_comercio', 'rut', 'identidad_representante');
CREATE TYPE estado_revision    AS ENUM ('pendiente', 'aprobada', 'rechazada');
CREATE TYPE estado_solicitud   AS ENUM ('nueva', 'vista', 'respondida', 'cerrada', 'cancelada');
CREATE TYPE estado_resena      AS ENUM ('pendiente', 'publicada', 'oculta', 'rechazada');
CREATE TYPE plan_agencia       AS ENUM ('gratis', 'destacado', 'premium');
CREATE TYPE tipo_reporte       AS ENUM ('resena', 'agencia');
CREATE TYPE estado_reporte     AS ENUM ('abierto', 'resuelto', 'descartado');

-- ---------------------------------------------------------------------
-- Función genérica para updated_at
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS trigger AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ---------------------------------------------------------------------
-- USUARIOS
-- ---------------------------------------------------------------------
CREATE TABLE usuarios (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email         citext NOT NULL UNIQUE,
  password_hash text   NOT NULL,
  nombre        text   NOT NULL,
  telefono      text,
  ciudad        text,
  rol           rol_usuario NOT NULL DEFAULT 'viajero',
  email_verificado boolean NOT NULL DEFAULT false,
  activo        boolean NOT NULL DEFAULT true,
  ultimo_acceso timestamptz,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_usuarios_rol ON usuarios (rol);
CREATE TRIGGER trg_usuarios_updated BEFORE UPDATE ON usuarios
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ---------------------------------------------------------------------
-- CATÁLOGOS
-- ---------------------------------------------------------------------
CREATE TABLE tipos_viaje (
  id     smallserial PRIMARY KEY,
  slug   text NOT NULL UNIQUE,
  nombre text NOT NULL
);

INSERT INTO tipos_viaje (slug, nombre) VALUES
  ('familiar',    'Familiar'),
  ('aventura',    'Aventura'),
  ('corporativo', 'Corporativo'),
  ('romantico',   'Romántico / Luna de miel'),
  ('playa',       'Playa y descanso'),
  ('cultural',    'Cultural'),
  ('religioso',   'Religioso'),
  ('estudiantil', 'Estudiantil / Grupal'),
  ('ecoturismo',  'Ecoturismo');

CREATE TABLE destinos (
  id           serial PRIMARY KEY,
  nombre       text NOT NULL,
  pais         text NOT NULL,
  region       text,
  es_nacional  boolean NOT NULL DEFAULT false,
  slug         text NOT NULL UNIQUE,
  UNIQUE (nombre, pais)
);
CREATE INDEX idx_destinos_nombre_trgm ON destinos USING gin (nombre gin_trgm_ops);

-- ---------------------------------------------------------------------
-- AGENCIAS
-- ---------------------------------------------------------------------
CREATE TABLE agencias (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  usuario_id            uuid NOT NULL UNIQUE REFERENCES usuarios(id) ON DELETE RESTRICT,
  razon_social          text NOT NULL,
  nombre_comercial      text NOT NULL,
  slug                  text NOT NULL UNIQUE,
  nit                   text NOT NULL UNIQUE,
  rnt                   text NOT NULL UNIQUE,          -- Registro Nacional de Turismo
  rnt_vigente_hasta     date,
  descripcion           text,
  ciudad                text NOT NULL,
  departamento          text NOT NULL,
  direccion             text,
  telefono              text,
  whatsapp              text,
  email_contacto        citext,
  sitio_web             text,
  logo_url              text,
  portada_url           text,
  anio_fundacion        smallint CHECK (anio_fundacion BETWEEN 1900 AND 2100),
  estado                estado_agencia NOT NULL DEFAULT 'pendiente',
  verificada            boolean NOT NULL DEFAULT false,
  verificada_en         timestamptz,
  plan                  plan_agencia NOT NULL DEFAULT 'gratis',
  destacada_hasta       timestamptz,
  calificacion_promedio numeric(3,2) NOT NULL DEFAULT 0 CHECK (calificacion_promedio BETWEEN 0 AND 5),
  total_resenas         integer NOT NULL DEFAULT 0 CHECK (total_resenas >= 0),
  created_at            timestamptz NOT NULL DEFAULT now(),
  updated_at            timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_agencias_publicas ON agencias (ciudad, calificacion_promedio DESC)
  WHERE estado = 'activa' AND verificada;
CREATE INDEX idx_agencias_nombre_trgm ON agencias USING gin (nombre_comercial gin_trgm_ops);
CREATE TRIGGER trg_agencias_updated BEFORE UPDATE ON agencias
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TABLE agencia_tipos_viaje (
  agencia_id    uuid     NOT NULL REFERENCES agencias(id) ON DELETE CASCADE,
  tipo_viaje_id smallint NOT NULL REFERENCES tipos_viaje(id) ON DELETE CASCADE,
  PRIMARY KEY (agencia_id, tipo_viaje_id)
);

CREATE TABLE agencia_destinos (
  agencia_id uuid    NOT NULL REFERENCES agencias(id) ON DELETE CASCADE,
  destino_id integer NOT NULL REFERENCES destinos(id) ON DELETE CASCADE,
  PRIMARY KEY (agencia_id, destino_id)
);
CREATE INDEX idx_agencia_destinos_destino ON agencia_destinos (destino_id);

-- ---------------------------------------------------------------------
-- VERIFICACIONES (documentos legales revisados por admin)
-- ---------------------------------------------------------------------
CREATE TABLE verificaciones (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  agencia_id    uuid NOT NULL REFERENCES agencias(id) ON DELETE CASCADE,
  tipo          tipo_verificacion NOT NULL,
  documento_url text,
  estado        estado_revision NOT NULL DEFAULT 'pendiente',
  notas         text,
  revisado_por  uuid REFERENCES usuarios(id) ON DELETE SET NULL,
  revisado_en   timestamptz,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_verificaciones_agencia ON verificaciones (agencia_id);
CREATE INDEX idx_verificaciones_pendientes ON verificaciones (created_at) WHERE estado = 'pendiente';
CREATE TRIGGER trg_verificaciones_updated BEFORE UPDATE ON verificaciones
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ---------------------------------------------------------------------
-- PAQUETES
-- ---------------------------------------------------------------------
CREATE TABLE paquetes (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  agencia_id    uuid NOT NULL REFERENCES agencias(id) ON DELETE CASCADE,
  destino_id    integer NOT NULL REFERENCES destinos(id),
  tipo_viaje_id smallint REFERENCES tipos_viaje(id),
  titulo        text NOT NULL,
  descripcion   text,
  precio_desde  numeric(14,2) CHECK (precio_desde >= 0),
  moneda        char(3) NOT NULL DEFAULT 'COP',
  duracion_dias smallint CHECK (duracion_dias > 0),
  incluye       jsonb NOT NULL DEFAULT '[]'::jsonb,
  no_incluye    jsonb NOT NULL DEFAULT '[]'::jsonb,
  imagen_url    text,
  activo        boolean NOT NULL DEFAULT true,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_paquetes_agencia ON paquetes (agencia_id);
CREATE INDEX idx_paquetes_busqueda ON paquetes (destino_id, tipo_viaje_id, precio_desde) WHERE activo;
CREATE TRIGGER trg_paquetes_updated BEFORE UPDATE ON paquetes
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ---------------------------------------------------------------------
-- SOLICITUDES DE COTIZACIÓN (leads)
-- ---------------------------------------------------------------------
CREATE TABLE solicitudes (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  viajero_id       uuid NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  agencia_id       uuid NOT NULL REFERENCES agencias(id) ON DELETE CASCADE,
  paquete_id       uuid REFERENCES paquetes(id) ON DELETE SET NULL,
  destino_id       integer REFERENCES destinos(id),
  tipo_viaje_id    smallint REFERENCES tipos_viaje(id),
  presupuesto_min  numeric(14,2) CHECK (presupuesto_min >= 0),
  presupuesto_max  numeric(14,2),
  fecha_salida     date,
  fecha_regreso    date,
  num_viajeros     smallint NOT NULL DEFAULT 1 CHECK (num_viajeros > 0),
  mensaje          text,
  estado           estado_solicitud NOT NULL DEFAULT 'nueva',
  respondida_en    timestamptz,
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now(),
  CHECK (presupuesto_max IS NULL OR presupuesto_min IS NULL OR presupuesto_max >= presupuesto_min),
  CHECK (fecha_regreso IS NULL OR fecha_salida IS NULL OR fecha_regreso >= fecha_salida)
);
CREATE INDEX idx_solicitudes_agencia ON solicitudes (agencia_id, estado, created_at DESC);
CREATE INDEX idx_solicitudes_viajero ON solicitudes (viajero_id, created_at DESC);
CREATE TRIGGER trg_solicitudes_updated BEFORE UPDATE ON solicitudes
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ---------------------------------------------------------------------
-- VIAJES VERIFICADOS (comprobante que habilita reseñar)
-- ---------------------------------------------------------------------
CREATE TABLE viajes_verificados (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  solicitud_id    uuid UNIQUE REFERENCES solicitudes(id) ON DELETE SET NULL,
  viajero_id      uuid NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  agencia_id      uuid NOT NULL REFERENCES agencias(id) ON DELETE CASCADE,
  comprobante_url text NOT NULL,                 -- factura, voucher o contrato
  fecha_viaje     date NOT NULL,
  estado          estado_revision NOT NULL DEFAULT 'pendiente',
  notas           text,
  revisado_por    uuid REFERENCES usuarios(id) ON DELETE SET NULL,
  revisado_en     timestamptz,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),
  UNIQUE (id, agencia_id, viajero_id)            -- permite FK compuesta desde reseñas
);
CREATE INDEX idx_viajes_verificados_estado ON viajes_verificados (estado, created_at);
CREATE TRIGGER trg_viajes_verificados_updated BEFORE UPDATE ON viajes_verificados
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ---------------------------------------------------------------------
-- RESEÑAS (una por viaje verificado)
-- ---------------------------------------------------------------------
CREATE TABLE resenas (
  id                       uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  viaje_id                 uuid NOT NULL UNIQUE,
  agencia_id               uuid NOT NULL,
  viajero_id               uuid NOT NULL,
  calificacion_general     smallint NOT NULL CHECK (calificacion_general     BETWEEN 1 AND 5),
  calificacion_precio      smallint NOT NULL CHECK (calificacion_precio      BETWEEN 1 AND 5),
  calificacion_atencion    smallint NOT NULL CHECK (calificacion_atencion    BETWEEN 1 AND 5),
  calificacion_cumplimiento smallint NOT NULL CHECK (calificacion_cumplimiento BETWEEN 1 AND 5),
  titulo                   text,
  comentario               text NOT NULL,
  estado                   estado_resena NOT NULL DEFAULT 'pendiente',
  moderado_por             uuid REFERENCES usuarios(id) ON DELETE SET NULL,
  moderado_en              timestamptz,
  created_at               timestamptz NOT NULL DEFAULT now(),
  updated_at               timestamptz NOT NULL DEFAULT now(),
  -- garantiza que la reseña corresponde al mismo viajero y agencia del viaje verificado
  FOREIGN KEY (viaje_id, agencia_id, viajero_id)
    REFERENCES viajes_verificados (id, agencia_id, viajero_id) ON DELETE CASCADE
);
CREATE INDEX idx_resenas_agencia ON resenas (agencia_id, created_at DESC) WHERE estado = 'publicada';
CREATE TRIGGER trg_resenas_updated BEFORE UPDATE ON resenas
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TABLE respuestas_resena (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  resena_id  uuid NOT NULL UNIQUE REFERENCES resenas(id) ON DELETE CASCADE,
  agencia_id uuid NOT NULL REFERENCES agencias(id) ON DELETE CASCADE,
  texto      text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TRIGGER trg_respuestas_updated BEFORE UPDATE ON respuestas_resena
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- Solo se permite crear el viaje verificado -> reseña si el viaje fue aprobado
CREATE OR REPLACE FUNCTION validar_viaje_aprobado()
RETURNS trigger AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM viajes_verificados
    WHERE id = NEW.viaje_id AND estado = 'aprobada'
  ) THEN
    RAISE EXCEPTION 'El viaje % no está verificado; no se puede reseñar', NEW.viaje_id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_resenas_viaje_aprobado BEFORE INSERT ON resenas
  FOR EACH ROW EXECUTE FUNCTION validar_viaje_aprobado();

-- Recalcula promedio y total de reseñas de una agencia
CREATE OR REPLACE FUNCTION recalcular_calificacion_agencia()
RETURNS trigger AS $$
DECLARE
  v_agencia uuid;
BEGIN
  v_agencia := COALESCE(NEW.agencia_id, OLD.agencia_id);
  UPDATE agencias a
     SET calificacion_promedio = COALESCE(s.promedio, 0),
         total_resenas         = COALESCE(s.total, 0)
    FROM (
      SELECT ROUND(AVG(calificacion_general)::numeric, 2) AS promedio,
             COUNT(*)::int                                AS total
        FROM resenas
       WHERE agencia_id = v_agencia AND estado = 'publicada'
    ) s
   WHERE a.id = v_agencia;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_resenas_recalcular
  AFTER INSERT OR UPDATE OF estado, calificacion_general OR DELETE ON resenas
  FOR EACH ROW EXECUTE FUNCTION recalcular_calificacion_agencia();

-- ---------------------------------------------------------------------
-- FAVORITOS
-- ---------------------------------------------------------------------
CREATE TABLE favoritos (
  viajero_id uuid NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  agencia_id uuid NOT NULL REFERENCES agencias(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (viajero_id, agencia_id)
);

-- ---------------------------------------------------------------------
-- REPORTES / DENUNCIAS (moderación)
-- ---------------------------------------------------------------------
CREATE TABLE reportes (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tipo         tipo_reporte NOT NULL,
  resena_id    uuid REFERENCES resenas(id) ON DELETE CASCADE,
  agencia_id   uuid REFERENCES agencias(id) ON DELETE CASCADE,
  reportado_por uuid NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  motivo       text NOT NULL,
  estado       estado_reporte NOT NULL DEFAULT 'abierto',
  resuelto_por uuid REFERENCES usuarios(id) ON DELETE SET NULL,
  resuelto_en  timestamptz,
  created_at   timestamptz NOT NULL DEFAULT now(),
  CHECK (
    (tipo = 'resena'  AND resena_id  IS NOT NULL AND agencia_id IS NULL) OR
    (tipo = 'agencia' AND agencia_id IS NOT NULL AND resena_id  IS NULL)
  )
);
CREATE INDEX idx_reportes_abiertos ON reportes (created_at) WHERE estado = 'abierto';

-- ---------------------------------------------------------------------
-- SUSCRIPCIONES (monetización)
-- ---------------------------------------------------------------------
CREATE TABLE suscripciones (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  agencia_id    uuid NOT NULL REFERENCES agencias(id) ON DELETE CASCADE,
  plan          plan_agencia NOT NULL,
  monto         numeric(14,2) NOT NULL CHECK (monto >= 0),
  moneda        char(3) NOT NULL DEFAULT 'COP',
  inicia_en     date NOT NULL,
  vence_en      date NOT NULL,
  referencia_pago text,
  created_at    timestamptz NOT NULL DEFAULT now(),
  CHECK (vence_en > inicia_en)
);
CREATE INDEX idx_suscripciones_agencia ON suscripciones (agencia_id, vence_en DESC);

-- ---------------------------------------------------------------------
-- VISTA PÚBLICA: agencias visibles en el directorio
-- ---------------------------------------------------------------------
CREATE OR REPLACE VIEW vista_agencias_publicas AS
SELECT a.id,
       a.slug,
       a.nombre_comercial,
       a.descripcion,
       a.ciudad,
       a.departamento,
       a.whatsapp,
       a.sitio_web,
       a.logo_url,
       a.rnt,
       a.verificada,
       a.plan,
       (a.destacada_hasta IS NOT NULL AND a.destacada_hasta > now()) AS destacada,
       a.calificacion_promedio,
       a.total_resenas
  FROM agencias a
 WHERE a.estado = 'activa' AND a.verificada;

