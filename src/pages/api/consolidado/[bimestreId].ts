import type { APIRoute } from 'astro';
import { sql } from '../../../lib/db';
import type { Nota } from '../../../lib/types';

const PESO: Record<Nota, number> = { AD: 4, A: 3, B: 2, C: 1 };

function calcularNotaFinal(notas: Nota[]): Nota {
  if (!notas.length) return 'C';
  const conteo: Record<Nota, number> = { AD: 0, A: 0, B: 0, C: 0 };
  for (const n of notas) conteo[n]++;
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

  // Evaluaciones de los alumnos de esta sección usando sesion_criterio_id
  const filas = await sql<{
    alumnoId: number;
    sesionId: number;
    titulo: string;
    sesionCriterioId: number;
    capacidadId: string;
    criterio: string;
    nota: Nota;
  }[]>`
    SELECT
      e.alumno_id          AS "alumnoId",
      sc.sesion_id         AS "sesionId",
      s.titulo,
      e.sesion_criterio_id AS "sesionCriterioId",
      sc.capacidad_id      AS "capacidadId",
      sc.criterio,
      e.nota
    FROM evaluacion e
    JOIN sesion_criterio sc ON e.sesion_criterio_id = sc.id
    JOIN sesion s           ON sc.sesion_id = s.id
    JOIN alumno a           ON e.alumno_id  = a.id
    WHERE s.bimestre_id = ${bimestreId}
      AND a.seccion_id  = ${seccionId}
  `;

  if (!filas.length)
    return Response.json({ error: 'No hay evaluaciones registradas aún.' }, { status: 422 });

  // Agrupar por alumno
  type EvalRow = typeof filas[number];
  const porAlumno: Record<number, EvalRow[]> = {};
  for (const f of filas) {
    if (!porAlumno[f.alumnoId]) porAlumno[f.alumnoId] = [];
    porAlumno[f.alumnoId].push(f);
  }

  const ahora = new Date().toISOString();

  const registros = Object.entries(porAlumno).map(([alumnoId, evals]) => {
    const notaFinal = calcularNotaFinal(evals.map((e) => e.nota));
    return {
      alumno_id:  Number(alumnoId),
      bimestre_id: Number(bimestreId),
      nota_final: notaFinal,
      detalle: JSON.stringify({
        criterios: evals.map((e) => ({
          sesionCriterioId: e.sesionCriterioId,
          sesionTitulo:     e.titulo,
          capacidadId:      e.capacidadId,
          criterio:         e.criterio,
          nota:             e.nota,
        })),
        calculadoEn: ahora,
      }),
    };
  });

  // Upsert usando postgres.js bulk insert nativo
  await sql`
    INSERT INTO consolidado ${sql(registros)}
    ON CONFLICT (alumno_id, bimestre_id)
    DO UPDATE SET
      nota_final = EXCLUDED.nota_final,
      detalle    = EXCLUDED.detalle,
      updated_at = NOW()
  `;

  return Response.json({ data: { calculados: registros.length } });
};