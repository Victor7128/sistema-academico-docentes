<script lang="ts">
    import type { Sesion, SesionCriterio } from "../../lib/types";

    export let sesiones: (Sesion & { criterios: SesionCriterio[] })[] = [];
    export let curriculo: any = null;
    export let bimestreId: number;
    export let gradoId: number;
    export let seccionId: number;

    type SesionConCriterios = Sesion & { criterios: SesionCriterio[] };

    let lista: SesionConCriterios[] = [...sesiones];
    let cargando = false;
    let error = "";
    let exito = "";

    let modalAbierto = false;
    let editando: SesionConCriterios | null = null;

    // ── Campos base ───────────────────────────────────────────────────────
    let formTitulo = "";
    let formProducto = "";
    let formFecha = "";

    // ── Estructura jerárquica ─────────────────────────────────────────────
    //
    //  competenciasSeleccionadas : Set<competenciaId>
    //  criteriosPorCapacidad     : Map<capacidadId, string[]>
    //    → si una capacidad está en el Map = está seleccionada
    //    → el array son los textos de criterio (al menos 1)
    //
    let competenciasSeleccionadas: Set<string> = new Set();
    let criteriosPorCapacidad: Map<string, string[]> = new Map();

    $: competencias = curriculo?.competencias ?? [];

    // ── Helpers ───────────────────────────────────────────────────────────

    function capacidadesDe(competenciaId: string): any[] {
        return (
            competencias.find((c: any) => String(c.id) === competenciaId)
                ?.capacidades ?? []
        );
    }

    // ── Mutaciones ────────────────────────────────────────────────────────

    function toggleCompetencia(competenciaId: string) {
        if (competenciasSeleccionadas.has(competenciaId)) {
            competenciasSeleccionadas.delete(competenciaId);
            // Limpiar las capacidades hijas
            for (const cap of capacidadesDe(competenciaId)) {
                criteriosPorCapacidad.delete(String(cap.id));
            }
        } else {
            competenciasSeleccionadas.add(competenciaId);
        }
        competenciasSeleccionadas = new Set(competenciasSeleccionadas);
        criteriosPorCapacidad = new Map(criteriosPorCapacidad);
    }

    function toggleCapacidad(capacidadId: string) {
        if (criteriosPorCapacidad.has(capacidadId)) {
            criteriosPorCapacidad.delete(capacidadId);
        } else {
            criteriosPorCapacidad.set(capacidadId, [""]);
        }
        criteriosPorCapacidad = new Map(criteriosPorCapacidad);
    }

    function agregarCriterio(capacidadId: string) {
        const prev = criteriosPorCapacidad.get(capacidadId) ?? [];
        criteriosPorCapacidad.set(capacidadId, [...prev, ""]);
        criteriosPorCapacidad = new Map(criteriosPorCapacidad);
    }

    function quitarCriterio(capacidadId: string, idx: number) {
        const prev = criteriosPorCapacidad.get(capacidadId) ?? [];
        if (prev.length <= 1) return;
        criteriosPorCapacidad.set(
            capacidadId,
            prev.filter((_, i) => i !== idx),
        );
        criteriosPorCapacidad = new Map(criteriosPorCapacidad);
    }

    function setCriterio(capacidadId: string, idx: number, valor: string) {
        const arr = criteriosPorCapacidad.get(capacidadId) ?? [];
        arr[idx] = valor;
        criteriosPorCapacidad.set(capacidadId, arr);
        criteriosPorCapacidad = new Map(criteriosPorCapacidad);
    }

    // ── Conversión → array plano para la API ─────────────────────────────

    function flattenCriterios() {
        const result: {
            competenciaId: string;
            capacidadId: string;
            criterio: string;
            orden: number;
        }[] = [];
        let orden = 1;
        // Recorrer en orden del currículo para consistencia
        for (const comp of competencias) {
            const compId = String(comp.id);
            if (!competenciasSeleccionadas.has(compId)) continue;
            for (const cap of comp.capacidades ?? []) {
                const capId = String(cap.id);
                const textos = criteriosPorCapacidad.get(capId);
                if (!textos) continue;
                for (const texto of textos) {
                    if (texto.trim()) {
                        result.push({
                            competenciaId: compId,
                            capacidadId: capId,
                            criterio: texto.trim(),
                            orden: orden++,
                        });
                    }
                }
            }
        }
        return result;
    }

    // ── Cargar al editar ──────────────────────────────────────────────────

    function cargarDesde(criterios: SesionCriterio[]) {
        const compSet = new Set<string>();
        const capMap = new Map<string, string[]>();
        for (const c of criterios) {
            const compId = String(c.competenciaId);
            const capId = String(c.capacidadId);
            compSet.add(compId);
            if (!capMap.has(capId)) capMap.set(capId, []);
            capMap.get(capId)!.push(c.criterio);
        }
        competenciasSeleccionadas = compSet;
        criteriosPorCapacidad = capMap;
    }

    function resetForm() {
        competenciasSeleccionadas = new Set();
        criteriosPorCapacidad = new Map();
    }

    // ── Apertura del modal ────────────────────────────────────────────────

    function abrirCrear() {
        editando = null;
        formTitulo = "";
        formProducto = "";
        formFecha = new Date().toISOString().split("T")[0];
        resetForm();
        error = "";
        modalAbierto = true;
    }

    function abrirEditar(s: SesionConCriterios) {
        editando = s;
        formTitulo = s.titulo;
        formProducto = s.producto;
        const _f: any = s.fecha;
        formFecha = (_f instanceof Date ? _f.toISOString() : String(_f)).split("T")[0];
        cargarDesde(s.criterios);
        error = "";
        modalAbierto = true;
    }

    function cerrarModal() {
        modalAbierto = false;
        error = "";
    }

    // ── Guardar ───────────────────────────────────────────────────────────

    async function guardar() {
        if (!formTitulo.trim() || !formProducto.trim() || !formFecha) {
            error = "Completa el título, producto y fecha.";
            return;
        }
        if (competenciasSeleccionadas.size === 0) {
            error = "Selecciona al menos una competencia.";
            return;
        }
        if (criteriosPorCapacidad.size === 0) {
            error = "Selecciona al menos una capacidad para evaluar.";
            return;
        }
        for (const [capId, textos] of criteriosPorCapacidad) {
            if (!textos.some((t) => t.trim())) {
                let nombre = capId;
                for (const comp of competencias) {
                    const cap = comp.capacidades?.find(
                        (c: any) => String(c.id) === capId,
                    );
                    if (cap) {
                        nombre = cap.nombre;
                        break;
                    }
                }
                error = `Escribe al menos un criterio para "${nombre}".`;
                return;
            }
        }

        const criterios = flattenCriterios();
        if (criterios.length === 0) {
            error = "Escribe al menos un criterio de evaluación.";
            return;
        }

        cargando = true;
        error = "";

        const body = {
            ...(editando ? { id: editando.id } : {}),
            bimestreId,
            gradoId,
            titulo: formTitulo.trim(),
            producto: formProducto.trim(),
            fecha: formFecha,
            criterios,
        };

        try {
            const res = await fetch(`/api/sesiones/${seccionId}`, {
                method: editando ? "PUT" : "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(body),
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
                exito = "Sesión actualizada.";
            } else {
                lista = [...lista, json.data];
                exito = "Sesión creada.";
            }
            cerrarModal();
        } catch {
            error = "No se pudo conectar con el servidor.";
        } finally {
            cargando = false;
        }
    }

    // ── Eliminar ──────────────────────────────────────────────────────────

    async function eliminar(s: SesionConCriterios) {
        if (!confirm(`¿Eliminar la sesión "${s.titulo}"?`)) return;
        cargando = true;
        error = "";
        exito = "";
        try {
            const res = await fetch(`/api/sesiones/${seccionId}`, {
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
            exito = "Sesión eliminada.";
        } catch {
            error = "No se pudo conectar con el servidor.";
        } finally {
            cargando = false;
        }
    }

    // ── Display ───────────────────────────────────────────────────────────

    function nombreCapacidad(capacidadId: string) {
        for (const comp of competencias) {
            const cap = comp.capacidades?.find(
                (c: any) => String(c.id) === String(capacidadId),
            );
            if (cap) return cap.nombre;
        }
        return capacidadId;
    }

    function formatFecha(fecha: string) {
        const raw: any = fecha;
        let d: Date;
        if (raw instanceof Date) {
            d = raw;
        } else {
            const s = String(raw).split("T")[0];
            d = new Date(s + "T12:00:00");
        }
        if (isNaN(d.getTime())) return "";
        return d.toLocaleDateString("es-PE", {
            day: "2-digit",
            month: "short",
            year: "numeric",
        });
    }

    $: activas = lista.filter((s) => s.estado === 1);
</script>

<!-- ═══════════════════════════════════════════════════════════════════════
     BARRA SUPERIOR
════════════════════════════════════════════════════════════════════════ -->
<div class="flex items-center justify-between mb-4">
    <span class="text-sm text-gray-500">
        {activas.length} sesión{activas.length !== 1 ? "es" : ""}
    </span>
    <div class="flex items-center gap-2">
        <a
            href={`/app/${bimestreId}/${gradoId}/${seccionId}/examen-diagnostico`}
            class="flex items-center gap-1.5 text-sm text-amber-700 bg-amber-50
                   hover:bg-amber-100 border border-amber-200 rounded-lg px-3 py-2 transition-colors"
        >
            <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
                <path
                    d="M3 2h10a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1H3a1 1 0 0 1-1-1V3a1 1 0 0 1 1-1z"
                    stroke="currentColor" stroke-width="1.5" stroke-linecap="round"
                />
                <path
                    d="M5 6h6M5 9h4"
                    stroke="currentColor" stroke-width="1.5" stroke-linecap="round"
                />
            </svg>
            Evaluación diagnóstica
        </a>
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
            Nueva sesión
        </button>
    </div>
</div>

{#if error && !modalAbierto}
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

<!-- ═══════════════════════════════════════════════════════════════════════
     LISTA DE SESIONES
════════════════════════════════════════════════════════════════════════ -->
{#if activas.length === 0}
    <div class="text-center py-16 text-gray-400">
        <p class="text-sm">No hay sesiones registradas.</p>
        <p class="text-sm mt-1">Crea la primera sesión del bimestre.</p>
    </div>
{:else}
    <div class="flex flex-col gap-2">
        {#each activas as sesion}
            <div
                class="bg-white border border-gray-200 rounded-xl px-5 py-4 hover:border-gray-300 transition-colors"
            >
                <div class="flex items-start justify-between gap-4">
                    <div class="flex-1 min-w-0">
                        <p class="text-sm font-medium text-gray-900">
                            {sesion.titulo}
                        </p>
                        <p class="text-xs text-gray-400 mt-0.5">
                            {formatFecha(sesion.fecha)}
                        </p>
                        <div class="mt-2 flex flex-col gap-1">
                            {#each sesion.criterios as criterio}
                                <div class="text-xs text-gray-500 flex gap-1.5">
                                    <span class="text-gray-300">▸</span>
                                    <span class="truncate">
                                        <span class="text-gray-400"
                                            >{nombreCapacidad(
                                                criterio.capacidadId,
                                            )}:</span
                                        >
                                        {criterio.criterio}
                                    </span>
                                </div>
                            {/each}
                        </div>
                    </div>
                    <div class="flex items-center gap-2 shrink-0">
                        <a
                            href={`/app/${bimestreId}/${gradoId}/${seccionId}/sesiones/${sesion.id}`}
                            class="text-xs text-blue-600 border border-blue-200 rounded-lg px-2.5 py-1.5 hover:bg-blue-50 transition-colors"
                            >Evaluar</a
                        >
                        <button
                            on:click={() => abrirEditar(sesion)}
                            title="Editar"
                            class="text-gray-400 hover:text-blue-600 transition-colors cursor-pointer"
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
                            on:click={() => eliminar(sesion)}
                            title="Eliminar"
                            class="text-gray-400 hover:text-red-500 transition-colors cursor-pointer"
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
                    </div>
                </div>
            </div>
        {/each}
    </div>
{/if}

<!-- ═══════════════════════════════════════════════════════════════════════
     MODAL
════════════════════════════════════════════════════════════════════════ -->
{#if modalAbierto}
    <div
        class="fixed inset-0 bg-black/30 flex items-start justify-center z-50 p-4 overflow-y-auto"
    >
        <div
            class="bg-white rounded-2xl shadow-xl w-full max-w-2xl my-8 flex flex-col"
        >
            <!-- Cabecera -->
            <div
                class="flex items-center justify-between px-6 py-4 border-b border-gray-100 shrink-0"
            >
                <h2 class="text-base font-semibold text-gray-900">
                    {editando ? "Editar sesión" : "Nueva sesión"}
                </h2>
                <button
                    on:click={cerrarModal}
                    class="text-gray-400 hover:text-gray-600 transition-colors cursor-pointer"
                    aria-label="Cerrar"
                >
                    <svg width="18" height="18" viewBox="0 0 16 16" fill="none">
                        <path
                            d="M2 2l12 12M14 2L2 14"
                            stroke="currentColor"
                            stroke-width="1.5"
                            stroke-linecap="round"
                        />
                    </svg>
                </button>
            </div>

            <!-- Cuerpo scrolleable -->
            <div class="px-6 py-5 flex flex-col gap-6 overflow-y-auto">
                <!-- ── Datos básicos ── -->
                <div class="grid grid-cols-2 gap-4">
                    <div class="col-span-2">
                        <label
                            for="s-titulo"
                            class="block text-sm font-medium text-gray-700 mb-1"
                            >Título de la sesión</label
                        >
                        <input
                            id="s-titulo"
                            type="text"
                            bind:value={formTitulo}
                            placeholder="Ej: Leemos textos narrativos"
                            class="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                    </div>
                    <div>
                        <label
                            for="s-producto"
                            class="block text-sm font-medium text-gray-700 mb-1"
                            >Producto esperado</label
                        >
                        <input
                            id="s-producto"
                            type="text"
                            bind:value={formProducto}
                            placeholder="Ej: Resumen del texto leído"
                            class="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                    </div>
                    <div>
                        <label
                            for="s-fecha"
                            class="block text-sm font-medium text-gray-700 mb-1"
                            >Fecha</label
                        >
                        <input
                            id="s-fecha"
                            type="date"
                            bind:value={formFecha}
                            class="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                    </div>
                </div>

                <div class="border-t border-gray-100"></div>

                <!-- ── Competencias ── -->
                <div>
                    <p class="text-sm font-semibold text-gray-800 mb-0.5">
                        Competencias y criterios
                    </p>
                    <p class="text-xs text-gray-400 mb-4">
                        Marca una o más competencias → elige las capacidades a
                        evaluar → escribe el criterio de cada capacidad.
                    </p>

                    <div class="flex flex-col gap-3">
                        {#each competencias as comp}
                            {@const compId = String(comp.id)}
                            {@const compActiva =
                                competenciasSeleccionadas.has(compId)}

                            <div
                                class="border rounded-xl overflow-hidden
                                        {compActiva
                                    ? 'border-blue-200'
                                    : 'border-gray-200'}"
                            >
                                <!-- ── Fila de competencia ── -->
                                <button
                                    type="button"
                                    on:click={() => toggleCompetencia(compId)}
                                    class="w-full flex items-center gap-3 px-4 py-3 text-left cursor-pointer transition-colors
                                           {compActiva
                                        ? 'bg-blue-50 hover:bg-blue-100/70'
                                        : 'bg-gray-50 hover:bg-gray-100'}"
                                >
                                    <!-- Checkbox -->
                                    <span
                                        class="shrink-0 w-4 h-4 rounded border-2 flex items-center justify-center transition-colors
                                                 {compActiva
                                            ? 'bg-blue-600 border-blue-600'
                                            : 'border-gray-400'}"
                                    >
                                        {#if compActiva}
                                            <svg
                                                width="9"
                                                height="7"
                                                viewBox="0 0 9 7"
                                                fill="none"
                                            >
                                                <path
                                                    d="M1 3.5L3.5 6L8 1"
                                                    stroke="white"
                                                    stroke-width="1.5"
                                                    stroke-linecap="round"
                                                    stroke-linejoin="round"
                                                />
                                            </svg>
                                        {/if}
                                    </span>
                                    <span
                                        class="text-sm font-medium {compActiva
                                            ? 'text-blue-800'
                                            : 'text-gray-700'}"
                                    >
                                        {comp.nombre}
                                    </span>
                                </button>

                                <!-- ── Capacidades (despliega si la competencia está activa) ── -->
                                {#if compActiva}
                                    <div
                                        class="border-t border-blue-100 divide-y divide-gray-100"
                                    >
                                        {#each comp.capacidades ?? [] as cap}
                                            {@const capId = String(cap.id)}
                                            {@const capActiva =
                                                criteriosPorCapacidad.has(
                                                    capId,
                                                )}
                                            {@const criterios =
                                                criteriosPorCapacidad.get(
                                                    capId,
                                                ) ?? []}

                                            <div
                                                class="px-4 py-3 {capActiva
                                                    ? 'bg-white'
                                                    : 'bg-gray-50/40'}"
                                            >
                                                <!-- Fila de capacidad -->
                                                <button
                                                    type="button"
                                                    on:click={() =>
                                                        toggleCapacidad(capId)}
                                                    class="flex items-start gap-2.5 w-full text-left group cursor-pointer"
                                                >
                                                    <span
                                                        class="mt-0.5 shrink-0 w-4 h-4 rounded border-2 flex items-center justify-center transition-colors
                                                                 {capActiva
                                                            ? 'bg-blue-500 border-blue-500'
                                                            : 'border-gray-300 group-hover:border-blue-300'}"
                                                    >
                                                        {#if capActiva}
                                                            <svg
                                                                width="8"
                                                                height="6"
                                                                viewBox="0 0 9 7"
                                                                fill="none"
                                                            >
                                                                <path
                                                                    d="M1 3.5L3.5 6L8 1"
                                                                    stroke="white"
                                                                    stroke-width="1.5"
                                                                    stroke-linecap="round"
                                                                    stroke-linejoin="round"
                                                                />
                                                            </svg>
                                                        {/if}
                                                    </span>
                                                    <span
                                                        class="text-sm transition-colors
                                                                 {capActiva
                                                            ? 'text-gray-900 font-medium'
                                                            : 'text-gray-500 group-hover:text-gray-700'}"
                                                    >
                                                        {cap.nombre}
                                                    </span>
                                                </button>

                                                <!-- Criterios de esta capacidad -->
                                                {#if capActiva}
                                                    <div
                                                        class="mt-3 ml-6 flex flex-col gap-2"
                                                    >
                                                        {#each criterios as texto, critIdx}
                                                            <div
                                                                class="flex items-start gap-2"
                                                            >
                                                                <span
                                                                    class="mt-2.25 shrink-0 text-xs text-gray-300 leading-none select-none"
                                                                    >↳</span
                                                                >
                                                                <textarea
                                                                    value={texto}
                                                                    on:input={(
                                                                        e,
                                                                    ) =>
                                                                        setCriterio(
                                                                            capId,
                                                                            critIdx,
                                                                            e
                                                                                .currentTarget
                                                                                .value,
                                                                        )}
                                                                    rows="2"
                                                                    placeholder="¿Cómo evaluarás esta capacidad en esta sesión?"
                                                                    class="flex-1 border border-gray-200 rounded-lg px-2.5 py-1.5 text-sm
                                                                           focus:outline-none focus:ring-1 focus:ring-blue-400
                                                                           resize-none placeholder:text-gray-300"
                                                                ></textarea>
                                                                {#if criterios.length > 1}
                                                                    <button
                                                                        type="button"
                                                                        on:click={() =>
                                                                            quitarCriterio(
                                                                                capId,
                                                                                critIdx,
                                                                            )}
                                                                        title="Quitar criterio"
                                                                        class="mt-2 shrink-0 text-gray-300 hover:text-red-400 transition-colors cursor-pointer"
                                                                    >
                                                                        <svg
                                                                            width="12"
                                                                            height="12"
                                                                            viewBox="0 0 16 16"
                                                                            fill="none"
                                                                        >
                                                                            <path
                                                                                d="M2 2l12 12M14 2L2 14"
                                                                                stroke="currentColor"
                                                                                stroke-width="1.5"
                                                                                stroke-linecap="round"
                                                                            />
                                                                        </svg>
                                                                    </button>
                                                                {/if}
                                                            </div>
                                                        {/each}

                                                        <button
                                                            type="button"
                                                            on:click={() =>
                                                                agregarCriterio(
                                                                    capId,
                                                                )}
                                                            class="ml-4 text-xs text-blue-500 hover:text-blue-700 text-left cursor-pointer transition-colors w-fit"
                                                        >
                                                            + Agregar otro
                                                            criterio
                                                        </button>
                                                    </div>
                                                {/if}
                                            </div>
                                        {/each}
                                    </div>
                                {/if}
                            </div>
                        {/each}
                    </div>
                </div>

                {#if error}
                    <p
                        class="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2"
                    >
                        {error}
                    </p>
                {/if}
            </div>

            <!-- Footer -->
            <div
                class="flex justify-end gap-2 px-6 py-4 border-t border-gray-100 bg-gray-50 rounded-b-2xl shrink-0"
            >
                <button
                    on:click={cerrarModal}
                    class="text-sm text-gray-600 border border-gray-300 rounded-lg px-4 py-2 hover:bg-white transition-colors cursor-pointer"
                    >Cancelar</button
                >
                <button
                    on:click={guardar}
                    disabled={cargando}
                    class="text-sm text-white bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300 rounded-lg px-4 py-2 transition-colors cursor-pointer disabled:cursor-not-allowed"
                >
                    {cargando
                        ? "Guardando..."
                        : editando
                          ? "Guardar cambios"
                          : "Crear sesión"}
                </button>
            </div>
        </div>
    </div>
{/if}