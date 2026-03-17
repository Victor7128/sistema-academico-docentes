<script lang="ts">
    import type { Alumno, Sesion, SesionCriterio, Nota } from "../../lib/types";

    // ── Props ─────────────────────────────────────────────────────────────
    export let alumnos: Alumno[];
    export let sesiones: (Sesion & { criterios: SesionCriterio[] })[];
    export let evaluaciones: {
        sesionCriterioId: number;
        sesionId: number;
        alumnoId: number;
        nota: string;
    }[] = [];
    export let consolidadosIniciales: { alumnoId: number; notaFinal: string }[] = [];
    export let curriculo: any = null;
    export let bimestreId: number;
    export let seccionId: number;
    export let seccionNombre = "";
    export let gradoNombre   = "";
    export let bimestreNombre = "";

    // ── Constantes ────────────────────────────────────────────────────────
    const NOTAS: Nota[] = ["AD", "A", "B", "C"];
    const NOTA_COLORES: Record<string, string> = {
        AD: "bg-indigo-100 text-indigo-700 font-semibold",
        A:  "bg-green-100  text-green-700  font-semibold",
        B:  "bg-amber-100  text-amber-700  font-semibold",
        C:  "bg-red-100    text-red-600    font-semibold",
        "": "text-gray-300",
    };

    // ── Estado ────────────────────────────────────────────────────────────
    let calculando = false;
    let exportando  = false;
    let error       = "";
    let exito       = "";

    // Mapa de evaluaciones: `alumnoId_criterioId` → nota
    $: evalMap = (() => {
        const m: Record<string, string> = {};
        for (const e of evaluaciones) m[`${e.alumnoId}_${e.sesionCriterioId}`] = e.nota;
        return m;
    })();

    // Consolidados guardados: alumnoId → notaFinal
    $: consolidadoMap = (() => {
        const m: Record<number, string> = {};
        for (const c of consolidadosIniciales) m[c.alumnoId] = c.notaFinal;
        return m;
    })();

    // ── Helpers de display ────────────────────────────────────────────────
    function nombreCapacidad(id: string): string {
        for (const comp of curriculo?.competencias ?? []) {
            const cap = comp.capacidades?.find((c: any) => String(c.id) === String(id));
            if (cap) return cap.nombre;
        }
        return id;
    }

    function notaNumerica(nota: string): number {
        return { AD: 4, A: 3, B: 2, C: 1 }[nota] ?? 0;
    }

    // Nota más frecuente de un alumno en una sesión (para referencia)
    function notaResumenSesion(alumnoId: number, sesion: Sesion & { criterios: SesionCriterio[] }): string {
        const notas = sesion.criterios
            .map((c) => evalMap[`${alumnoId}_${c.id}`])
            .filter(Boolean);
        if (!notas.length) return "";
        // Moda; en empate, la mayor
        const conteo: Record<string, number> = {};
        for (const n of notas) conteo[n] = (conteo[n] ?? 0) + 1;
        let mejor = "";
        for (const n of NOTAS) {
            if (!mejor || conteo[n] > (conteo[mejor] ?? 0) || (conteo[n] === conteo[mejor] && notaNumerica(n) > notaNumerica(mejor))) {
                mejor = n;
            }
        }
        return mejor;
    }

    // ── Calcular consolidado ──────────────────────────────────────────────
    async function calcularConsolidado() {
        calculando = true;
        error = "";
        exito = "";
        try {
            const res = await fetch(`/api/consolidado/${bimestreId}`, {
                method:  "POST",
                headers: { "Content-Type": "application/json" },
                body:    JSON.stringify({ seccionId }),
            });
            const json = await res.json();
            if (!res.ok) { error = json.error ?? "Error al calcular."; return; }
            exito = `Consolidado calculado para ${json.data.calculados} alumno${json.data.calculados !== 1 ? "s" : ""}.`;
            // Recargar para ver los nuevos valores
            setTimeout(() => location.reload(), 800);
        } catch {
            error = "No se pudo conectar con el servidor.";
        } finally {
            calculando = false;
        }
    }

    // ── Exportar a Excel (.xlsx) ──────────────────────────────────────────
    async function exportarExcel() {
        exportando = true;
        try {
            // Importar SheetJS dinámicamente
            const XLSX = await import("https://cdn.sheetjs.com/xlsx-0.20.3/package/xlsx.mjs" as any);

            // Construir encabezados
            const headerRow1: string[] = ["N°", "Apellidos y Nombres"];
            const headerRow2: string[] = ["",   ""];
            const headerRow3: string[] = ["",   ""];

            for (const sesion of sesiones) {
                // Fila 1: título de sesión abarcando criterios + promedio
                const totalCols = sesion.criterios.length + 1; // +1 = promedio
                headerRow1.push(sesion.titulo);
                for (let i = 1; i < totalCols; i++) headerRow1.push("");

                // Fila 2: capacidades
                for (const criterio of sesion.criterios) {
                    headerRow2.push(nombreCapacidad(String(criterio.capacidadId)));
                }
                headerRow2.push("Promedio sesión");

                // Fila 3: criterio descripción
                for (const criterio of sesion.criterios) {
                    headerRow3.push(criterio.criterio);
                }
                headerRow3.push("(completar)");
            }
            headerRow1.push("Nota Final");
            headerRow2.push("");
            headerRow3.push("");

            // Filas de datos
            const dataRows = alumnos.map((alumno, idx) => {
                const row: (string | number)[] = [
                    idx + 1,
                    `${alumno.apellido}, ${alumno.nombre}`,
                ];
                for (const sesion of sesiones) {
                    for (const criterio of sesion.criterios) {
                        row.push(evalMap[`${alumno.id}_${criterio.id}`] ?? "");
                    }
                    // Columna de promedio → vacía para que el docente rellene
                    row.push("");
                }
                row.push(consolidadoMap[alumno.id] ?? "");
                return row;
            });

            const wsData = [headerRow1, headerRow2, headerRow3, ...dataRows];
            const ws = XLSX.utils.aoa_to_sheet(wsData);

            // Merge de celdas para las sesiones en fila 1
            const merges: any[] = [];
            let col = 2; // empieza tras N° y Nombre
            for (const sesion of sesiones) {
                const span = sesion.criterios.length + 1;
                if (span > 1) {
                    merges.push({ s: { r: 0, c: col }, e: { r: 0, c: col + span - 1 } });
                }
                col += span;
            }
            if (merges.length) ws["!merges"] = merges;

            // Anchos de columna
            ws["!cols"] = [
                { wch: 4 },   // N°
                { wch: 30 },  // Nombre
                ...sesiones.flatMap((s) => [
                    ...s.criterios.map(() => ({ wch: 12 })),
                    { wch: 16 }, // promedio
                ]),
                { wch: 12 },  // Nota final
            ];

            const wb = XLSX.utils.book_new();
            const nombreHoja = `${gradoNombre} ${seccionNombre}`.slice(0, 31);
            XLSX.utils.book_append_sheet(wb, ws, nombreHoja);
            XLSX.writeFile(wb, `Consolidado_${bimestreNombre}_${gradoNombre}_Sec${seccionNombre}.xlsx`);
        } catch (e) {
            error = "No se pudo generar el archivo Excel.";
            console.error(e);
        } finally {
            exportando = false;
        }
    }

    // ── Cabeceras agrupadas (para la tabla HTML) ──────────────────────────
    // Igual que en EvaluacionForm: colspan por sesión
    $: sesionesConTotal = sesiones.map((s) => ({
        ...s,
        totalCols: s.criterios.length + 1, // +1 = col promedio
    }));
