import type { APIRoute } from 'astro';
import { sql } from '../../../lib/db';
import type { Sesion, SesionCriterio, SesionBody } from '../../../lib/types';

export const GET: APIRoute = async ({ params, request, locals }) => {
  const docente = locals.docente;
  const { seccionId } = params;
  if (!seccionId) return Response.json({ error: 'Parámetro inválido' }, { status: 400 });

  const url = new URL(request.url);
  const bimestreId = url.searchParams.get('bimestreId');
  const gradoId = url.searchParams.get('gradoId');
  if (!bimestreId || !gradoId) {
    return Response.json({ error: 'Faltan parámetros' }, { status: 400 });
  }

  const [bimestre] = await sql`
    SELECT id FROM bimestre
    WHERE id = ${bimestreId} AND docente_id = ${docente.id}
  `;
  if (!bimestre) return Response.json({ error: 'No autorizado' }, { status: 403 });

  const sesiones = await sql<(Sesion & { criterios: SesionCriterio[] })[]>`
    SELECT
      s.id, s.titulo, s.producto, s.fecha, s.estado,
      COALESCE(
        json_agg(
          json_build_object(
            'id',            sc.id,
            'competenciaId', sc.competencia_id,
            'capacidadId',   sc.capacidad_id,
            'criterio',      sc.criterio,
            'orden',         sc.orden
          ) ORDER BY sc.orden
        ) FILTER (WHERE sc.id IS NOT NULL),
        '[]'
      ) AS criterios
    FROM sesion s
    LEFT JOIN sesion_criterio sc ON sc.sesion_id = s.id
    WHERE s.bimestre_id = ${bimestreId}
      AND s.grado_id    = ${gradoId}
    GROUP BY s.id
    ORDER BY s.fecha ASC
  `;

  return Response.json({ data: sesiones });
};

export const POST: APIRoute = async ({ params, request, locals }) => {
  const docente = locals.docente;
  const { seccionId } = params;
  if (!seccionId) return Response.json({ error: 'Parámetro inválido' }, { status: 400 });

  const body: SesionBody = await request.json();
  const { bimestreId, gradoId, titulo, producto, fecha, criterios } = body;

  if (!titulo?.trim() || !producto?.trim() || !fecha) {
    return Response.json({ error: 'Título, producto y fecha son obligatorios' }, { status: 422 });
  }
  if (!criterios?.length) {
    return Response.json({ error: 'Debes agregar al menos un criterio' }, { status: 422 });
  }
  if (criterios.some(c => !c.competenciaId || !c.capacidadId || !c.criterio?.trim())) {
    return Response.json({ error: 'Cada criterio debe tener competencia, capacidad y descripción' }, { status: 422 });
  }

  const [bimestre] = await sql`
    SELECT id FROM bimestre
    WHERE id = ${bimestreId} AND docente_id = ${docente.id}
  `;
  if (!bimestre) return Response.json({ error: 'No autorizado' }, { status: 403 });

  const [sesion] = await sql<Sesion[]>`
    INSERT INTO sesion (bimestre_id, grado_id, titulo, producto, fecha)
    VALUES (
      ${bimestreId}::bigint, ${gradoId}::bigint,
      ${titulo.trim()}, ${producto.trim()}, ${fecha}::date
    )
    RETURNING id, titulo, producto, fecha, estado
  `;

  // Bulk insert usando el helper nativo de postgres.js — evita jsonb_array_elements
  const filas = criterios.map(c => ({
    sesion_id:      sesion.id,
    competencia_id: String(c.competenciaId),
    capacidad_id:   String(c.capacidadId),
    criterio:       c.criterio.trim(),
    orden:          c.orden,
  }));

  const criteriosInsertados = await sql<SesionCriterio[]>`
    INSERT INTO sesion_criterio ${sql(filas)}
    RETURNING id,
              sesion_id      AS "sesionId",
              competencia_id AS "competenciaId",
              capacidad_id   AS "capacidadId",
              criterio, orden
  `;

  return Response.json({ data: { ...sesion, criterios: criteriosInsertados } }, { status: 201 });
};

export const PUT: APIRoute = async ({ params, request, locals }) => {
  const docente = locals.docente;
  const { seccionId } = params;
  if (!seccionId) return Response.json({ error: 'Parámetro inválido' }, { status: 400 });

  const body = await request.json();
  const { id, titulo, producto, fecha, criterios } = body;

  if (!id || !titulo?.trim() || !producto?.trim() || !fecha) {
    return Response.json({ error: 'Faltan campos obligatorios' }, { status: 422 });
  }
  if (!criterios?.length) {
    return Response.json({ error: 'Debes agregar al menos un criterio' }, { status: 422 });
  }
  if (criterios.some((c: any) => !c.competenciaId || !c.capacidadId || !c.criterio?.trim())) {
    return Response.json({ error: 'Cada criterio debe tener competencia, capacidad y descripción' }, { status: 422 });
  }

  const [sesion] = await sql`
    SELECT s.id FROM sesion s
    JOIN bimestre b ON s.bimestre_id = b.id
    WHERE s.id = ${id} AND b.docente_id = ${docente.id}
  `;
  if (!sesion) return Response.json({ error: 'No autorizado' }, { status: 403 });

  await sql`
    UPDATE sesion SET
      titulo   = ${titulo.trim()},
      producto = ${producto.trim()},
      fecha    = ${fecha}::date
    WHERE id = ${id}
  `;

  await sql`DELETE FROM sesion_criterio WHERE sesion_id = ${id}`;

  // Bulk insert usando el helper nativo de postgres.js — evita jsonb_array_elements
  const filas = criterios.map((c: any) => ({
    sesion_id:      id,
    competencia_id: String(c.competenciaId),
    capacidad_id:   String(c.capacidadId),
    criterio:       c.criterio.trim(),
    orden:          c.orden,
  }));

  const criteriosInsertados = await sql<SesionCriterio[]>`
    INSERT INTO sesion_criterio ${sql(filas)}
    RETURNING id,
              sesion_id      AS "sesionId",
              competencia_id AS "competenciaId",
              capacidad_id   AS "capacidadId",
              criterio, orden
  `;

  return Response.json({ data: { id, titulo, criterios: criteriosInsertados } });
};

export const DELETE: APIRoute = async ({ params, request, locals }) => {
  const docente = locals.docente;
  const { seccionId } = params;
  if (!seccionId) return Response.json({ error: 'Parámetro inválido' }, { status: 400 });

  const { id } = await request.json();
  if (!id) return Response.json({ error: 'ID requerido' }, { status: 422 });

  const [sesion] = await sql`
    SELECT s.id FROM sesion s
    JOIN bimestre b ON s.bimestre_id = b.id
    WHERE s.id = ${id} AND b.docente_id = ${docente.id}
  `;
  if (!sesion) return Response.json({ error: 'No autorizado' }, { status: 403 });

  await sql`UPDATE sesion SET estado = 0 WHERE id = ${id}`;
  return Response.json({ data: { ok: true } });
};