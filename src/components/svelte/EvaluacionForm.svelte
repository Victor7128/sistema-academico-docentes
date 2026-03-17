<script lang="ts">
    import type { Sesion, SesionCriterio, Alumno, Evaluacion, Nota } from "../../lib/types";

    export let sesion: Sesion & { criterios: SesionCriterio[] };
    export let alumnos: Alumno[];
    export let evaluacionesIniciales: Evaluacion[] = [];
    export let curriculo: any = null;
    export let sesionId: number;

    type Celda   = Nota | null;
    type NotaMap = Record<string, Celda>;

    const NOTAS: Nota[] = ["AD", "A", "B", "C"];

    // ── Estado ────────────────────────────────────────────────────────────
    let guardando = false;
    let error     = "";
    let exito     = "";

    function buildMap(evs: Evaluacion[]): NotaMap {
        const m: NotaMap = {};
        for (const ev of evs) m[`${ev.alumnoId}_${ev.sesionCriterioId}`] = ev.nota;
        return m;
    }

    let notas:    NotaMap = buildMap(evaluacionesIniciales);
    let guardado: NotaMap = buildMap(evaluacionesIniciales);

    $: criterios    = sesion.criterios ?? [];
    $: hayAlumnos   = alumnos.length > 0;
    $: hayCriterios = criterios.length > 0;

    // ── Progreso ──────────────────────────────────────────────────────────
    $: alumnosCompletos = alumnos.filter((a) =>
        criterios.every((c) => notas[`${a.id}_${c.id}`] != null),
    ).length;
    $: totalCeldas  = alumnos.length * criterios.length;
    $: celdasLlenas = Object.values(notas).filter(Boolean).length;
    $: porcentaje   = totalCeldas > 0 ? Math.round((celdasLlenas / totalCeldas) * 100) : 0;
    $: hayCambios   = JSON.stringify(notas) !== JSON.stringify(guardado);

    // ── Cabeceras agrupadas ───────────────────────────────────────────────
    //
    //  Calculamos "runs" (rachas consecutivas del mismo valor) tanto para
    //  competencias como para capacidades, para saber el colspan de cada celda.
    //
    type HeaderGroup = { id: string; nombre: string; colspan: number };

    function runs(criterios: SesionCriterio[], keyFn: (c: SesionCriterio) => string, nameFn: (id: string) => string): HeaderGroup[] {
        const groups: HeaderGroup[] = [];
        for (const c of criterios) {
            const id = keyFn(c);
            const last = groups[groups.length - 1];
            if (last && last.id === id) {
                last.colspan++;
            } else {
                groups.push({ id, nombre: nameFn(id), colspan: 1 });
            }
        }
        return groups;
    }

    function nombreCompetencia(id: string): string {
        return curriculo?.competencias?.find((c: any) => String(c.id) === id)?.nombre ?? id;
    }

    function nombreCapacidad(id: string): string {
        for (const comp of curriculo?.competencias ?? []) {
            const cap = comp.capacidades?.find((c: any) => String(c.id) === id);
            if (cap) return cap.nombre;
        }
        return id;
    }

    $: gruposCompetencia = runs(criterios, (c) => String(c.competenciaId), nombreCompetencia);
    $: gruposCapacidad   = runs(criterios, (c) => String(c.capacidadId),   nombreCapacidad);

    // ── Mutaciones ────────────────────────────────────────────────────────
    function setNota(alumnoId: number, criterioId: number, nota: Nota) {
        const key  = `${alumnoId}_${criterioId}`;
        notas[key] = notas[key] === nota ? null : nota;
        notas      = { ...notas };
        error      = "";
        exito      = "";
    }

    // ── Guardar ───────────────────────────────────────────────────────────
    async function guardar() {
        guardando = true;
        error     = "";
        exito     = "";

        const evaluaciones: { sesionCriterioId: number; alumnoId: number; nota: Nota }[] = [];
        for (const alumno of alumnos) {
            for (const criterio of criterios) {
                const nota = notas[`${alumno.id}_${criterio.id}`];
                if (nota) evaluaciones.push({ sesionCriterioId: criterio.id, alumnoId: alumno.id, nota });
            }
        }

        try {
            const res  = await fetch(`/api/evaluaciones/${sesionId}`, {
                method:  "POST",
                headers: { "Content-Type": "application/json" },
                body:    JSON.stringify({ evaluaciones }),
            });
            const json = await res.json();
            if (!res.ok) { error = json.error ?? "Error al guardar."; return; }
            guardado = { ...notas };
            exito    = `${json.data.guardados} evaluación${json.data.guardados !== 1 ? "es" : ""} guardada${json.data.guardados !== 1 ? "s" : ""}.`;
        } catch {
            error = "No se pudo conectar con el servidor.";
        } finally {
            guardando = false;
        }
    }

    // ── Colores ───────────────────────────────────────────────────────────
    function notaColor(nota: Nota, sel: boolean): string {
        if (!sel) return "bg-gray-100 text-gray-400 hover:bg-gray-200 hover:text-gray-600";
        return { AD: "bg-indigo-600 text-white", A: "bg-green-600 text-white", B: "bg-amber-500 text-white", C: "bg-red-600 text-white" }[nota];
    }
    function notaDot(nota: Nota): string {
        return { AD: "bg-indigo-500", A: "bg-green-500", B: "bg-amber-400", C: "bg-red-500" }[nota];
    }
