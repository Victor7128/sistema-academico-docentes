// src/lib/types.ts

// ============================================================
// ENTIDADES BASE
// ============================================================

export interface Curso {
  id: number;
  nombre: string;
  estado: 0 | 1;
  createdAt: string;
  updatedAt: string;
}

export interface Docente {
  id: number;
  nombre: string;
  email: string;
  cursoId: number | null;
  onboardingCompletado: boolean;
  estado: 0 | 1;
  createdAt: string;
  updatedAt: string;
}

export interface AuthGoogle {
  id: number;
  docenteId: number;
  googleSub: string;
  emailGoogle: string;
  createdAt: string;
  updatedAt: string;
}

export interface Grado {
  id: number;
  cursoId: number;
  nombre: string;
  estado: 0 | 1;
  createdAt: string;
  updatedAt: string;
}

export interface DocenteGrado {
  id: number;
  docenteId: number;
  gradoId: number;
  createdAt: string;
}

export interface Seccion {
  id: number;
  gradoId: number;
  nombre: string;
  estado: 0 | 1;
  createdAt: string;
  updatedAt: string;
}

export interface Alumno {
  id: number;
  seccionId: number;
  orden: number;
  codigo: string | null;
  nombre: string;
  apellido: string;
  estado: 0 | 1;
  createdAt: string;
  updatedAt: string;
}

export interface Bimestre {
  id: number;
  docenteId: number;
  nombre: string;
  orden: 1 | 2 | 3 | 4;
  anio: number;
  estado: 0 | 1;
  createdAt: string;
  updatedAt: string;
}

export interface Sesion {
  id: number;
  bimestreId: number;
  gradoId: number;
  titulo: string;
  producto: string;
  fecha: string;
  estado: 0 | 1;
  createdAt: string;
  updatedAt: string;
}

export interface SesionCriterio {
  id: number;
  sesionId: number;
  competenciaId: string;
  capacidadId: string;
  criterio: string;
  orden: number;
  createdAt: string;
  updatedAt: string;
}

export interface SesionCriterioBody {
  competenciaId: string;
  capacidadId: string;
  criterio: string;
  orden: number;
}

export interface SesionBody {
  bimestreId: number;
  gradoId: number;
  titulo: string;
  producto: string;
  fecha: string;
  criterios: SesionCriterioBody[];
}

export interface EvaluacionLoteBody {
  evaluaciones: {
    sesionCriterioId: number;
    alumnoId: number;
    nota: Nota;
    observacion?: string;
  }[];
}

export type Nota = 'AD' | 'A' | 'B' | 'C';

export interface Evaluacion {
  id: number;
  sesionCriterioId: number;
  alumnoId: number;
  nota: Nota;
  observacion: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface Consolidado {
  id: number;
  alumnoId: number;
  bimestreId: number;
  notaFinal: Nota;
  detalle: ConsolidadoDetalle | null;
  createdAt: string;
  updatedAt: string;
}

// ============================================================
// TIPOS PARA JSONB
// ============================================================

export interface ConsolidadoDetalle {
  criterios: {
    sesionCriterioId: number;
    sesionTitulo: string;
    competenciaNombre: string;
    capacidadNombre: string;
    criterio: string;
    nota: Nota;
  }[];
  calculadoEn: string;
}

// ============================================================
// TIPOS PARA VISTAS DE LA BD
// ============================================================

export interface VistaDocenteCompleto {
  id: number;
  nombre: string;
  email: string;
  onboardingCompletado: boolean;
  curso: string | null;
  gradosAsignados: number;
  bimestresActivos: number;
  anioActual: number | null;
}

export interface VistaAlumnosPorSeccion {
  seccionId: number;
  seccion: string;
  grado: string;
  curso: string;
  totalAlumnos: number;
  alumnosActivos: number;
}

// ============================================================
// TIPOS PARA EL JSON CURRICULAR
// ============================================================

export interface Capacidad {
  id: string;
  nombre: string;
}

export interface Competencia {
  id: string;
  nombre: string;
  capacidades: Capacidad[];
}

export interface CurriculoDelCurso {
  cursoId: number;
  cursoNombre: string;
  competencias: Competencia[];
}

// ============================================================
// TIPOS PARA REQUESTS / RESPONSES DE LA API
// ============================================================

export interface ApiResponse<T> {
  data: T;
  error?: never;
}

export interface ApiError {
  data?: never;
  error: string;
}

export type ApiResult<T> = ApiResponse<T> | ApiError;

export interface ImportarAlumnosBody {
  seccionId: number;
  lineas: string[];   // cada línea: "APELLIDOS, NOMBRE" o "APELLIDO NOMBRE"
}

export interface OnboardingBody {
  cursoId: number;
  gradosIds: number[];
}