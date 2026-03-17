/// <reference types="astro/client" />

declare namespace App {
  interface Locals {
    docente: import('./lib/types').Docente;
    googleProfile: {
      sub: string;
      email: string;
      nombre: string;
    };
  }
}