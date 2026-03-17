import type { APIRoute } from 'astro';
import { sql } from '../../../lib/db';
import type { Alumno } from '../../../lib/types';

// GET → lista alumnos de la sección
export const GET: APIRoute = async ({ params, locals }) => {
  const docente = locals.docente;
  const { seccionId } = params;
  if (!seccionId) return Response.json({ error: 'Parámetro inválido' }, { status: 400 });

  // Verificar que la sección pertenece a un grado del docente
  const [seccion] = await sql`
    SELECT s.id FROM seccion s
    JOIN grado g ON s.grado_id = g.id
    JOIN docente_grado dg ON dg.grado_id = g.id
    WHERE s.id = ${seccionId} AND dg.docente_id = ${docente.id}
  `;
  if (!seccion) return Response.json({ error: 'No autorizado' }, { status: 403 });

  const alumnos = await sql<Alumno[]>`
    SELECT id, orden, codigo, nombre, apellido, estado
    FROM alumno
    WHERE seccion_id = ${seccionId}
    ORDER BY orden ASC, apellido ASC, nombre ASC
  `;

  return Response.json({ data: alumnos });
};

// POST → crear alumno individual
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

  const body = await request.json();
  const { nombre, apellido, codigo } = body;

  if (!nombre?.trim() || !apellido?.trim()) {
    return Response.json({ error: 'Nombre y apellido son obligatorios' }, { status: 422 });
  }

  // Orden al final de la lista
  const [{ maxOrden }] = await sql<{ maxOrden: number }[]>`
    SELECT COALESCE(MAX(orden), 0) AS "maxOrden"
    FROM alumno WHERE seccion_id = ${seccionId}
  `;

  const [alumno] = await sql<Alumno[]>`
    INSERT INTO alumno (seccion_id, orden, codigo, nombre, apellido)
    VALUES (
      ${seccionId}::bigint,
      ${maxOrden + 1},
      ${codigo?.trim() || null},
      ${nombre.trim()},
      ${apellido.trim()}
    )
    RETURNING id, orden, codigo, nombre, apellido, estado
  `;

  return Response.json({ data: alumno }, { status: 201 });
};

// PUT → editar alumno
export const PUT: APIRoute = async ({ params, request, locals }) => {
  const docente = locals.docente;
  const { seccionId } = params;
  if (!seccionId) return Response.json({ error: 'Parámetro inválido' }, { status: 400 });

  const body = await request.json();
  const { id, nombre, apellido, codigo } = body;

  if (!id || !nombre?.trim() || !apellido?.trim()) {
    return Response.json({ error: 'Datos incompletos' }, { status: 422 });
  }

  // Verificar que el alumno pertenece a la sección del docente
  const [alumno] = await sql`
    SELECT a.id FROM alumno a
    JOIN seccion s ON a.seccion_id = s.id
    JOIN grado g ON s.grado_id = g.id
    JOIN docente_grado dg ON dg.grado_id = g.id
    WHERE a.id = ${id} AND a.seccion_id = ${seccionId}
      AND dg.docente_id = ${docente.id}
  `;
  if (!alumno) return Response.json({ error: 'No autorizado' }, { status: 403 });

  const [updated] = await sql<Alumno[]>`
    UPDATE alumno
    SET nombre   = ${nombre.trim()},
        apellido = ${apellido.trim()},
        codigo   = ${codigo?.trim() || null}
    WHERE id = ${id}
    RETURNING id, orden, codigo, nombre, apellido, estado
  `;

  return Response.json({ data: updated });
};

// DELETE → desactivar alumno (soft delete)
export const DELETE: APIRoute = async ({ params, request, locals }) => {
  const docente = locals.docente;
  const { seccionId } = params;
  if (!seccionId) return Response.json({ error: 'Parámetro inválido' }, { status: 400 });

  const body = await request.json();
  const { id } = body;
  if (!id) return Response.json({ error: 'ID requerido' }, { status: 422 });

  const [alumno] = await sql`
    SELECT a.id FROM alumno a
    JOIN seccion s ON a.seccion_id = s.id
    JOIN grado g ON s.grado_id = g.id
    JOIN docente_grado dg ON dg.grado_id = g.id
    WHERE a.id = ${id} AND a.seccion_id = ${seccionId}
      AND dg.docente_id = ${docente.id}
  `;
  if (!alumno) return Response.json({ error: 'No autorizado' }, { status: 403 });

  await sql`UPDATE alumno SET estado = 0 WHERE id = ${id}`;

  return Response.json({ data: { ok: true } });
};