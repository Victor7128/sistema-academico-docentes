<script lang="ts">
  import type { Alumno } from '../../lib/types';

  export let alumnos: Alumno[] = [];
  export let seccionId: number;
  export let seccionesOrigen: {
    seccionId: number;
    seccionNombre: string;
    totalAlumnos: number;
  }[] = [];

  // Estado local — copia mutable de la lista
  let lista: Alumno[] = [...alumnos];
  let cargando = false;
  let error = '';
  let exito = '';

  // Modal de edición / creación
  let modalAbierto = false;
  let editando: Alumno | null = null;
  let formNombre = '';
  let formApellido = '';
  let formCodigo = '';

  // Modal copiar alumnos de otro bimestre
  let modalCopiarAbierto = false;
  let origenSeleccionado: number | null = null;
  let copiando = false;

  function abrirCopiar() {
    origenSeleccionado = seccionesOrigen.length === 1 ? seccionesOrigen[0].seccionId : null;
    modalCopiarAbierto = true;
  }

  async function copiarAlumnos() {
    if (!origenSeleccionado) {
      error = 'Selecciona un bimestre de origen.';
      return;
    }

    copiando = true;
    error = '';
    exito = '';

    try {
      const res = await fetch(`/api/alumnos/copiar/${seccionId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ origenSeccionId: origenSeleccionado }),
      });
      const json = await res.json();

      if (!res.ok) {
        error = json.error ?? 'Error al copiar alumnos.';
        return;
      }

      exito = `Se copiaron ${json.data.copiados} alumno${json.data.copiados !== 1 ? 's' : ''} correctamente.`;
      modalCopiarAbierto = false;

      // Recargar lista desde servidor
      const res2 = await fetch(`/api/alumnos/${seccionId}`);
      const json2 = await res2.json();
      if (res2.ok) lista = json2.data;

    } catch {
      error = 'No se pudo conectar con el servidor.';
    } finally {
      copiando = false;
    }
  }

  // Importación .txt
  let importando = false;
  let archivoTxt: FileList | null = null;

  function abrirCrear() {
    editando = null;
    formNombre = '';
    formApellido = '';
    formCodigo = '';
    modalAbierto = true;
  }

  function abrirEditar(a: Alumno) {
    editando = a;
    formNombre = a.nombre;
    formApellido = a.apellido;
    formCodigo = a.codigo ?? '';
    modalAbierto = true;
  }

  function cerrarModal() {
    modalAbierto = false;
    error = '';
  }

  function limpiarMensajes() {
    error = '';
    exito = '';
  }

  async function guardar() {
    if (!formNombre.trim() || !formApellido.trim()) {
      error = 'Nombre y apellido son obligatorios.';
      return;
    }

    cargando = true;
    limpiarMensajes();

    const url = `/api/alumnos/${seccionId}`;
    const method = editando ? 'PUT' : 'POST';
    const body = {
      ...(editando ? { id: editando.id } : {}),
      nombre: formNombre.trim(),
      apellido: formApellido.trim(),
      codigo: formCodigo.trim() || null,
    };

    try {
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const json = await res.json();

      if (!res.ok) {
        error = json.error ?? 'Error al guardar.';
        return;
      }

      if (editando) {
        lista = lista.map(a => a.id === editando!.id ? json.data : a);
        exito = 'Alumno actualizado.';
      } else {
        lista = [...lista, json.data];
        exito = 'Alumno agregado.';
      }

      cerrarModal();
    } catch {
      error = 'No se pudo conectar con el servidor.';
    } finally {
      cargando = false;
    }
  }

  async function eliminar(a: Alumno) {
    if (!confirm(`¿Desactivar a ${a.apellido}, ${a.nombre}?`)) return;

    cargando = true;
    limpiarMensajes();

    try {
      const res = await fetch(`/api/alumnos/${seccionId}`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: a.id }),
      });
      const json = await res.json();

      if (!res.ok) {
        error = json.error ?? 'Error al eliminar.';
        return;
      }

      lista = lista.map(x => x.id === a.id ? { ...x, estado: 0 } : x);
      exito = 'Alumno desactivado.';
    } catch {
      error = 'No se pudo conectar con el servidor.';
    } finally {
      cargando = false;
    }
  }

  async function importarTxt() {
    if (!archivoTxt?.length) return;

    importando = true;
    limpiarMensajes();

    try {
      const texto = await archivoTxt[0].text();
      const lineas = texto.split('\n').map(l => l.trim()).filter(Boolean);

      const res = await fetch(`/api/alumnos/importar/${seccionId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ lineas }),
      });
      const json = await res.json();

      if (!res.ok) {
        error = json.error ?? 'Error al importar.';
        return;
      }

      exito = `Se importaron ${json.data.importados} alumnos.`;

      // Recargar lista desde el servidor
      const res2 = await fetch(`/api/alumnos/${seccionId}`);
      const json2 = await res2.json();
      if (res2.ok) lista = json2.data;

    } catch {
      error = 'No se pudo leer el archivo.';
    } finally {
      importando = false;
      archivoTxt = null;
    }
  }

  $: activos = lista.filter(a => a.estado === 1);
  $: inactivos = lista.filter(a => a.estado === 0);