</script>

<!-- ═══════════════════════════════════════════════════════════════════════
     BARRA DE ACCIONES
════════════════════════════════════════════════════════════════════════ -->
<div class="flex items-center justify-between gap-3 mb-5 flex-wrap">
    <p class="text-sm text-gray-500">
        {alumnos.length} alumno{alumnos.length !== 1 ? "s" : ""} ·
        {sesiones.length} sesión{sesiones.length !== 1 ? "es" : ""}
    </p>

    <div class="flex items-center gap-2">
        <!-- Exportar -->
        <button
            on:click={exportarExcel}
            disabled={exportando || sesiones.length === 0}
            class="flex items-center gap-1.5 text-sm text-green-700 border border-green-300
                   bg-green-50 hover:bg-green-100 rounded-lg px-3 py-2 transition-colors
                   cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
        >
            <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
                <path d="M8 2v8M4 7l4 4 4-4M2 13h12" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" />
            </svg>
            {exportando ? "Generando..." : "Exportar Excel"}
        </button>

        <!-- Calcular consolidado -->
        <button
            on:click={calcularConsolidado}
            disabled={calculando}
            class="flex items-center gap-1.5 text-sm text-white bg-blue-600
                   hover:bg-blue-700 disabled:bg-blue-300 rounded-lg px-3 py-2
                   transition-colors cursor-pointer disabled:cursor-not-allowed"
        >
            <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
                <path d="M2 8a6 6 0 1 1 12 0A6 6 0 0 1 2 8z" stroke="currentColor" stroke-width="1.5"/>
                <path d="M8 5v3l2 2" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
            </svg>
            {calculando ? "Calculando..." : "Calcular consolidado"}
        </button>
    </div>