</script>

<!-- ═══════════════════════════════════════════════════════════════════════
     CABECERA: progreso + guardar
════════════════════════════════════════════════════════════════════════ -->
<div class="flex items-center justify-between gap-4 mb-4 flex-wrap">
    <div class="flex items-center gap-3">
        <div>
            <p class="text-sm font-medium text-gray-800">
                {alumnosCompletos} / {alumnos.length}
                <span class="text-gray-400 font-normal">alumnos completos</span>
            </p>
            <div class="mt-1 h-1.5 w-48 bg-gray-100 rounded-full overflow-hidden">
                <div class="h-full bg-blue-500 rounded-full transition-all duration-300" style="width: {porcentaje}%"></div>
            </div>
        </div>
        <span class="text-xs text-gray-400">{porcentaje}%</span>
    </div>

    <div class="flex items-center gap-3">
        {#if hayCambios}
            <span class="text-xs text-amber-600 flex items-center gap-1">
                <span class="inline-block w-1.5 h-1.5 rounded-full bg-amber-500"></span>
                Cambios sin guardar
            </span>
        {/if}
        <button
            on:click={guardar}
            disabled={guardando || !hayCambios}
            class="text-sm text-white bg-blue-600 hover:bg-blue-700
                   disabled:bg-gray-200 disabled:text-gray-400
                   rounded-lg px-4 py-2 transition-colors cursor-pointer
                   disabled:cursor-not-allowed font-medium"
        >
            {guardando ? "Guardando..." : "Guardar"}
        </button>
    </div>
</div>

{#if error}
    <p class="mb-4 text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{error}</p>
{/if}
{#if exito}
    <p class="mb-4 text-sm text-green-700 bg-green-50 border border-green-200 rounded-lg px-3 py-2">{exito}</p>
{/if}

<!-- leyenda -->
<div class="flex items-center gap-3 mb-4 flex-wrap">
    <span class="text-xs text-gray-400">Notas:</span>
    {#each NOTAS as nota}
        <span class="flex items-center gap-1 text-xs text-gray-600">
            <span class="inline-block w-2 h-2 rounded-full {notaDot(nota)}"></span>
            {nota} —
            {#if nota === "AD"}Logro destacado
            {:else if nota === "A"}Logro esperado
            {:else if nota === "B"}En proceso
            {:else}En inicio{/if}
        </span>
    {/each}
</div>

<!-- ═══════════════════════════════════════════════════════════════════════
     CASOS VACÍOS
════════════════════════════════════════════════════════════════════════ -->
{#if !hayAlumnos}
    <div class="text-center py-16 text-gray-400">
        <p class="text-sm">No hay alumnos activos en esta sección.</p>
    </div>
{:else if !hayCriterios}
    <div class="text-center py-16 text-gray-400">
        <p class="text-sm">Esta sesión no tiene criterios de evaluación.</p>
    </div>

<!-- ═══════════════════════════════════════════════════════════════════════
     TABLA
════════════════════════════════════════════════════════════════════════ -->
{:else}
    <div class="overflow-x-auto rounded-xl border border-gray-200">
        <table class="w-full border-collapse text-sm">
            <thead>

                <!-- ── Fila 1: Competencias ── -->
                <tr class="border-b border-gray-200">
                    <!-- celda vacía sobre la columna de alumno -->
                    <th
                        rowspan="3"
                        class="col-nombre text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase
                               tracking-wider sticky left-0 bg-gray-50 z-10 border-r border-gray-200
                               align-bottom"
                    >
                        Alumno
                    </th>

                    {#each gruposCompetencia as grupo, i}
                        <th
                            colspan={grupo.colspan}
                            class="px-3 py-2 text-center text-xs font-semibold text-indigo-700
                                   bg-indigo-50
                                   {i < gruposCompetencia.length - 1 ? 'border-r border-indigo-200' : ''}"
                        >
                            <span class="line-clamp-2 leading-tight">{grupo.nombre}</span>
                        </th>
                    {/each}
                </tr>

                <!-- ── Fila 2: Capacidades ── -->
                <tr class="border-b border-gray-200">
                    {#each gruposCapacidad as grupo, i}
                        <th
                            colspan={grupo.colspan}
                            class="px-3 py-2 text-center text-[11px] font-medium text-blue-700
                                   bg-blue-50
                                   {i < gruposCapacidad.length - 1 ? 'border-r border-blue-200' : ''}"
                        >
                            <span class="line-clamp-2 leading-tight">{grupo.nombre}</span>
                        </th>
                    {/each}
                </tr>

                <!-- ── Fila 3: Criterios individuales ── -->
                <tr class="bg-gray-50 border-b border-gray-200">
                    {#each criterios as criterio, idx}
                        <th
                            class="px-3 py-2.5 text-center min-w-40
                                   {idx < criterios.length - 1 ? 'border-r border-gray-200' : ''}"
                        >
                            <div class="flex flex-col items-center gap-0.5">
                                <span class="text-[10px] font-semibold text-gray-400 uppercase tracking-wider">
                                    Criterio {idx + 1}
                                </span>
                                <span
                                    class="text-xs text-gray-500 font-normal leading-tight text-center max-w-36 line-clamp-3"
                                    title={criterio.criterio}
                                >
                                    {criterio.criterio}
                                </span>
                            </div>
                        </th>
                    {/each}
                </tr>

            </thead>

            <!-- ── Cuerpo ── -->
            <tbody class="divide-y divide-gray-100">
                {#each alumnos as alumno}
                    {@const completo = criterios.every((c) => notas[`${alumno.id}_${c.id}`] != null)}

                    <tr class="hover:bg-gray-50/60 transition-colors group {completo ? 'bg-green-50/30' : ''}">

                        <!-- Nombre sticky -->
                        <td class="col-nombre px-2 py-2.5 sticky left-0 z-10 border-r border-gray-200 transition-colors
                                   {completo ? 'bg-green-50/60 group-hover:bg-green-50' : 'bg-white group-hover:bg-gray-50/60'}">
                            <div class="flex items-center gap-1.5">
                                <span class="shrink-0 w-1.5 h-1.5 rounded-full {completo ? 'bg-green-500' : 'bg-gray-200'}"></span>
                                <span class="nombre-completo text-sm text-gray-900 font-medium truncate">
                                    {alumno.apellido}, {alumno.nombre}
                                </span>
                                <span class="nombre-corto text-sm text-gray-900 font-medium truncate">
                                    {alumno.apellido}
                                </span>
                            </div>
                        </td>

                        <!-- Celdas de nota -->
                        {#each criterios as criterio, critIdx}
                            {@const notaActual = notas[`${alumno.id}_${criterio.id}`] ?? null}
                            <td class="px-2 py-2 text-center
                                       {critIdx < criterios.length - 1 ? 'border-r border-gray-100' : ''}">
                                <div class="flex items-center justify-center gap-0.5">
                                    {#each NOTAS as nota}
                                        <button
                                            type="button"
                                            on:click={() => setNota(alumno.id, criterio.id, nota)}
                                            title="{nota}: {nota === 'AD' ? 'Logro destacado' : nota === 'A' ? 'Logro esperado' : nota === 'B' ? 'En proceso' : 'En inicio'}"
                                            class="w-8 h-7 text-xs font-semibold rounded transition-all cursor-pointer
                                                   {notaColor(nota, notaActual === nota)}"
                                        >
                                            {nota}
                                        </button>
                                    {/each}
                                </div>
                            </td>
                        {/each}
                    </tr>
                {/each}
            </tbody>
        </table>
    </div>

    {#if alumnos.length > 10}
        <div class="flex justify-end mt-4">
            <button
                on:click={guardar}
                disabled={guardando || !hayCambios}
                class="text-sm text-white bg-blue-600 hover:bg-blue-700
                       disabled:bg-gray-200 disabled:text-gray-400
                       rounded-lg px-5 py-2.5 transition-colors cursor-pointer
                       disabled:cursor-not-allowed font-medium"
            >
                {guardando ? "Guardando..." : "Guardar evaluaciones"}
            </button>
        </div>
    {/if}
{/if}
<style>
  /* ── Columna de nombres responsive ── */
  .col-nombre {
    width: 120px;
    min-width: 120px;
    max-width: 120px;
  }
  /* En desktop muestra nombre completo, oculta el corto */
  .nombre-corto  { display: none; }
  .nombre-completo { display: block; }

  @media (max-width: 640px) {
    .col-nombre {
      width: 90px;
      min-width: 90px;
      max-width: 90px;
    }
    /* En móvil solo muestra apellido */
    .nombre-completo { display: none; }
    .nombre-corto    { display: block; }
  }

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