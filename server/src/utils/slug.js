export function slugify(texto) {
  return texto
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);
}

/** Genera un slug único para la tabla/columna dada, agregando -2, -3... si ya existe. */
export async function slugUnico(db, tabla, texto, excluirId = null) {
  const base = slugify(texto) || 'agencia';
  let candidato = base;
  for (let i = 2; ; i++) {
    const { rowCount } = await db.query(
      `SELECT 1 FROM ${tabla} WHERE slug = $1 AND ($2::uuid IS NULL OR id <> $2)`,
      [candidato, excluirId],
    );
    if (!rowCount) return candidato;
    candidato = `${base}-${i}`;
  }
}