</script>

<!-- Barra superior -->
<div class="flex items-center justify-between mb-4 gap-3 flex-wrap">
  <span class="text-sm text-gray-500">
    {activos.length} alumno{activos.length !== 1 ? 's' : ''} activo{activos.length !== 1 ? 's' : ''}
  </span>

  <div class="flex items-center gap-2">
    <!-- Copiar de otro bimestre -->
    {#if seccionesOrigen.length > 0}
      <button
        on:click={abrirCopiar}
        class="flex items-center gap-1.5 text-sm border rounded-lg px-3 py-2 transition-colors cursor-pointer btn-copiar"
      >
        <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
          <rect x="1" y="4" width="10" height="11" rx="1.5" stroke="currentColor" stroke-width="1.4"/>
          <path d="M5 4V3a2 2 0 0 1 2-2h6a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2h-1" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/>
          <path d="M6 10l2 2 3-3" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"/>
        </svg>
        Copiar de otro bimestre
      </button>
    {/if}
    <!-- Importar .txt -->
    <label class="flex items-center gap-1.5 text-sm text-gray-600 border border-gray-300
                  rounded-lg px-3 py-2 hover:bg-gray-50 cursor-pointer transition-colors">
      <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
        <path d="M8 2v8M4 6l4 4 4-4M2 12h12" stroke="currentColor" stroke-width="1.5"
              stroke-linecap="round" stroke-linejoin="round"/>
      </svg>
      {importando ? 'Importando...' : 'Importar .txt'}
      <input
        type="file"
        accept=".txt"
        class="hidden"
        disabled={importando}
        on:change={e => { archivoTxt = (e.target as HTMLInputElement).files; importarTxt(); }}
      />
    </label>

    <!-- Nuevo alumno -->
    <button
      on:click={abrirCrear}
      class="flex items-center gap-1.5 text-sm text-white bg-blue-600
             hover:bg-blue-700 rounded-lg px-3 py-2 transition-colors cursor-pointer"
    >
      <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
        <path d="M8 2v12M2 8h12" stroke="currentColor" stroke-width="1.5"
              stroke-linecap="round"/>
      </svg>
      Nuevo alumno
    </button>
  </div>
</div>

<!-- Mensajes -->
{#if error}
  <p class="mb-3 text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
    {error}
  </p>
{/if}
{#if exito}
  <p class="mb-3 text-sm text-green-700 bg-green-50 border border-green-200 rounded-lg px-3 py-2">
    {exito}
  </p>
{/if}

<!-- Lista de alumnos activos -->
{#if activos.length === 0}
  <div class="text-center py-16 text-gray-400">
    <p class="text-sm">No hay alumnos registrados.</p>
    <p class="text-sm mt-1">Importa un archivo .txt o agrega uno manualmente.</p>
  </div>
{:else}
  <div class="rounded-xl border border-gray-200 overflow-hidden">
    <table class="w-full text-sm">
      <thead class="bg-gray-50 border-b border-gray-200">
        <tr>
          <th class="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide">#</th>
          <th class="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide">Apellidos y nombres</th>
          <th class="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide hidden sm:table-cell">Código</th>
          <th class="px-4 py-3"></th>
        </tr>
      </thead>
      <tbody class="divide-y divide-gray-100">
        {#each activos as alumno, i}
          <tr class="hover:bg-gray-50 transition-colors">
            <td class="px-4 py-3 text-gray-400">{i + 1}</td>
            <td class="px-4 py-3 text-gray-900 font-medium">
              {alumno.apellido}, {alumno.nombre}
            </td>
            <td class="px-4 py-3 text-gray-400 hidden sm:table-cell">
              {alumno.codigo ?? '—'}
            </td>
            <td class="px-4 py-3">
              <div class="flex items-center justify-end gap-2">
                <button
                  on:click={() => abrirEditar(alumno)}
                  class="text-gray-400 hover:text-blue-600 transition-colors cursor-pointer"
                  title="Editar"
                >
                  <svg width="15" height="15" viewBox="0 0 16 16" fill="none">
                    <path d="M11 2l3 3-9 9H2v-3l9-9z" stroke="currentColor" stroke-width="1.5"
                          stroke-linecap="round" stroke-linejoin="round"/>
                  </svg>
                </button>
                <button
                  on:click={() => eliminar(alumno)}
                  class="text-gray-400 hover:text-red-500 transition-colors cursor-pointer"
                  title="Desactivar"
                >
                  <svg width="15" height="15" viewBox="0 0 16 16" fill="none">
                    <path d="M2 4h12M5 4V2h6v2M6 7v5M10 7v5M3 4l1 10h8l1-10"
                          stroke="currentColor" stroke-width="1.5"
                          stroke-linecap="round" stroke-linejoin="round"/>
                  </svg>
                </button>
              </div>
            </td>
          </tr>
        {/each}
      </tbody>
    </table>
  </div>
{/if}

<!-- Alumnos inactivos (colapsado) -->
{#if inactivos.length > 0}
  <details class="mt-4">
    <summary class="text-xs text-gray-400 cursor-pointer hover:text-gray-600 select-none">
      {inactivos.length} alumno{inactivos.length !== 1 ? 's' : ''} inactivo{inactivos.length !== 1 ? 's' : ''}
    </summary>
    <div class="mt-2 rounded-xl border border-gray-100 overflow-hidden">
      <table class="w-full text-sm">
        <tbody class="divide-y divide-gray-50">
          {#each inactivos as alumno}
            <tr class="opacity-50">
              <td class="px-4 py-2 text-gray-500">{alumno.apellido}, {alumno.nombre}</td>
            </tr>
          {/each}
        </tbody>
      </table>
    </div>
  </details>
{/if}

<!-- Modal copiar alumnos -->
{#if modalCopiarAbierto}
  <div class="fixed inset-0 bg-black/30 flex items-center justify-center z-50 p-4">
    <div class="bg-white rounded-2xl shadow-xl w-full max-w-sm p-6">

      <div style="display:flex;align-items:center;gap:.75rem;margin-bottom:1.5rem;">
        <div style="width:40px;height:40px;border-radius:.75rem;background:#EEF2F9;border:1px solid rgba(27,58,107,.12);display:flex;align-items:center;justify-content:center;flex-shrink:0;">
          <svg width="18" height="18" viewBox="0 0 16 16" fill="none">
            <rect x="1" y="4" width="10" height="11" rx="1.5" stroke="#1B3A6B" stroke-width="1.4"/>
            <path d="M5 4V3a2 2 0 0 1 2-2h6a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2h-1" stroke="#1B3A6B" stroke-width="1.4" stroke-linecap="round"/>
            <path d="M6 10l2 2 3-3" stroke="#1B3A6B" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"/>
          </svg>
        </div>
        <div>
          <h2 style="font-size:.95rem;font-weight:600;color:#1A2332;margin:0;">Copiar alumnos</h2>
          <p style="font-size:.78rem;color:#8A96AA;margin:.15rem 0 0;">Importa la lista de otro bimestre a esta sección.</p>
        </div>
      </div>

      <label for="origen-select" style="display:block;font-size:.8rem;font-weight:500;color:#4A5672;margin-bottom:.5rem;">
        Bimestre de origen
      </label>

      {#if seccionesOrigen.length === 1}
        <!-- Solo una opción: mostrar como info, no como select -->
        <div style="background:#F5F3EE;border:1px solid #DDE3EE;border-radius:.625rem;padding:.75rem 1rem;">
          <p style="font-size:.85rem;font-weight:500;color:#1A2332;margin:0;">
            Sección {seccionesOrigen[0].seccionNombre}
          </p>
          <p style="font-size:.75rem;color:#8A96AA;margin:.2rem 0 0;">
            {seccionesOrigen[0].totalAlumnos} alumno{seccionesOrigen[0].totalAlumnos !== 1 ? 's' : ''} activo{seccionesOrigen[0].totalAlumnos !== 1 ? 's' : ''}
          </p>
        </div>
      {:else}
        <select
          id="origen-select"
          bind:value={origenSeleccionado}
          style="width:100%;border:1px solid #DDE3EE;border-radius:.625rem;padding:.6rem .75rem;font-size:.85rem;color:#1A2332;background:#fff;outline:none;"
        >
          <option value={null}>Selecciona un bimestre...</option>
          {#each seccionesOrigen as src}
            <option value={src.seccionId}>
              Sección {src.seccionNombre} — {src.totalAlumnos} alumno{src.totalAlumnos !== 1 ? 's' : ''}
            </option>
          {/each}
        </select>
      {/if}

      <div style="background:#EEF2F9;border:1px solid rgba(27,58,107,.14);border-radius:.6rem;padding:.65rem .875rem;margin:1rem 0 0;display:flex;gap:.5rem;align-items:flex-start;">
        <svg width="14" height="14" viewBox="0 0 16 16" fill="none" style="flex-shrink:0;margin-top:.1rem;">
          <circle cx="8" cy="8" r="6.5" stroke="#1B3A6B" stroke-width="1.3"/>
          <path d="M8 7v4" stroke="#1B3A6B" stroke-width="1.4" stroke-linecap="round"/>
          <circle cx="8" cy="5.5" r=".6" fill="#1B3A6B"/>
        </svg>
        <p style="font-size:.75rem;color:#4A5672;margin:0;line-height:1.5;">
          Solo se copian los alumnos que <strong>no están ya registrados</strong> en esta sección. Los existentes no se duplican.
        </p>
      </div>

      {#if error}
        <p class="mt-3 text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{error}</p>
      {/if}

      <div class="flex justify-end gap-2 mt-5">
        <button
          on:click={() => { modalCopiarAbierto = false; error = ''; }}
          class="text-sm text-gray-600 border border-gray-300 rounded-lg px-4 py-2 hover:bg-gray-50 transition-colors cursor-pointer"
        >
          Cancelar
        </button>
        <button
          on:click={copiarAlumnos}
          disabled={copiando || !origenSeleccionado}
          class="btn-confirmar-copiar"
        >
          {copiando ? 'Copiando...' : 'Copiar alumnos'}
        </button>
      </div>

    </div>
  </div>
{/if}

<!-- Modal crear/editar -->
{#if modalAbierto}
  <div class="fixed inset-0 bg-black/30 flex items-center justify-center z-50 p-4">
    <div class="bg-white rounded-2xl shadow-xl w-full max-w-md p-6">

      <h2 class="text-base font-semibold text-gray-900 mb-5">
        {editando ? 'Editar alumno' : 'Nuevo alumno'}
      </h2>

      <div class="flex flex-col gap-4">
        <div>
          <label for="form-apellido" class="block text-sm font-medium text-gray-700 mb-1">
            Apellidos
          </label>
          <input
            id="form-apellido"
            type="text"
            bind:value={formApellido}
            placeholder="Ej: García López"
            class="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm
                   focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <div>
          <label for="form-nombre" class="block text-sm font-medium text-gray-700 mb-1">
            Nombres
          </label>
          <input
            id="form-nombre"
            type="text"
            bind:value={formNombre}
            placeholder="Ej: Juan Carlos"
            class="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm
                   focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <div>
          <label for="form-codigo" class="block text-sm font-medium text-gray-700 mb-1">
            Código <span class="text-gray-400 font-normal">(opcional)</span>
          </label>
          <input
            id="form-codigo"
            type="text"
            bind:value={formCodigo}
            placeholder="Ej: 2024001"
            class="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm
                   focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
      </div>

      {#if error}
        <p class="mt-3 text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
          {error}
        </p>
      {/if}

      <div class="flex justify-end gap-2 mt-6">
        <button
          on:click={cerrarModal}
          class="text-sm text-gray-600 border border-gray-300 rounded-lg px-4 py-2
                 hover:bg-gray-50 transition-colors cursor-pointer"
        >
          Cancelar
        </button>
        <button
          on:click={guardar}
          disabled={cargando}
          class="text-sm text-white bg-blue-600 hover:bg-blue-700
                 disabled:bg-blue-300 rounded-lg px-4 py-2
                 transition-colors cursor-pointer disabled:cursor-not-allowed"
        >
          {cargando ? 'Guardando...' : 'Guardar'}
        </button>
      </div>

    </div>
  </div>
{/if}
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

  /* ── Copiar alumnos buttons ── */
  .btn-copiar {
    color: #1B3A6B;
    border-color: rgba(27,58,107,.28);
    background: #EEF2F9;
  }
  .btn-copiar:hover { background: #D6E3F5; }

  .btn-confirmar-copiar {
    font-size: .875rem;
    font-weight: 500;
    color: #fff;
    background: #1B3A6B;
    border: none;
    border-radius: .625rem;
    padding: .55rem 1.1rem;
    cursor: pointer;
    transition: background .2s;
    box-shadow: 0 3px 10px rgba(27,58,107,.25);
  }
  .btn-confirmar-copiar:hover:not(:disabled) { background: #2A5298; }
  .btn-confirmar-copiar:disabled { background: rgba(27,58,107,.32); cursor: not-allowed; }
</style>