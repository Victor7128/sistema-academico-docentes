import { config } from 'dotenv';
import { resolve } from 'path';

// Carga el .env explícitamente con ruta absoluta
config({ path: resolve(process.cwd(), '.env') });

import Google from '@auth/core/providers/google';
import { defineConfig } from 'auth-astro';

export default defineConfig({
  providers: [
    Google({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
    }),
  ],
  callbacks: {
    async signIn({ profile }) {
      if (!profile?.email) return false;
      return true;
    },
    async session({ session, token }) {
      if (token.sub) {
        session.user.id = token.sub;
      }
      return session;
    },
    async jwt({ token, profile }) {
      if (profile?.sub) {
        token.sub = profile.sub;
      }
      return token;
    }
  },
  pages: {
    signIn: '/login',
    error: '/login',
  }
});