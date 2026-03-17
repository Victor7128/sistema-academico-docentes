import { defineMiddleware } from 'astro:middleware';
import { getSession } from 'auth-astro/server';
import { sql } from './lib/db';
import type { Docente } from './lib/types';

// Rutas completamente públicas (sin sesión)
const PUBLIC_PATHS = [
  '/login',
  '/api/auth',
];

// Rutas que requieren sesión pero NO onboarding completo
// (el docente acaba de registrarse y está configurando su cuenta)
const ONBOARDING_PATHS = [
  '/onboarding',
  '/api/onboarding',
];

export const onRequest = defineMiddleware(async (context, next) => {
  const { url, redirect, locals } = context;

  // 1. Rutas públicas: pasan sin verificar nada
  const isPublic = PUBLIC_PATHS.some(p => url.pathname.startsWith(p));
  if (isPublic) return next();

  // 2. Verificar sesión de Google (auth-astro)
  const session = await getSession(context.request);

  if (!session?.user?.id) {
    return redirect('/login');
  }

  // 3. Buscar docente en la BD por google_sub
  const [docente] = await sql<Docente[]>`
    SELECT d.id, d.nombre, d.email, d.curso_id,
           d.onboarding_completado, d.estado
    FROM auth_google ag
    JOIN docente d ON ag.docente_id = d.id
    WHERE ag.google_sub = ${session.user.id}
      AND d.estado = 1
  `;

  const isOnboardingRoute = ONBOARDING_PATHS.some(p => url.pathname.startsWith(p));

  // 4. Primer login: el docente aún no existe en la BD
  if (!docente) {
    // Guardamos los datos de Google en locals para usarlos en el onboarding
    locals.googleProfile = {
      sub: session.user.id,
      email: session.user.email ?? '',
      nombre: session.user.name ?? '',
    };

    if (isOnboardingRoute) return next();
    return redirect('/onboarding');
  }

  // 5. Docente existe pero no completó el onboarding
  if (!docente.onboardingCompletado) {
    locals.googleProfile = {
      sub: session.user.id,
      email: session.user.email ?? '',
      nombre: session.user.name ?? '',
    };

    if (isOnboardingRoute) return next();
    return redirect('/onboarding');
  }

  // 6. Docente completo: disponible en toda la app
  locals.docente = docente;
  return next();
});