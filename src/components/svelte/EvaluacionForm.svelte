<script lang="ts">
  import type { Alumno, Nota } from '../../lib/types';

  export let alumnos: Alumno[] = [];
  export let evaluacionesIniciales: Record<number, { nota: string; observacion: string | null }> = {};
  export let sesionId: number;

  type EstadoEval = { nota: Nota | ''; observacion: string; modificado: boolean };

  const NOTAS: Nota[] = ['AD', 'A', 'B', 'C'];

  const COLORES: Record<Nota, string> = {
    AD: 'bg-emerald-50 border-emerald-400 text-emerald-700',
    A:  'bg-blue-50 border-blue-400 text-blue-700',
    B:  'bg-amber-50 border-amber-400 text-amber-700',
    C:  'bg-red-50 border-red-400 text-red-700',
  };

  const COLORES_INACTIVO = 'bg-white border-gray-200 text-gray-500 hover:border-gray-400';

  // Inicializar estado local
  let estado: Record<number, EstadoEval> = {};
  for (const alumno of alumnos) {
    const ev = evaluacionesIniciales[alumno.id];
    estado[alumno.id] = {
      nota: (ev?.nota as Nota) ?? '',
      observacion: ev?.observacion ?? '',
      modificado: false,
    };
  }

  let guardando = false;
  let error = '';
  let exito = '';
  let mostrarObservaciones = false;

  function setNota(alumnoId: number, nota: Nota) {
    // Toggle: si ya tiene esa nota, la limpia
    const actual = estado[alumnoId].nota;
    estado[alumnoId] = {
      ...estado[alumnoId],
      nota: actual === nota ? '' : nota,
      modificado: true,
    };
    estado = { ...estado };
  }

  function setObservacion(alumnoId: number, obs: string) {
    estado[alumnoId] = {
      ...estado[alumnoId],
      observacion: obs,
      modificado: true,
    };
  }

  // Aplicar nota a todos los alumnos sin nota
  function aplicarATodos(nota: Nota) {
    for (const alumno of alumnos) {
      if (!estado[alumno.id].nota) {
        estado[alumno.id] = { ...estado[alumno.id], nota, modificado: true };
      }
    }
    estado = { ...estado };
  }

  async function guardar() {
    const sinNota = alumnos.filter(a => !estado[a.id].nota);
    if (sinNota.length > 0) {
      error = `Faltan ${sinNota.length} alumno${sinNota.length !== 1 ? 's' : ''} sin nota.`;
      return;
    }

    guardando = true;
    error = '';
    exito = '';

    const evaluaciones = alumnos.map(a => ({
      alumnoId: a.id,
      nota: estado[a.id].nota as Nota,
      observacion: estado[a.id].observacion?.trim() || undefined,
    }));

    try {
      const res = await fetch(`/api/evaluaciones/${sesionId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sesionId, evaluaciones }),
      });
      const json = await res.json();

      if (!res.ok) {
        error = json.error ?? 'Error al guardar.';
        return;
      }

      // Marcar todo como no modificado
      for (const alumno of alumnos) {
        estado[alumno.id].modificado = false;
      }
      estado = { ...estado };
      exito = `${json.data.guardados} evaluaciones guardadas correctamente.`;
    } catch {
      error = 'No se pudo conectar con el servidor.';
    } finally {
      guardando = false;
    }
  }

  $: totalConNota = alumnos.filter(a => estado[a.id]?.nota).length;
  $: totalSinNota = alumnos.length - totalConNota;
  $: hayModificaciones = alumnos.some(a => estado[a.id]?.modificado);
</script>

<!-- Barra superior -->
<div class="flex items-center justify-between mb-4 flex-wrap gap-3">
  <div class="flex items-center gap-3 text-sm">
    <span class="text-gray-500">{alumnos.length} alumnos</span>
    <span class="text-emerald-600 font-medium">{totalConNota} con nota</span>
    {#if totalSinNota > 0}
      <span class="text-amber-600">{totalSinNota} sin nota</span>
    {/if}
  </div>

  <div class="flex items-center gap-2">
    <!-- Aplicar nota a todos los sin nota -->
    <div class="flex items-center gap-1">
      <span class="text-xs text-gray-400">Completar con:</span>
      {#each NOTAS as nota}
        <button
          on:click={() => aplicarATodos(nota)}
          class="text-xs px-2 py-1 rounded border font-medium transition-colors cursor-pointer
                 {COLORES[nota]}"
        >
          {nota}
        </button>
      {/each}
    </div>

    <button
      on:click={() => mostrarObservaciones = !mostrarObservaciones}
      class="text-xs text-gray-500 border border-gray-300 rounded-lg px-2.5 py-1.5
             hover:bg-gray-50 transition-colors cursor-pointer"
    >
      {mostrarObservaciones ? 'Ocultar' : 'Mostrar'} observaciones
    </button>
  </div>
</div>

<!-- Mensajes -->
{#if error}
  <p class="mb-3 text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{error}</p>
{/if}
{#if exito}
  <p class="mb-3 text-sm text-green-700 bg-green-50 border border-green-200 rounded-lg px-3 py-2">{exito}</p>
{/if}

<!-- Lista de alumnos -->
{#if alumnos.length === 0}
  <div class="text-center py-16 text-gray-400">
    <p class="text-sm">No hay alumnos en esta sección.</p>
    <p class="text-sm mt-1">
      <a href="../alumnos" class="text-blue-500 hover:underline">Importa la lista de alumnos</a>
      primero.
    </p>
  </div>
{:else}
  <div class="rounded-xl border border-gray-200 overflow-hidden mb-6">
    <table class="w-full text-sm">
      <thead class="bg-gray-50 border-b border-gray-200">
        <tr>
          <th class="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide">
            #
          </th>
          <th class="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide">
            Alumno
          </th>
          <th class="text-center px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide">
            Nota
          </th>
          {#if mostrarObservaciones}
            <th class="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide">
              Observación
            </th>
          {/if}
        </tr>
      </thead>
      <tbody class="divide-y divide-gray-100">
        {#each alumnos as alumno, i}
          <tr class="hover:bg-gray-50 transition-colors"
              class:bg-amber-50={!estado[alumno.id]?.nota}>
            <td class="px-4 py-3 text-gray-400 text-xs">{i + 1}</td>
            <td class="px-4 py-3">
              <span class="font-medium text-gray-900">
                {alumno.apellido}, {alumno.nombre}
              </span>
            </td>
            <td class="px-4 py-3">
              <div class="flex items-center justify-center gap-1">
                {#each NOTAS as nota}
                  <button
                    on:click={() => setNota(alumno.id, nota)}
                    class="w-10 h-8 rounded border text-xs font-semibold transition-colors cursor-pointer
                           {estado[alumno.id]?.nota === nota
                             ? COLORES[nota]
                             : COLORES_INACTIVO}"
                  >
                    {nota}
                  </button>
                {/each}
              </div>
            </td>
            {#if mostrarObservaciones}
              <td class="px-4 py-3">
                <input
                  type="text"
                  value={estado[alumno.id]?.observacion ?? ''}
                  on:input={e => setObservacion(alumno.id, (e.target as HTMLInputElement).value)}
                  placeholder="Opcional..."
                  class="w-full border border-gray-200 rounded px-2 py-1 text-xs
                         focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
              </td>
            {/if}
          </tr>
        {/each}
      </tbody>
    </table>
  </div>

  <!-- Botón guardar -->
  <div class="flex justify-end">
    <button
      on:click={guardar}
      disabled={guardando || !hayModificaciones}
      class="text-sm text-white bg-blue-600 hover:bg-blue-700
             disabled:bg-gray-300 disabled:cursor-not-allowed
             rounded-lg px-6 py-2.5 font-medium transition-colors cursor-pointer"
    >
      {guardando ? 'Guardando...' : hayModificaciones ? 'Guardar evaluaciones' : 'Sin cambios'}
    </button>
  </div>
{/if}