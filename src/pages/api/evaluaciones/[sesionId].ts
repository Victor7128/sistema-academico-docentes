import type { APIRoute } from 'astro';
import { sql } from '../../../lib/db';
import type { EvaluacionLoteBody, Nota } from '../../../lib/types';

const NOTAS_VALIDAS: Nota[] = ['AD', 'A', 'B', 'C'];

// GET → evaluaciones de la sesión
export const GET: APIRoute = async ({ params, locals }) => {
  const docente = locals.docente;
  const { sesionId } = params;
  if (!sesionId) return Response.json({ error: 'Parámetro inválido' }, { status: 400 });

  const [sesion] = await sql`
    SELECT s.id FROM sesion s
    JOIN bimestre b ON s.bimestre_id = b.id
    WHERE s.id = ${sesionId} AND b.docente_id = ${docente.id}
  `;
  if (!sesion) return Response.json({ error: 'No autorizado' }, { status: 403 });

  const evaluaciones = await sql`
    SELECT id, alumno_id AS "alumnoId", nota, observacion
    FROM evaluacion
    WHERE sesion_id = ${sesionId}
  `;

  return Response.json({ data: evaluaciones });
};

// POST → guardar evaluaciones en lote (upsert)
export const POST: APIRoute = async ({ params, request, locals }) => {
  const docente = locals.docente;
  const { sesionId } = params;
  if (!sesionId) return Response.json({ error: 'Parámetro inválido' }, { status: 400 });

  const [sesion] = await sql`
    SELECT s.id FROM sesion s
    JOIN bimestre b ON s.bimestre_id = b.id
    WHERE s.id = ${sesionId} AND b.docente_id = ${docente.id}
  `;
  if (!sesion) return Response.json({ error: 'No autorizado' }, { status: 403 });

  const body: EvaluacionLoteBody = await request.json();
  const { evaluaciones } = body;

  if (!evaluaciones?.length) {
    return Response.json({ error: 'Sin evaluaciones' }, { status: 422 });
  }

  // Validar notas
  for (const ev of evaluaciones) {
    if (!NOTAS_VALIDAS.includes(ev.nota)) {
      return Response.json(
        { error: `Nota inválida: ${ev.nota}. Debe ser AD, A, B o C.` },
        { status: 422 }
      );
    }
  }

  // Upsert en lote — inserta o actualiza si ya existe
  await sql`
    INSERT INTO evaluacion (sesion_id, alumno_id, nota, observacion)
    SELECT
      ${sesionId}::bigint,
      ev.alumno_id::bigint,
      ev.nota::text,
      ev.observacion::text
    FROM jsonb_to_recordset(${JSON.stringify(evaluaciones)}::jsonb)
      AS ev(alumno_id int, nota text, observacion text)
    ON CONFLICT (sesion_id, alumno_id)
    DO UPDATE SET
      nota        = EXCLUDED.nota,
      observacion = EXCLUDED.observacion,
      updated_at  = NOW()
  `;

  return Response.json({ data: { guardados: evaluaciones.length } });
};

// DELETE → eliminar evaluación individual
export const DELETE: APIRoute = async ({ params, request, locals }) => {
  const docente = locals.docente;
  const { sesionId } = params;
  if (!sesionId) return Response.json({ error: 'Parámetro inválido' }, { status: 400 });

  const { alumnoId } = await request.json();
  if (!alumnoId) return Response.json({ error: 'alumnoId requerido' }, { status: 422 });

  const [sesion] = await sql`
    SELECT s.id FROM sesion s
    JOIN bimestre b ON s.bimestre_id = b.id
    WHERE s.id = ${sesionId} AND b.docente_id = ${docente.id}
  `;
  if (!sesion) return Response.json({ error: 'No autorizado' }, { status: 403 });

  await sql`
    DELETE FROM evaluacion
    WHERE sesion_id = ${sesionId} AND alumno_id = ${alumnoId}
  `;

  return Response.json({ data: { ok: true } });
};