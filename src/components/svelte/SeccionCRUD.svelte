<script lang="ts">
    import type { Seccion } from "../../lib/types";

    export let secciones: (Seccion & { totalAlumnos: number })[] = [];
    export let gradoId: number;
    export let bimestreId: number;

    let lista = [...secciones];
    let cargando = false;
    let error = "";
    let exito = "";

    let modalAbierto = false;
    let editando: Seccion | null = null;
    let formNombre = "";

    function abrirCrear() {
        editando = null;
        formNombre = "";
        error = "";
        modalAbierto = true;
    }

    function abrirEditar(s: Seccion) {
        editando = s;
        formNombre = s.nombre;
        error = "";
        modalAbierto = true;
    }

    function cerrarModal() {
        modalAbierto = false;
        error = "";
    }

    async function guardar() {
        if (!formNombre.trim()) {
            error = "El nombre es obligatorio.";
            return;
        }

        cargando = true;
        error = "";

        try {
            const res = await fetch(`/api/secciones/${gradoId}`, {
                method: editando ? "PUT" : "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    ...(editando ? { id: editando.id } : {}),
                    nombre: formNombre.trim(),
                }),
            });
            const json = await res.json();

            if (!res.ok) {
                error = json.error ?? "Error al guardar.";
                return;
            }

            if (editando) {
                lista = lista.map((s) =>
                    s.id === editando!.id ? { ...s, ...json.data } : s,
                );
                exito = "Sección actualizada.";
            } else {
                lista = [...lista, { ...json.data, totalAlumnos: 0 }];
                exito = "Sección creada.";
            }

            cerrarModal();
        } catch {
            error = "No se pudo conectar con el servidor.";
        } finally {
            cargando = false;
        }
    }

    async function eliminar(s: Seccion) {
        if (
            !confirm(
                `¿Desactivar la sección "${s.nombre}"?\nLos alumnos registrados no se perderán.`,
            )
        )
            return;

        cargando = true;
        error = "";
        exito = "";

        try {
            const res = await fetch(`/api/secciones/${gradoId}`, {
                method: "DELETE",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ id: s.id }),
            });
            const json = await res.json();

            if (!res.ok) {
                error = json.error ?? "Error al eliminar.";
                return;
            }

            lista = lista.map((x) => (x.id === s.id ? { ...x, estado: 0 } : x));
            exito = "Sección desactivada.";
        } catch {
            error = "No se pudo conectar con el servidor.";
        } finally {
            cargando = false;
        }
    }

    $: activas = lista.filter((s) => s.estado === 1);
    $: inactivas = lista.filter((s) => s.estado === 0);
</script>

<!-- Barra superior -->
<div class="flex items-center justify-between mb-4">
    <span class="text-sm text-gray-500">
        {activas.length} sección{activas.length !== 1 ? "es" : ""}
    </span>
    <button
        on:click={abrirCrear}
        class="flex items-center gap-1.5 text-sm text-white bg-blue-600
           hover:bg-blue-700 rounded-lg px-3 py-2 transition-colors cursor-pointer"
    >
        <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
            <path
                d="M8 2v12M2 8h12"
                stroke="currentColor"
                stroke-width="1.5"
                stroke-linecap="round"
            />
        </svg>
        Nueva sección
    </button>
</div>

