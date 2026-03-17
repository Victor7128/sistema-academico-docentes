import type { APIRoute } from 'astro';
import { sql } from '../../../lib/db';
import type { Seccion } from '../../../lib/types';

// GET → secciones del grado
export const GET: APIRoute = async ({ params, locals }) => {
  const docente = locals.docente;
  const { gradoId } = params;
  if (!gradoId) return Response.json({ error: 'Parámetro inválido' }, { status: 400 });

  // Verificar que el grado pertenece al docente
  const [grado] = await sql`
    SELECT g.id FROM grado g
    JOIN docente_grado dg ON dg.grado_id = g.id
    WHERE g.id = ${gradoId} AND dg.docente_id = ${docente.id}
  `;
  if (!grado) return Response.json({ error: 'No autorizado' }, { status: 403 });

  const secciones = await sql<Seccion[]>`
    SELECT s.id, s.nombre, s.estado,
           COUNT(a.id) FILTER (WHERE a.estado = 1) AS "totalAlumnos"
    FROM seccion s
    LEFT JOIN alumno a ON a.seccion_id = s.id
    WHERE s.grado_id = ${gradoId}
    GROUP BY s.id, s.nombre, s.estado
    ORDER BY s.nombre
  `;

  return Response.json({ data: secciones });
};

// POST → crear sección
export const POST: APIRoute = async ({ params, request, locals }) => {
  const docente = locals.docente;
  const { gradoId } = params;
  if (!gradoId) return Response.json({ error: 'Parámetro inválido' }, { status: 400 });

  const [grado] = await sql`
    SELECT g.id FROM grado g
    JOIN docente_grado dg ON dg.grado_id = g.id
    WHERE g.id = ${gradoId} AND dg.docente_id = ${docente.id}
  `;
  if (!grado) return Response.json({ error: 'No autorizado' }, { status: 403 });

  const { nombre } = await request.json();
  if (!nombre?.trim()) {
    return Response.json({ error: 'El nombre es obligatorio' }, { status: 422 });
  }

  try {
    const [seccion] = await sql<Seccion[]>`
      INSERT INTO seccion (grado_id, nombre)
      VALUES (${gradoId}::bigint, ${nombre.trim().toUpperCase()})
      RETURNING id, nombre, estado
    `;
    return Response.json({ data: seccion }, { status: 201 });
  } catch (e: any) {
    if (e?.code === '23505') {
      return Response.json(
        { error: `La sección "${nombre.trim().toUpperCase()}" ya existe en este grado.` },
        { status: 409 }
      );
    }
    return Response.json({ error: 'Error interno' }, { status: 500 });
  }
};

// PUT → renombrar sección
export const PUT: APIRoute = async ({ params, request, locals }) => {
  const docente = locals.docente;
  const { gradoId } = params;
  if (!gradoId) return Response.json({ error: 'Parámetro inválido' }, { status: 400 });

  const { id, nombre } = await request.json();
  if (!id || !nombre?.trim()) {
    return Response.json({ error: 'Datos incompletos' }, { status: 422 });
  }

  const [seccion] = await sql`
    SELECT s.id FROM seccion s
    JOIN grado g ON s.grado_id = g.id
    JOIN docente_grado dg ON dg.grado_id = g.id
    WHERE s.id = ${id} AND s.grado_id = ${gradoId}
      AND dg.docente_id = ${docente.id}
  `;
  if (!seccion) return Response.json({ error: 'No autorizado' }, { status: 403 });

  try {
    const [updated] = await sql<Seccion[]>`
      UPDATE seccion SET nombre = ${nombre.trim().toUpperCase()}
      WHERE id = ${id}
      RETURNING id, nombre, estado
    `;
    return Response.json({ data: updated });
  } catch (e: any) {
    if (e?.code === '23505') {
      return Response.json(
        { error: `La sección "${nombre.trim().toUpperCase()}" ya existe.` },
        { status: 409 }
      );
    }
    return Response.json({ error: 'Error interno' }, { status: 500 });
  }
};

// DELETE → desactivar sección
export const DELETE: APIRoute = async ({ params, request, locals }) => {
  const docente = locals.docente;
  const { gradoId } = params;
  if (!gradoId) return Response.json({ error: 'Parámetro inválido' }, { status: 400 });

  const { id } = await request.json();
  if (!id) return Response.json({ error: 'ID requerido' }, { status: 422 });

  const [seccion] = await sql`
    SELECT s.id FROM seccion s
    JOIN grado g ON s.grado_id = g.id
    JOIN docente_grado dg ON dg.grado_id = g.id
    WHERE s.id = ${id} AND s.grado_id = ${gradoId}
      AND dg.docente_id = ${docente.id}
  `;
  if (!seccion) return Response.json({ error: 'No autorizado' }, { status: 403 });

  await sql`UPDATE seccion SET estado = 0 WHERE id = ${id}`;
  return Response.json({ data: { ok: true } });
};