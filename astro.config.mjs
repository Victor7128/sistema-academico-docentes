// @ts-check
import { defineConfig } from 'astro/config';

import tailwindcss from '@tailwindcss/vite';

import svelte from '@astrojs/svelte';

import node from '@astrojs/node';

import auth from 'auth-astro';

// https://astro.build/config
export default defineConfig({
  output: 'server',
  vite: {
    plugins: [tailwindcss()]
  },

  integrations: [svelte(), auth()],

  adapter: node({
    mode: 'standalone'
  })
});