<!-- Mensajes -->
{#if error}
    <p
        class="mb-3 text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2"
    >
        {error}
    </p>
{/if}
{#if exito}
    <p
        class="mb-3 text-sm text-green-700 bg-green-50 border border-green-200 rounded-lg px-3 py-2"
    >
        {exito}
    </p>
{/if}

<!-- Lista -->
{#if activas.length === 0}
    <div class="text-center py-16 text-gray-400">
        <p class="text-sm">No hay secciones registradas.</p>
        <p class="text-sm mt-1">Crea la primera sección para comenzar.</p>
    </div>
{:else}
    <div class="flex flex-col gap-2">
        {#each activas as seccion}
            <div
                class="bg-white border border-gray-200 rounded-xl px-5 py-4 flex items-center justify-between hover:border-gray-300 transition-colors"
            >
                <a
                    href={`/app/${bimestreId}/${gradoId}/${seccion.id}`}
                    class="flex-1 group"
                >
                    <p
                        class="text-sm font-medium text-gray-900 group-hover:text-blue-600 transition-colors"
                    >
                        Sección {seccion.nombre}
                    </p>
                    <p class="text-xs text-gray-400 mt-0.5">
                        {seccion.totalAlumnos} alumno{seccion.totalAlumnos !== 1
                            ? "s"
                            : ""} activo{seccion.totalAlumnos !== 1 ? "s" : ""}
                    </p>
                </a>

                <div class="flex items-center gap-2 ml-4">
                    <button
                        on:click={() => abrirEditar(seccion)}
                        class="text-gray-400 hover:text-blue-600 transition-colors cursor-pointer"
                        title="Editar"
                    >
                        <svg
                            width="15"
                            height="15"
                            viewBox="0 0 16 16"
                            fill="none"
                        >
                            <path
                                d="M11 2l3 3-9 9H2v-3l9-9z"
                                stroke="currentColor"
                                stroke-width="1.5"
                                stroke-linecap="round"
                                stroke-linejoin="round"
                            />
                        </svg>
                    </button>
                    <button
                        on:click={() => eliminar(seccion)}
                        class="text-gray-400 hover:text-red-500 transition-colors cursor-pointer"
                        title="Desactivar"
                    >
                        <svg
                            width="15"
                            height="15"
                            viewBox="0 0 16 16"
                            fill="none"
                        >
                            <path
                                d="M2 4h12M5 4V2h6v2M6 7v5M10 7v5M3 4l1 10h8l1-10"
                                stroke="currentColor"
                                stroke-width="1.5"
                                stroke-linecap="round"
                                stroke-linejoin="round"
                            />
                        </svg>
                    </button>
                    <svg
                        width="16"
                        height="16"
                        viewBox="0 0 16 16"
                        fill="none"
                        class="text-gray-300"
                    >
                        <path
                            d="M6 3l5 5-5 5"
                            stroke="currentColor"
                            stroke-width="1.5"
                            stroke-linecap="round"
                            stroke-linejoin="round"
                        />
                    </svg>
                </div>
            </div>
        {/each}
    </div>
{/if}

<!-- Inactivas -->
{#if inactivas.length > 0}
    <details class="mt-4">
        <summary
            class="text-xs text-gray-400 cursor-pointer hover:text-gray-600 select-none"
        >
            {inactivas.length} sección{inactivas.length !== 1 ? "es" : ""} inactiva{inactivas.length !==
            1
                ? "s"
                : ""}
        </summary>
        <div class="mt-2 flex flex-col gap-1">
            {#each inactivas as seccion}
                <div
                    class="text-sm text-gray-400 px-4 py-2 bg-gray-50 rounded-lg opacity-60"
                >
                    Sección {seccion.nombre}
                </div>
            {/each}
        </div>
    </details>
{/if}

<!-- Modal -->
{#if modalAbierto}
    <div
        class="fixed inset-0 bg-black/30 flex items-center justify-center z-50 p-4"
    >
        <div class="bg-white rounded-2xl shadow-xl w-full max-w-sm p-6">
            <h2 class="text-base font-semibold text-gray-900 mb-5">
                {editando ? "Editar sección" : "Nueva sección"}
            </h2>

            <div>
                <label
                    for="sec-nombre"
                    class="block text-sm font-medium text-gray-700 mb-1"
                >
                    Nombre de la sección
                </label>
                <input
                    id="sec-nombre"
                    type="text"
                    bind:value={formNombre}
                    placeholder="Ej: A, B, C, Única..."
                    maxlength="10"
                    class="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm
                 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <p class="text-xs text-gray-400 mt-1">
                    Se guardará en mayúsculas automáticamente.
                </p>
            </div>

            {#if error}
                <p
                    class="mt-3 text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2"
                >
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
                    {cargando ? "Guardando..." : "Guardar"}
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
</style>