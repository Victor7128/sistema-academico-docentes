import type { APIRoute } from 'astro';
import { sql } from '../../../lib/db';
import type { EvaluacionLoteBody, Nota } from '../../../lib/types';

const NOTAS_VALIDAS: Nota[] = ['AD', 'A', 'B', 'C'];

async function verificarSesion(sesionId: string, docenteId: number) {
  const [row] = await sql`
    SELECT s.id FROM sesion s
    JOIN bimestre b ON s.bimestre_id = b.id
    WHERE s.id = ${sesionId} AND b.docente_id = ${docenteId}
  `;
  return row ?? null;
}

// ── GET ───────────────────────────────────────────────────────────────────
export const GET: APIRoute = async ({ params, locals }) => {
  const docente = locals.docente;
  const { sesionId } = params;
  if (!sesionId) return Response.json({ error: 'Parámetro inválido' }, { status: 400 });

  if (!(await verificarSesion(sesionId, docente.id)))
    return Response.json({ error: 'No autorizado' }, { status: 403 });

  const evaluaciones = await sql`
    SELECT
      e.id,
      e.sesion_criterio_id AS "sesionCriterioId",
      e.alumno_id          AS "alumnoId",
      e.nota,
      e.observacion
    FROM evaluacion e
    JOIN sesion_criterio sc ON e.sesion_criterio_id = sc.id
    WHERE sc.sesion_id = ${sesionId}
  `;

  return Response.json({ data: evaluaciones });
};

// ── POST: replace completo (DELETE + INSERT) ──────────────────────────────
export const POST: APIRoute = async ({ params, request, locals }) => {
  const docente = locals.docente;
  const { sesionId } = params;
  if (!sesionId) return Response.json({ error: 'Parámetro inválido' }, { status: 400 });

  if (!(await verificarSesion(sesionId, docente.id)))
    return Response.json({ error: 'No autorizado' }, { status: 403 });

  const body: EvaluacionLoteBody = await request.json();
  const { evaluaciones } = body;

  if (!Array.isArray(evaluaciones))
    return Response.json({ error: 'Formato inválido' }, { status: 422 });

  // null = alumno ausente/pendiente → válido. Solo rechazar valores inválidos no nulos.
  for (const ev of evaluaciones) {
    if (ev.nota !== null && !NOTAS_VALIDAS.includes(ev.nota))
      return Response.json(
        { error: `Nota inválida: "${ev.nota}". Debe ser AD, A, B, C o null.` },
        { status: 422 },
      );
  }

  // Validar que los criterioIds pertenezcan a esta sesión
  const criteriosValidos = await sql<{ id: number }[]>`
    SELECT id FROM sesion_criterio WHERE sesion_id = ${sesionId}
  `;
  const idsValidos = new Set(criteriosValidos.map((c) => String(c.id)));

  for (const ev of evaluaciones) {
    if (!idsValidos.has(String(ev.sesionCriterioId)))
      return Response.json(
        { error: `criterioId ${ev.sesionCriterioId} no pertenece a esta sesión` },
        { status: 422 },
      );
  }

  // Borrar evaluaciones anteriores de esta sesión
  await sql`
    DELETE FROM evaluacion
    WHERE sesion_criterio_id IN (
      SELECT id FROM sesion_criterio WHERE sesion_id = ${sesionId}
    )
  `;

  // Insertar las nuevas (si las hay)
  // Solo insertamos filas que tengan nota O observación — omitir filas completamente vacías
  const filas = evaluaciones
    .filter((ev) => ev.nota !== null || ev.observacion)
    .map((ev) => ({
      sesion_criterio_id: ev.sesionCriterioId,
      alumno_id:          ev.alumnoId,
      nota:               ev.nota ?? null,
      observacion:        ev.observacion ?? null,
    }));

  if (filas.length > 0) {
    await sql`INSERT INTO evaluacion ${sql(filas)}`;
  }

  return Response.json({ data: { guardados: filas.length } });
};