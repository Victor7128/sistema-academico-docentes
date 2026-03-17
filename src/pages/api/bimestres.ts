import type { APIRoute } from 'astro';
import { sql } from '../../lib/db';

// POST → crea los 4 bimestres del año usando la función de la BD
export const POST: APIRoute = async ({ request, locals }) => {
  const docente = locals.docente;

  const form = await request.formData();
  const anio = Number(form.get('anio'));

  if (!anio || anio < 2020) {
    return Response.json({ error: 'Año inválido' }, { status: 422 });
  }

  try {
    await sql`
      SELECT reiniciar_bimestres_anio(${docente.id}, ${anio})
    `;

    // Redirige de vuelta al inicio
    return Response.redirect(new URL('/', request.url), 303);

  } catch (e) {
    console.error('Error creando bimestres:', e);
    return Response.json({ error: 'Error interno' }, { status: 500 });
  }
};