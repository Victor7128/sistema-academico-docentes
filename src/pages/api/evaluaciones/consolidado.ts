import type { APIRoute } from 'astro';
import { sql } from '../../../lib/db';

export const GET: APIRoute = async ({ request, locals }) => {
  const docente = locals.docente;
  const url = new URL(request.url);
  const bimestreId = url.searchParams.get('bimestreId');
  const seccionId = url.searchParams.get('seccionId');

  if (!bimestreId || !seccionId) {
    return Response.json({ error: 'Faltan parámetros' }, { status: 400 });
  }

  const [bimestre] = await sql`
    SELECT id FROM bimestre
    WHERE id = ${bimestreId} AND docente_id = ${docente.id}
  `;
  if (!bimestre) return Response.json({ error: 'No autorizado' }, { status: 403 });

  const consolidados = await sql`
    SELECT co.alumno_id AS "alumnoId", co.nota_final AS "notaFinal"
    FROM consolidado co
    JOIN alumno a ON co.alumno_id = a.id
    WHERE co.bimestre_id = ${bimestreId}
      AND a.seccion_id   = ${seccionId}
  `;

  return Response.json({ data: consolidados });
};