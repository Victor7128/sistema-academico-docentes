<script>
  export let googleProfile = { nombre: '', email: '', sub: '' };
  export let cursos = [];

  let cursoSeleccionado = '';
  let gradosSeleccionados = [];
  let cargando = false;
  let error = '';

  $: gradosFiltrados = (function () {
    const c = cursos.find((x) => String(x.id) === String(cursoSeleccionado));
    return c && Array.isArray(c.grados) ? c.grados : [];
  })();

  function onCursoChange(event) {
    cursoSeleccionado = event.target.value;
    gradosSeleccionados = [];
  }

  function toggleGrado(id) {
    const idx = gradosSeleccionados.indexOf(id);
    if (idx === -1) gradosSeleccionados = [...gradosSeleccionados, id];
    else gradosSeleccionados = gradosSeleccionados.filter((g) => g !== id);
  }

  async function submitForm() {
    if (!cursoSeleccionado) {
      error = 'Debes seleccionar un curso.';
      return;
    }
    if (gradosSeleccionados.length === 0) {
      error = 'Debes seleccionar al menos un grado.';
      return;
    }

    cargando = true;
    error = '';

    try {
      const res = await fetch('/api/onboarding', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          cursoId: Number(cursoSeleccionado),
          gradosIds: gradosSeleccionados,
        }),
      });

      const json = await res.json().catch(() => ({}));

      if (!res.ok) {
        error = json.error ?? 'Ocurrió un error. Intenta de nuevo.';
        return;
      }

      window.location.href = '/';
    } catch (e) {
      error = 'No se pudo conectar con el servidor.';
      console.error(e);
    } finally {
      cargando = false;
    }
  }
</script>

<div class="max-w-2xl mx-auto p-4">
  <div class="mb-4">
    <label for="nombre" class="block text-sm font-medium text-gray-700 mb-1">
      Tu nombre
    </label>
    <input
      id="nombre"
      type="text"
      value={googleProfile.nombre}
      disabled
      class="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm
             bg-gray-50 text-gray-500 cursor-not-allowed"
    />
  </div>

  <div class="mb-4">
    <label for="curso" class="block text-sm font-medium text-gray-700 mb-1">
      Tu curso (área curricular)
    </label>
    <select
      id="curso"
      on:change={onCursoChange}
      class="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm
             bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
    >
      <option value="">Selecciona un curso...</option>
      {#each cursos as curso}
        <option value={curso.id}>{curso.nombre}</option>
      {/each}
    </select>
  </div>

  {#if cursoSeleccionado}
    <fieldset class="mb-4">
      <legend id="grados-legend" class="block text-sm font-medium text-gray-700 mb-2">
        Grados que enseñas
      </legend>
      <div class="grid grid-cols-2 gap-2" role="group" aria-labelledby="grados-legend">
        {#each gradosFiltrados as grado}
          <button
            type="button"
            on:click={() => toggleGrado(grado.id)}
            role="checkbox"
            aria-checked={gradosSeleccionados.includes(grado.id)}
            class="flex items-center gap-2 border rounded-lg px-3 py-2 text-sm
                   transition-colors text-left focus:outline-none focus:ring-2 focus:ring-blue-500
                   {gradosSeleccionados.includes(grado.id)
                     ? 'border-blue-500 bg-blue-50 text-blue-700'
                     : 'border-gray-300 bg-white text-gray-700 hover:bg-gray-50'}"
          >
            <span class="w-4 h-4 rounded border flex items-center justify-center shrink-0
                         {gradosSeleccionados.includes(grado.id) ? 'bg-blue-500 border-blue-500' : 'border-gray-400'}">
              {#if gradosSeleccionados.includes(grado.id)}
                <svg width="10" height="8" viewBox="0 0 10 8" fill="none" aria-hidden="true">
                  <path d="M1 4l3 3 5-6" stroke="white" stroke-width="1.5"
                        stroke-linecap="round" stroke-linejoin="round"/>
                </svg>
              {/if}
            </span>
            <span class="truncate">{grado.nombre}</span>
          </button>
        {/each}
      </div>
    </fieldset>
  {/if}

  {#if error}
    <p class="mb-3 text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
      {error}
    </p>
  {/if}

  <div class="pt-2">
    <button
      on:click={submitForm}
      disabled={cargando}
      class="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium
             rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700
             disabled:bg-blue-300 disabled:cursor-not-allowed
             focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500
             transition-colors cursor-pointer"
    >
      {cargando ? 'Guardando...' : 'Continuar'}
    </button>
  </div>
</div>
<style>
  /* ── Institutional Blue Design System ── */
  :global(.bg-blue-600)                   { background-color: #1B3A6B !important; }
  :global(.bg-blue-500)                   { background-color: #2A5298 !important; }
  :global(.bg-blue-50)                    { background-color: #EEF2F9 !important; }
  :global(.bg-blue-100)                   { background-color: #D6E3F5 !important; }
  :global(.hover\:bg-blue-700:hover)      { background-color: #2A5298 !important; }
  :global(.hover\:bg-blue-50:hover)       { background-color: #EEF2F9 !important; }
  :global(.hover\:bg-blue-100:hover)      { background-color: #D6E3F5 !important; }
  :global(.hover\:bg-blue-100\/70:hover)  { background-color: rgba(214,227,245,.7) !important; }
  :global(.disabled\:bg-blue-300)         { background-color: rgba(27,58,107,.32) !important; }
  :global(.text-blue-600)                 { color: #1B3A6B !important; }
  :global(.text-blue-700)                 { color: #1B3A6B !important; }
  :global(.text-blue-800)                 { color: #0F2A52 !important; }
  :global(.text-blue-500)                 { color: #2A5298 !important; }
  :global(.hover\:text-blue-600:hover)    { color: #1B3A6B !important; }
  :global(.hover\:text-blue-700:hover)    { color: #0F2A52 !important; }
  :global(.group-hover\:text-blue-600)    { color: #1B3A6B !important; }
  :global(.group-hover\:text-blue-400)    { color: rgba(27,58,107,.55) !important; }
  :global(.border-blue-500)              { border-color: #1B3A6B !important; }
  :global(.border-blue-300)              { border-color: rgba(27,58,107,.35) !important; }
  :global(.border-blue-200)              { border-color: rgba(27,58,107,.2) !important; }
  :global(.border-blue-100)              { border-color: rgba(27,58,107,.12) !important; }
  :global(.focus\:ring-blue-500)         { --tw-ring-color: rgba(27,58,107,.4) !important; }
  :global(.focus\:ring-blue-400)         { --tw-ring-color: rgba(27,58,107,.35) !important; }
  :global(.divide-blue-100 > * + *)      { border-color: rgba(27,58,107,.1) !important; }
  /* Progress bar */
  :global(.bg-blue-500.rounded-full)     { background-color: #1B3A6B !important; }
  /* "Evaluar" link */
  :global(.text-blue-600.border.border-blue-200) {
    color: #1B3A6B !important;
    border-color: rgba(27,58,107,.22) !important;
  }
</style>