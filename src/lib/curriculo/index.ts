import curriculo from './curriculo.json';

interface Capacidad {
  id: number;
  nombre: string;
  descripcion: string;
}

interface Competencia {
  id: number;
  nombre: string;
  descripcion: string;
  capacidades: Capacidad[];
}

interface Area {
  id: number;
  nombre: string;
  competencias: Competencia[];
}

// Busca el área curricular por nombre del curso en la BD
// Maneja variaciones de nombre (mayúsculas, tildes, abreviaciones)
export function getCurriculoPorNombre(nombreCurso: string): Area | null {
  const normalizar = (s: string) =>
    s.toLowerCase()
     .normalize('NFD')
     .replace(/[\u0300-\u036f]/g, '')
     .trim();

  const nombre = normalizar(nombreCurso);

  return (curriculo.areas as Area[]).find(area =>
    normalizar(area.nombre).includes(nombre) ||
    nombre.includes(normalizar(area.nombre))
  ) ?? null;
}

// Devuelve todas las áreas (para debug o admin)
export function todasLasAreas(): Area[] {
  return curriculo.areas as Area[];
}

// Busca una competencia específica por ID dentro de un área
export function getCompetencia(areaNombre: string, competenciaId: number) {
  const area = getCurriculoPorNombre(areaNombre);
  return area?.competencias.find(c => c.id === competenciaId) ?? null;
}