</div>

{#if error}
    <p class="mb-4 text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{error}</p>
{/if}
{#if exito}
    <p class="mb-4 text-sm text-green-700 bg-green-50 border border-green-200 rounded-lg px-3 py-2">{exito}</p>
{/if}

<!-- ═══════════════════════════════════════════════════════════════════════
     LEYENDA
════════════════════════════════════════════════════════════════════════ -->
<div class="flex items-center gap-4 mb-4 flex-wrap">
    <span class="text-xs text-gray-400">Referencias:</span>
    {#each NOTAS as nota}
        <span class="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full {NOTA_COLORES[nota]}">{nota}</span>
    {/each}
    <span class="text-xs text-gray-400 ml-2">
        · La columna <span class="font-medium text-gray-600">Prom. sesión</span> se completa en Excel
    </span>
</div>

<!-- ═══════════════════════════════════════════════════════════════════════
     CASOS VACÍOS
════════════════════════════════════════════════════════════════════════ -->
{#if sesiones.length === 0}
    <div class="text-center py-16 text-gray-400">
        <p class="text-sm">No hay sesiones registradas en este bimestre.</p>
    </div>
{:else if alumnos.length === 0}
    <div class="text-center py-16 text-gray-400">
        <p class="text-sm">No hay alumnos activos en esta sección.</p>
    </div>

<!-- ═══════════════════════════════════════════════════════════════════════
     TABLA
════════════════════════════════════════════════════════════════════════ -->
{:else}
    <div class="overflow-x-auto rounded-xl border border-gray-200">
        <table class="w-full border-collapse text-sm">
            <thead>

                <!-- Fila 1: sesiones -->
                <tr class="border-b border-gray-200">
                    <th
                        rowspan="3"
                        class="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase
                               tracking-wider sticky left-0 bg-gray-50 z-10 border-r border-gray-200
                               min-w-44 align-bottom"
                    >
                        Alumno
                    </th>

                    {#each sesionesConTotal as sesion, si}
                        <th
                            colspan={sesion.totalCols}
                            class="px-3 py-2 text-center text-xs font-semibold text-indigo-700
                                   bg-indigo-50
                                   {si < sesiones.length - 1 ? 'border-r border-indigo-200' : ''}"
                        >
                            <span class="line-clamp-1 leading-tight">{sesion.titulo}</span>
                            <span class="block text-[10px] font-normal text-indigo-400 mt-0.5">
                                {new Date(sesion.fecha + "T12:00:00").toLocaleDateString("es-PE", { day:"2-digit", month:"short" })}
                            </span>
                        </th>
                    {/each}

                    <!-- Nota final -->
                    <th
                        rowspan="3"
                        class="px-3 py-3 text-center text-xs font-semibold text-gray-600 uppercase
                               tracking-wider bg-gray-100 border-l border-gray-300 align-bottom min-w-24"
                    >
                        Nota<br/>Final
                    </th>
                </tr>

                <!-- Fila 2: capacidades + "Prom. sesión" -->
                <tr class="border-b border-gray-200">
                    {#each sesionesConTotal as sesion, si}
                        {#each sesion.criterios as criterio, ci}
                            <th class="px-2 py-1.5 text-center text-[10px] font-medium text-blue-700
                                       bg-blue-50 max-w-28
                                       {ci < sesion.criterios.length - 1 ? 'border-r border-blue-100' : ''}">
                                <span class="line-clamp-2 leading-tight">
                                    {nombreCapacidad(String(criterio.capacidadId))}
                                </span>
                            </th>
                        {/each}
                        <!-- Columna promedio de la sesión -->
                        <th class="px-2 py-1.5 text-center text-[10px] font-semibold text-orange-600
                                   bg-orange-50
                                   {si < sesiones.length - 1 ? 'border-r border-orange-200' : ''}">
                            Prom.<br/>sesión
                        </th>
                    {/each}
                </tr>

                <!-- Fila 3: criterio descripción -->
                <tr class="bg-gray-50 border-b border-gray-200">
                    {#each sesionesConTotal as sesion, si}
                        {#each sesion.criterios as criterio, ci}
                            <th class="px-2 py-2 text-center min-w-28
                                       {ci < sesion.criterios.length - 1 ? 'border-r border-gray-200' : ''}">
                                <span
                                    class="block text-[10px] text-gray-400 font-normal leading-tight
                                           max-w-28 line-clamp-3"
                                    title={criterio.criterio}
                                >
                                    {criterio.criterio}
                                </span>
                            </th>
                        {/each}
                        <!-- Celda promedio: indicación -->
                        <th class="px-2 py-2 text-center min-w-24
                                   {si < sesiones.length - 1 ? 'border-r border-orange-100' : ''}">
                            <span class="block text-[10px] text-orange-400 font-normal leading-tight italic">
                                completar en Excel
                            </span>
                        </th>
                    {/each}
                </tr>

            </thead>

            <tbody class="divide-y divide-gray-100">
                {#each alumnos as alumno, idx}
                    <tr class="hover:bg-gray-50/50 transition-colors group">

                        <!-- Nombre sticky -->
                        <td class="px-4 py-2.5 sticky left-0 z-10 bg-white border-r border-gray-200
                                   group-hover:bg-gray-50/80 transition-colors">
                            <span class="text-xs text-gray-400 mr-1.5">{idx + 1}</span>
                            <span class="text-sm text-gray-900 font-medium whitespace-nowrap">
                                {alumno.apellido}, {alumno.nombre}
                            </span>
                        </td>

                        <!-- Notas por criterio + celda promedio vacía -->
                        {#each sesionesConTotal as sesion, si}
                            {#each sesion.criterios as criterio, ci}
                                {@const nota = evalMap[`${alumno.id}_${criterio.id}`] ?? ""}
                                <td class="px-2 py-2 text-center
                                           {ci < sesion.criterios.length - 1 ? 'border-r border-gray-100' : ''}">
                                    {#if nota}
                                        <span class="inline-block px-2 py-0.5 rounded text-xs {NOTA_COLORES[nota]}">
                                            {nota}
                                        </span>
                                    {:else}
                                        <span class="text-gray-200 text-xs">—</span>
                                    {/if}
                                </td>
                            {/each}

                            <!-- Celda promedio: vacía con fondo tenue, para que el docente note que va aquí -->
                            <td class="px-2 py-2 text-center bg-orange-50/40
                                       {si < sesiones.length - 1 ? 'border-r border-orange-100' : ''}">
                                <span class="text-[10px] text-orange-300 italic">—</span>
                            </td>
                        {/each}

                        <!-- Nota final calculada -->
                        <td class="px-3 py-2 text-center border-l border-gray-200 bg-gray-50/60">
                            {#if consolidadoMap[alumno.id]}
                                <span class="inline-block px-2.5 py-0.5 rounded-full text-xs font-bold
                                             {NOTA_COLORES[consolidadoMap[alumno.id]]}">
                                    {consolidadoMap[alumno.id]}
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