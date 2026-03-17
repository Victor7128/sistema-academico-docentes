// src/pages/api/alumnos/copiar/[seccionId].ts
//
// POST /api/alumnos/copiar/:seccionId
// Body: { origenSeccionId: number }
//
// Copia los alumnos activos de origenSeccionId a seccionId,
// omitiendo los que ya existen (por apellido+nombre exactos).

import type { APIRoute } from 'astro';
import { query, sql } from '../../../../lib/db';
import type { Alumno } from '../../../../lib/types';

export const POST: APIRoute = async ({ params, request, locals }) => {
  const docente = locals.docente;
  const seccionId = Number(params.seccionId);

  if (!seccionId || isNaN(seccionId)) {
    return Response.json({ error: 'Sección inválida.' }, { status: 400 });
  }

  let body: { origenSeccionId?: number };
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: 'Cuerpo de solicitud inválido.' }, { status: 400 });
  }

  const origenSeccionId = Number(body.origenSeccionId);
  if (!origenSeccionId || isNaN(origenSeccionId)) {
    return Response.json({ error: 'Sección de origen inválida.' }, { status: 400 });
  }

  // Verificar que el docente tiene acceso a la sección destino
  const [seccionDestino] = await query<{ id: number }>`
    SELECT s.id FROM seccion s
    JOIN bimestre b ON b.id = s.bimestre_id
    WHERE s.id = ${seccionId}
      AND b.docente_id = ${docente.id}
      AND s.estado = 1
  `;
  if (!seccionDestino) {
    return Response.json({ error: 'Sin acceso a la sección destino.' }, { status: 403 });
  }

  // Verificar que el docente tiene acceso a la sección origen
  const [seccionOrigen] = await query<{ id: number }>`
    SELECT s.id FROM seccion s
    JOIN bimestre b ON b.id = s.bimestre_id
    WHERE s.id = ${origenSeccionId}
      AND b.docente_id = ${docente.id}
  `;
  if (!seccionOrigen) {
    return Response.json({ error: 'Sin acceso a la sección de origen.' }, { status: 403 });
  }

  // Traer alumnos activos de la sección origen
  const alumnosOrigen = await query<Alumno>`
    SELECT nombre, apellido, codigo, orden
    FROM alumno
    WHERE seccion_id = ${origenSeccionId}
      AND estado = 1
    ORDER BY orden ASC, apellido ASC, nombre ASC
  `;

  if (alumnosOrigen.length === 0) {
    return Response.json({ error: 'La sección de origen no tiene alumnos activos.' }, { status: 400 });
  }

  // Traer alumnos ya existentes en destino (para evitar duplicados)
  const alumnosExistentes = await query<{ nombre: string; apellido: string }>`
    SELECT nombre, apellido FROM alumno
    WHERE seccion_id = ${seccionId}
  `;

  const existentesSet = new Set(
    alumnosExistentes.map(a => `${a.apellido.toLowerCase()}|${a.nombre.toLowerCase()}`)
  );

  const nuevos = alumnosOrigen.filter(
    a => !existentesSet.has(`${a.apellido.toLowerCase()}|${a.nombre.toLowerCase()}`)
  );

  if (nuevos.length === 0) {
    return Response.json({
      error: 'Todos los alumnos de ese bimestre ya están registrados en esta sección.',
    }, { status: 400 });
  }

  // Insertar los nuevos alumnos en lote
  for (const alumno of nuevos) {
    await sql`
      INSERT INTO alumno (seccion_id, nombre, apellido, codigo, orden, estado)
      VALUES (
        ${seccionId},
        ${alumno.nombre},
        ${alumno.apellido},
        ${alumno.codigo ?? null},
        ${alumno.orden ?? 0},
        1
      )
    `;
  }

  return Response.json({ data: { copiados: nuevos.length } });
};