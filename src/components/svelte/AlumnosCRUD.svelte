<script lang="ts">
  import type { Alumno } from '../../lib/types';

  export let alumnos: Alumno[] = [];
  export let seccionId: number;

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