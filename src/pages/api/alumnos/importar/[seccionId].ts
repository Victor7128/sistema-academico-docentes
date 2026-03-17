import type { APIRoute } from 'astro';
import { sql } from '../../../../lib/db';

export const POST: APIRoute = async ({ params, request, locals }) => {
  const docente = locals.docente;
  const { seccionId } = params;
  if (!seccionId) return Response.json({ error: 'Parámetro inválido' }, { status: 400 });

  const [seccion] = await sql`
    SELECT s.id FROM seccion s
    JOIN grado g ON s.grado_id = g.id
    JOIN docente_grado dg ON dg.grado_id = g.id
    WHERE s.id = ${seccionId} AND dg.docente_id = ${docente.id}
  `;
  if (!seccion) return Response.json({ error: 'No autorizado' }, { status: 403 });

  const { lineas }: { lineas: string[] } = await request.json();
  if (!lineas?.length) return Response.json({ error: 'Sin datos' }, { status: 422 });

  // Parsear cada línea del .txt
  // Formatos soportados:
  //   "APELLIDOS, NOMBRE"   → divide por coma
  //   "APELLIDO NOMBRE"     → última palabra es nombre, resto apellido
  const alumnos = lineas
    .map(l => l.trim())
    .filter(Boolean)
    .map((linea, i) => {
      let nombre = '';
      let apellido = '';

      if (linea.includes(',')) {
        const [ap, no] = linea.split(',').map(s => s.trim());
        apellido = ap ?? '';
        nombre   = no ?? '';
      } else {
        const partes = linea.split(/\s+/);
        nombre   = partes.pop() ?? '';
        apellido = partes.join(' ');
      }

      return { nombre, apellido, orden: i + 1 };
    })
    .filter(a => a.nombre && a.apellido);

  if (!alumnos.length) {
    return Response.json({ error: 'No se pudo parsear ningún alumno' }, { status: 422 });
  }

  // Obtener el orden máximo actual
  const [{ maxOrden }] = await sql<{ maxOrden: number }[]>`
    SELECT COALESCE(MAX(orden), 0) AS "maxOrden"
    FROM alumno WHERE seccion_id = ${seccionId}
  `;

  // Insertar en lote
  const valores = alumnos.map((a, i) => ({
    seccion_id: Number(seccionId),
    orden: maxOrden + i + 1,
    nombre: a.nombre,
    apellido: a.apellido,
  }));

  await sql`
    INSERT INTO alumno ${sql(valores, 'seccion_id', 'orden', 'nombre', 'apellido')}
    ON CONFLICT DO NOTHING
  `;

  return Response.json({ data: { importados: valores.length } }, { status: 201 });
};