import type { APIRoute } from 'astro';
import { sql } from '../../../lib/db';
import type { Nota } from '../../../lib/types';

const PESO: Record<Nota, number> = { AD: 4, A: 3, B: 2, C: 1 };
const DESDE_PESO: Nota[] = ['C', 'B', 'A', 'AD'];

// Calcula nota final por moda ponderada
function calcularNotaFinal(notas: Nota[]): Nota {
  if (!notas.length) return 'C';
  const conteo: Record<Nota, number> = { AD: 0, A: 0, B: 0, C: 0 };
  for (const n of notas) conteo[n]++;
  // La nota más frecuente; en empate, la mayor
  let max = 0;
  let resultado: Nota = 'C';
  for (const nota of ['AD', 'A', 'B', 'C'] as Nota[]) {
    if (conteo[nota] > max || (conteo[nota] === max && PESO[nota] > PESO[resultado])) {
      max = conteo[nota];
      resultado = nota;
    }
  }
  return resultado;
}

// POST → guardar consolidado de una sección
export const POST: APIRoute = async ({ params, request, locals }) => {
  const docente = locals.docente;
  const { bimestreId } = params;
  if (!bimestreId) return Response.json({ error: 'Parámetro inválido' }, { status: 400 });

  const [bimestre] = await sql`
    SELECT id FROM bimestre
    WHERE id = ${bimestreId} AND docente_id = ${docente.id}
  `;
  if (!bimestre) return Response.json({ error: 'No autorizado' }, { status: 403 });

  const { seccionId }: { seccionId: number } = await request.json();
  if (!seccionId) return Response.json({ error: 'seccionId requerido' }, { status: 422 });

  // Obtener todas las evaluaciones de los alumnos de esta sección en este bimestre
  const filas = await sql<{ alumnoId: number; sesionId: number; titulo: string; nota: Nota }[]>`
    SELECT
      e.alumno_id  AS "alumnoId",
      e.sesion_id  AS "sesionId",
      s.titulo,
      e.nota
    FROM evaluacion e
    JOIN sesion s ON e.sesion_id = s.id
    JOIN alumno a ON e.alumno_id = a.id
    WHERE s.bimestre_id = ${bimestreId}
      AND a.seccion_id  = ${seccionId}
  `;

  if (!filas.length) {
    return Response.json({ error: 'No hay evaluaciones registradas aún.' }, { status: 422 });
  }

  // Agrupar por alumno
  const porAlumno: Record<number, { sesionId: number; titulo: string; nota: Nota }[]> = {};
  for (const f of filas) {
    if (!porAlumno[f.alumnoId]) porAlumno[f.alumnoId] = [];
    porAlumno[f.alumnoId].push({ sesionId: f.sesionId, titulo: f.titulo, nota: f.nota });
  }

  // Calcular y hacer upsert
  const ahora = new Date().toISOString();
  const registros = Object.entries(porAlumno).map(([alumnoId, evals]) => {
    const notas = evals.map(e => e.nota);
    const notaFinal = calcularNotaFinal(notas);
    return {
      alumnoId: Number(alumnoId),
      notaFinal,
      detalle: JSON.stringify({
        sesiones: evals.map(e => ({
          sesionId: e.sesionId,
          titulo: e.titulo,
          nota: e.nota,
        })),
        calculadoEn: ahora,
      }),
    };
  });

  await sql`
    INSERT INTO consolidado (alumno_id, bimestre_id, nota_final, detalle)
    SELECT
      r.alumno_id::bigint,
      ${bimestreId}::bigint,
      r.nota_final::text,
      r.detalle::jsonb
    FROM jsonb_to_recordset(${JSON.stringify(registros)}::jsonb)
      AS r(alumno_id int, nota_final text, detalle jsonb)
    ON CONFLICT (alumno_id, bimestre_id)
    DO UPDATE SET
      nota_final = EXCLUDED.nota_final,
      detalle    = EXCLUDED.detalle,
      updated_at = NOW()
  `;

  return Response.json({ data: { calculados: registros.length } });
};