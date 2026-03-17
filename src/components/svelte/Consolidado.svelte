<script lang="ts">
  import type { Alumno, Sesion, Evaluacion, Nota } from '../../lib/types';

  export let alumnos: Alumno[] = [];
  export let sesiones: Sesion[] = [];
  export let evaluaciones: Evaluacion[] = [];
  export let consolidadosIniciales: { alumnoId: number; notaFinal: string }[] = [];
  export let curriculo: any = null;
  export let bimestreId: number;
  export let seccionId: number;

  const NOTAS: Nota[] = ['AD', 'A', 'B', 'C'];

  const COLORES: Record<Nota, string> = {
    AD: 'bg-emerald-50 text-emerald-700 border border-emerald-200',
    A:  'bg-blue-50 text-blue-700 border border-blue-200',
    B:  'bg-amber-50 text-amber-700 border border-amber-200',
    C:  'bg-red-50 text-red-700 border border-red-200',
  };

  // Mapa rápido: sesionId+alumnoId → nota
  const mapaEval: Record<string, Nota> = {};
  for (const ev of evaluaciones) {
    mapaEval[`${ev.sesionId}-${ev.alumnoId}`] = ev.nota as Nota;
  }

  // Consolidados actuales
  let mapaConsolidado: Record<number, Nota> = {};
  for (const c of consolidadosIniciales) {
    mapaConsolidado[c.alumnoId] = c.notaFinal as Nota;
  }

  let guardando = false;
  let error = '';
  let exito = '';

  function getNota(sesionId: number, alumnoId: number): Nota | null {
    return mapaEval[`${sesionId}-${alumnoId}`] ?? null;
  }

  function nombreCompetencia(id: string) {
    return curriculo?.competencias.find((c: any) => String(c.id) === String(id))?.nombre ?? '';
  }

  // Conteo de notas de un alumno
  function resumenAlumno(alumnoId: number) {
    const conteo: Record<Nota, number> = { AD: 0, A: 0, B: 0, C: 0 };
    for (const s of sesiones) {
      const nota = getNota(s.id, alumnoId);
      if (nota) conteo[nota]++;
    }
    return conteo;
  }

  // Porcentaje de sesiones evaluadas
  $: porcentajeAvance = sesiones.length === 0 ? 0 :
    Math.round(
      evaluaciones.filter((e, i, arr) =>
        arr.findIndex(x => x.sesionId === e.sesionId && x.alumnoId === e.alumnoId) === i
      ).length / (sesiones.length * alumnos.length) * 100
    );

  async function generarConsolidado() {
    guardando = true;
    error = '';
    exito = '';

    try {
      const res = await fetch(`/api/consolidado/${bimestreId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ seccionId }),
      });
      const json = await res.json();

      if (!res.ok) {
        error = json.error ?? 'Error al generar consolidado.';
        return;
      }

      // Recargar consolidados
      const res2 = await fetch(
        `/api/evaluaciones/consolidado?bimestreId=${bimestreId}&seccionId=${seccionId}`
      );
      if (res2.ok) {
        const json2 = await res2.json();
        mapaConsolidado = {};
        for (const c of json2.data) {
          mapaConsolidado[c.alumnoId] = c.notaFinal;
        }
        mapaConsolidado = { ...mapaConsolidado };
      }

      exito = `Consolidado generado para ${json.data.calculados} alumnos.`;
    } catch {
      error = 'No se pudo conectar con el servidor.';
    } finally {
      guardando = false;
    }
  }
</script>

<!-- Resumen de avance -->
<div class="bg-white border border-gray-200 rounded-xl px-5 py-4 mb-6">
  <div class="flex items-center justify-between mb-3">
    <span class="text-sm font-medium text-gray-700">Avance de evaluaciones</span>
    <span class="text-sm font-semibold text-gray-900">{porcentajeAvance}%</span>
  </div>
  <div class="w-full bg-gray-100 rounded-full h-2">
    <div
      class="bg-blue-500 h-2 rounded-full transition-all"
      style="width: {porcentajeAvance}%"
    ></div>
  </div>
  <div class="flex justify-between mt-2 text-xs text-gray-400">
    <span>{sesiones.length} sesiones</span>
    <span>{alumnos.length} alumnos</span>
  </div>
</div>

<!-- Mensajes -->
{#if error}
  <p class="mb-3 text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{error}</p>
{/if}
{#if exito}
  <p class="mb-3 text-sm text-green-700 bg-green-50 border border-green-200 rounded-lg px-3 py-2">{exito}</p>
{/if}

{#if sesiones.length === 0}
  <div class="text-center py-16 text-gray-400">
    <p class="text-sm">No hay sesiones registradas en este bimestre.</p>
  </div>
{:else if alumnos.length === 0}
  <div class="text-center py-16 text-gray-400">
    <p class="text-sm">No hay alumnos en esta sección.</p>
  </div>
{:else}
  <!-- Tabla consolidado -->
  <div class="overflow-x-auto rounded-xl border border-gray-200 mb-6">
    <table class="text-xs min-w-full">
      <thead class="bg-gray-50 border-b border-gray-200">
        <tr>
          <th class="text-left px-3 py-3 font-medium text-gray-500 sticky left-0 bg-gray-50 min-w-45">
            Alumno
          </th>
          {#each sesiones as sesion}
            <th class="text-center px-2 py-3 font-medium text-gray-500 min-w-20">
              <div class="truncate max-w-20" title={sesion.titulo}>
                {sesion.titulo}
              </div>
              <div class="text-gray-400 font-normal truncate max-w-20">
                {nombreCompetencia(sesion.competenciaId).slice(0, 20)}…
              </div>
            </th>
          {/each}
          <th class="text-center px-3 py-3 font-medium text-gray-700 min-w-20 bg-gray-100">
            Final
          </th>
        </tr>
      </thead>
      <tbody class="divide-y divide-gray-100">
        {#each alumnos as alumno, i}
          <tr class="hover:bg-gray-50 transition-colors">
            <td class="px-3 py-2.5 sticky left-0 bg-white font-medium text-gray-900 border-r border-gray-100">
              <span class="text-gray-400 mr-1.5">{i + 1}</span>
              {alumno.apellido}, {alumno.nombre}
            </td>
            {#each sesiones as sesion}
              {@const nota = getNota(sesion.id, alumno.id)}
              <td class="px-2 py-2.5 text-center">
                {#if nota}
                  <span class="inline-flex items-center justify-center w-8 h-6 rounded text-xs font-semibold
                               {COLORES[nota]}">
                    {nota}
                  </span>
                {:else}
                  <span class="text-gray-300">—</span>
                {/if}
              </td>
            {/each}
            <!-- Nota final -->
            <td class="px-3 py-2.5 text-center bg-gray-50">
              {#if mapaConsolidado[alumno.id]}
                <span class="inline-flex items-center justify-center w-10 h-7 rounded-lg
                             text-xs font-bold {COLORES[mapaConsolidado[alumno.id] as Nota]}">
                  {mapaConsolidado[alumno.id]}
                </span>
              {:else}
                <span class="text-gray-300 text-xs">—</span>
              {/if}
            </td>
          </tr>
        {/each}
      </tbody>
    </table>
  </div>

  <!-- Resumen por nota -->
  <div class="grid grid-cols-4 gap-3 mb-6">
    {#each NOTAS as nota}
      {@const count = Object.values(mapaConsolidado).filter(n => n === nota).length}
      <div class="bg-white border border-gray-200 rounded-xl px-4 py-3 text-center">
        <span class="text-2xl font-bold {
          nota === 'AD' ? 'text-emerald-600' :
          nota === 'A'  ? 'text-blue-600' :
          nota === 'B'  ? 'text-amber-600' :
                          'text-red-600'
        }">{count}</span>
        <p class="text-xs text-gray-400 mt-0.5">{nota}</p>
      </div>
    {/each}
  </div>

  <!-- Botón generar -->
  <div class="flex justify-end">
    <button
      on:click={generarConsolidado}
      disabled={guardando}
      class="text-sm text-white bg-blue-600 hover:bg-blue-700
             disabled:bg-gray-300 disabled:cursor-not-allowed
             rounded-lg px-6 py-2.5 font-medium transition-colors cursor-pointer"
    >
      {guardando ? 'Calculando...' : Object.keys(mapaConsolidado).length > 0
        ? 'Recalcular consolidado'
        : 'Generar consolidado'}
    </button>
  </div>
{/if}