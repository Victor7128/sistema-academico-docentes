import type { APIRoute } from 'astro';
import { sql } from '../../../lib/db';
import type { Nota } from '../../../lib/types';

const NOTAS_VALIDAS: Nota[] = ['AD', 'A', 'B', 'C'];

async function verificarExamen(examenBimestreId: string, docenteId: number) {
  const [row] = await sql`
    SELECT eb.id FROM examen_bimestre eb
    JOIN bimestre b ON b.id = eb.bimestre_id
    WHERE eb.id = ${examenBimestreId} AND b.docente_id = ${docenteId}
  `;
  return row ?? null;
}

// ── GET: notas actuales del examen ────────────────────────────────────────
export const GET: APIRoute = async ({ params, locals }) => {
  const docente = locals.docente;
  const { examenBimestreId } = params;
  if (!examenBimestreId) return Response.json({ error: 'Parámetro inválido' }, { status: 400 });

  if (!(await verificarExamen(examenBimestreId, docente.id)))
    return Response.json({ error: 'No autorizado' }, { status: 403 });

  const notas = await sql`
    SELECT
      id,
      examen_bimestre_id AS "examenBimestreId",
      alumno_id          AS "alumnoId",
      competencia_id     AS "competenciaId",
      nota,
      observacion,
      estado
    FROM examen_nota
    WHERE examen_bimestre_id = ${examenBimestreId}
  `;

  return Response.json({ data: notas });
};

// ── POST: upsert completo de notas ────────────────────────────────────────
export const POST: APIRoute = async ({ params, request, locals }) => {
  const docente = locals.docente;
  const { examenBimestreId } = params;
  if (!examenBimestreId) return Response.json({ error: 'Parámetro inválido' }, { status: 400 });

  if (!(await verificarExamen(examenBimestreId, docente.id)))
    return Response.json({ error: 'No autorizado' }, { status: 403 });

  const body = await request.json();
  const { notas } = body;

  if (!Array.isArray(notas))
    return Response.json({ error: 'Formato inválido' }, { status: 422 });

  for (const n of notas) {
    if (n.nota !== null && n.nota !== undefined && !NOTAS_VALIDAS.includes(n.nota))
      return Response.json(
        { error: `Nota inválida: "${n.nota}". Debe ser AD, A, B, C o null.` },
        { status: 422 },
      );
  }

  // Upsert por (examen_bimestre_id, alumno_id, competencia_id)
  // Si nota es null → estado pendiente, si tiene nota → estado completado
  const filas = notas.map((n: any) => ({
    examen_bimestre_id: Number(examenBimestreId),
    alumno_id:          n.alumnoId,
    competencia_id:     String(n.competenciaId),
    nota:               n.nota ?? null,
    observacion:        n.observacion ?? null,
    estado:             n.nota ? 'completado' : 'pendiente',
  }));

  if (filas.length === 0)
    return Response.json({ data: { guardados: 0 } });

  await sql`
    INSERT INTO examen_nota ${sql(filas)}
    ON CONFLICT (examen_bimestre_id, alumno_id, competencia_id)
    DO UPDATE SET
      nota        = EXCLUDED.nota,
      observacion = EXCLUDED.observacion,
      estado      = EXCLUDED.estado,
      updated_at  = NOW()
  `;

  const guardados = filas.filter(f => f.nota !== null).length;
  return Response.json({ data: { guardados } });
};