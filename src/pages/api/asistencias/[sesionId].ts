import type { APIRoute } from 'astro';
import { sql } from '../../../lib/db';
import type { AsistenciaLoteBody, EstadoAsistencia } from '../../../lib/types';

const ESTADOS_VALIDOS: EstadoAsistencia[] = ['P', 'F'];

async function verificarSesion(sesionId: string, docenteId: number) {
  const [row] = await sql`
    SELECT s.id FROM sesion s
    JOIN bimestre b ON s.bimestre_id = b.id
    WHERE s.id = ${sesionId} AND b.docente_id = ${docenteId}
  `;
  return row ?? null;
}

// GET → asistencia registrada para esta sesión
export const GET: APIRoute = async ({ params, locals }) => {
  const { sesionId } = params;
  if (!sesionId) return Response.json({ error: 'Parámetro inválido' }, { status: 400 });

  if (!(await verificarSesion(sesionId, locals.docente.id)))
    return Response.json({ error: 'No autorizado' }, { status: 403 });

  const asistencias = await sql`
    SELECT
      a.alumno_id  AS "alumnoId",
      a.estado,
      a.observacion
    FROM asistencia a
    WHERE a.sesion_id = ${sesionId}
  `;

  return Response.json({ data: asistencias });
};

// POST → guardar asistencia en lote (replace completo)
export const POST: APIRoute = async ({ params, request, locals }) => {
  const { sesionId } = params;
  if (!sesionId) return Response.json({ error: 'Parámetro inválido' }, { status: 400 });

  if (!(await verificarSesion(sesionId, locals.docente.id)))
    return Response.json({ error: 'No autorizado' }, { status: 403 });

  const body: AsistenciaLoteBody = await request.json();
  const { asistencias } = body;

  // ✅ Array vacío es válido (todos presentes)
  if (!Array.isArray(asistencias))
    return Response.json({ error: 'Sin datos' }, { status: 422 });

  for (const a of asistencias) {
    if (!ESTADOS_VALIDOS.includes(a.estado))
      return Response.json(
        { error: `Estado inválido: "${a.estado}". Debe ser P o F.` }, // ✅
        { status: 422 }
      );
  }

  // Validar alumnos solo si hay faltas que guardar
  if (asistencias.length > 0) {
    const alumnosValidos = await sql<{ id: number }[]>`
      SELECT a.id FROM alumno a
      JOIN seccion s ON a.seccion_id = s.id
      JOIN sesion ses ON ses.grado_id = s.grado_id
      WHERE ses.id = ${sesionId} AND a.estado = 1
    `;
    const idsValidos = new Set(alumnosValidos.map(a => a.id));

    for (const a of asistencias) {
      if (!idsValidos.has(a.alumnoId))
        return Response.json(
          { error: `Alumno ${a.alumnoId} no pertenece a esta sesión` },
          { status: 422 }
        );
    }
  }

  // DELETE siempre + INSERT solo si hay faltas ✅
  await sql`DELETE FROM asistencia WHERE sesion_id = ${sesionId}`;

  if (asistencias.length > 0) {
    const filas = asistencias.map(a => ({
      sesion_id:   Number(sesionId),
      alumno_id:   a.alumnoId,
      estado:      a.estado,
      observacion: a.observacion ?? null,
    }));
    await sql`INSERT INTO asistencia ${sql(filas)}`;
  }

  return Response.json({ data: { guardados: asistencias.length } });
};