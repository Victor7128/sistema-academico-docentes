import type { APIRoute } from 'astro';
import { sql } from '../../../../lib/db';

function limpiarPrefijo(linea: string): string {
  let l = linea.trim();
  l = l.replace(/^[\s\u00A0]*[-–—•·*Ø\u2022\u00B7\u25CF\u25E6\u2013\u2014][\s\u00A0]*/u, '');
  l = l.replace(/^[\s\u00A0]*([a-zA-Z0-9]{1,3}[.)]\s*)+/u, '');
  l = l.replace(/^\d+\s+/, '');
  l = l.replace(/[\s\u00A0—–-]+$/, '');
  l = l.replace(/\s{2,}/g, ' ').trim();
  return l;
}

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

  const CABECERA = /^[#№]?\s*(apellidos?|nombres?|código|codigo|n[°º])/i;

  const alumnos = lineas
    .map(l => limpiarPrefijo(l))
    .filter(Boolean)
    .filter(l => !CABECERA.test(l))
    .map((linea, i) => {
      let nombre = '';
      let apellido = '';

      if (linea.includes(',')) {
        const [ap, no] = linea.split(',').map(s => s.trim().toUpperCase());
        apellido = ap ?? '';
        nombre = no ?? '';
      } else {
        const partes = linea.toUpperCase().split(/\s+/);
        if (partes.length === 2) {
          apellido = partes[0];
          nombre = partes[1];
        } else {
          apellido = partes.slice(0, 2).join(' ');
          nombre = partes.slice(2).join(' ');
        }
      }

      return { nombre, apellido, orden: i + 1 };
    })
    .filter(a => a.nombre && a.apellido);

  if (!alumnos.length) {
    return Response.json({ error: 'No se pudo parsear ningún alumno' }, { status: 422 });
  }

  const [{ maxOrden }] = await sql<{ maxOrden: number }[]>`
    SELECT COALESCE(MAX(orden), 0) AS "maxOrden"
    FROM alumno WHERE seccion_id = ${seccionId}
  `;

  const valores = alumnos.map((a, i) => ({
    seccion_id: Number(seccionId),
    orden: maxOrden + i + 1,
    nombre: a.nombre,
    apellido: a.apellido,
  }));

  const existentes = await sql<{ nombre: string; apellido: string }[]>`
  SELECT nombre, apellido FROM alumno 
  WHERE seccion_id = ${seccionId} AND estado = 1
`;

  const existentesSet = new Set(
    existentes.map(a => `${a.apellido.toUpperCase()}|${a.nombre.toUpperCase()}`)
  );

  const nuevos = valores.filter(
    v => !existentesSet.has(`${v.apellido}|${v.nombre}`)
  );

  if (!nuevos.length) {
    return Response.json({ error: 'Todos los alumnos ya están registrados.' }, { status: 422 });
  }

  await sql`
  INSERT INTO alumno ${sql(nuevos, 'seccion_id', 'orden', 'nombre', 'apellido')}
`;

  return Response.json({ data: { importados: nuevos.length } }, { status: 201 });
};