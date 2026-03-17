import type { APIRoute } from 'astro';
import { sql } from '../../lib/db';
import type { OnboardingBody } from '../../lib/types';

export const POST: APIRoute = async ({ request, locals }) => {
  const { googleProfile } = locals;

  if (!googleProfile) {
    return Response.json({ error: 'No autorizado' }, { status: 401 });
  }

  let body: OnboardingBody;

  try {
    body = await request.json();
  } catch {
    return Response.json({ error: 'Body inválido' }, { status: 400 });
  }

  const { cursoId, gradosIds } = body;

  if (!cursoId || !gradosIds?.length) {
    return Response.json(
      { error: 'Debes seleccionar un curso y al menos un grado.' },
      { status: 422 }
    );
  }

  try {
    const [result] = await sql<{ registrar_docente_google: number }[]>`
      SELECT registrar_docente_google(
        ${googleProfile.nombre}::text,
        ${googleProfile.email}::text,
        ${googleProfile.sub}::text,
        ${googleProfile.email}::text,
        ${cursoId}::bigint,
        ${sql.array(gradosIds)}::bigint[]
      )
    `;

    return Response.json({ data: { docenteId: result.registrar_docente_google } });

  } catch (e: any) {
    if (e?.code === '23505') {
      return Response.json(
        { error: 'Esta cuenta ya está registrada.' },
        { status: 409 }
      );
    }
    console.error('Error en onboarding:', e);
    return Response.json({ error: 'Error interno del servidor' }, { status: 500 });
  }
};