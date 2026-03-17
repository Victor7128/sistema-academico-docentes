// @ts-check
import { defineConfig } from 'astro/config';
import tailwindcss from '@tailwindcss/vite';
import svelte from '@astrojs/svelte';
import auth from 'auth-astro';

const adapter = process.env.VERCEL
  ? (await import('@astrojs/vercel')).default()
  : (await import('@astrojs/node')).default({ mode: 'standalone' });

export default defineConfig({
  output: 'server',
  vite: { plugins: [tailwindcss()] },
  integrations: [svelte(), auth()],
  adapter: adapter,
});