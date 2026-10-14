-- Archivos subidos (documentos legales, comprobantes de viaje, logos)
-- Los privados solo los ve su dueño o un admin; los públicos (logos, portadas) cualquiera.
CREATE TABLE archivos (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  usuario_id  uuid NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  nombre      text NOT NULL,
  mime        text NOT NULL,
  tamano      integer NOT NULL CHECK (tamano > 0),
  ruta        text NOT NULL UNIQUE,
  publico     boolean NOT NULL DEFAULT false,
  created_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_archivos_usuario ON archivos (usuario_id);

-- Notas de revisión del admin sobre la agencia completa
ALTER TABLE agencias ADD COLUMN notas_revision text;
