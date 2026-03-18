<script lang="ts">
    import type { Alumno, Sesion, SesionCriterio, Nota } from "../../lib/types";

    export let alumnos: Alumno[];
    export let sesiones: (Sesion & { criterios: SesionCriterio[] })[];
    export let evaluaciones: {
        sesionCriterioId: number;
        sesionId: number;
        alumnoId: number;
        nota: string;
        observacion?: string | null;
    }[] = [];
    export const consolidadosIniciales: { alumnoId: number; notaFinal: string }[] = [];
    export let curriculo: any = null;
    export const bimestreId: number = 0;
    export const seccionId: number = 0;
    export let seccionNombre = "";
    export let gradoNombre   = "";
    export let bimestreNombre = "";

    const NOTAS: Nota[] = ["AD", "A", "B", "C"];

    const NOTA_COLORES: Record<string, string> = {
        AD: "bg-indigo-100 text-indigo-700 font-semibold",
        A:  "bg-green-100  text-green-700  font-semibold",
        B:  "bg-amber-100  text-amber-700  font-semibold",
        C:  "bg-red-100    text-red-600    font-semibold",
        "": "text-gray-300",
    };

    let exportando = false;
    let error      = "";
    let exito      = "";

    // ── Mapa evaluaciones ─────────────────────────────────────────────────
    $: evalMap = (() => {
        const m: Record<string, string> = {};
        for (const e of evaluaciones) m[`${e.alumnoId}_${e.sesionCriterioId}`] = e.nota;
        return m;
    })();

    $: obsMap = (() => {
        const m: Record<string, string> = {};
        for (const e of evaluaciones)
            if (e.observacion) m[`${e.alumnoId}_${e.sesionCriterioId}`] = e.observacion;
        return m;
    })();



    // ── Helpers curriculo ─────────────────────────────────────────────────
    function nombreCapacidad(id: string): string {
        for (const comp of curriculo?.competencias ?? []) {
            const cap = comp.capacidades?.find((c: any) => String(c.id) === id);
            if (cap) return cap.nombre;
        }
        return id;
    }

    // ── Estructura principal: competencias → sesiones → capacidades → criterios
    // Cada competencia tiene: sus sesiones (con criterios agrupados por capacidad)
    // + 1 columna "Promedio" vacía al final
    type CriterioItem = { criterio: SesionCriterio };
    type CapacidadItem = { capacidadId: string; capacidadNombre: string; criterios: CriterioItem[] };
    type SesionItem    = { sesionId: number; sesionTitulo: string; capacidades: CapacidadItem[]; totalCriterios: number };
    type CompItem      = { id: string; nombre: string; sesiones: SesionItem[]; totalCriterios: number };

    $: estructura = (() => {
        if (!curriculo?.competencias) return [] as CompItem[];

        // Qué competencias tienen criterios en estas sesiones
        const compIds = new Set<string>();
        for (const s of sesiones)
            for (const c of s.criterios)
                compIds.add(String(c.competenciaId));

        const result: CompItem[] = [];

        for (const comp of curriculo.competencias) {
            const compId = String(comp.id);
            if (!compIds.has(compId)) continue;

            const sesionesComp: SesionItem[] = [];

            for (const sesion of sesiones) {
                // criterios de esta sesión que pertenecen a esta competencia
                const critsDeEstaComp = sesion.criterios.filter(
                    (c) => String(c.competenciaId) === compId
                );
                if (!critsDeEstaComp.length) continue;

                // Agrupar por capacidad (conservando orden de aparición)
                const capMap = new Map<string, CriterioItem[]>();
                for (const c of critsDeEstaComp) {
                    const capId = String(c.capacidadId);
                    if (!capMap.has(capId)) capMap.set(capId, []);
                    capMap.get(capId)!.push({ criterio: c });
                }

                const capacidades: CapacidadItem[] = [];
                for (const [capId, crits] of capMap) {
                    capacidades.push({
                        capacidadId:     capId,
                        capacidadNombre: nombreCapacidad(capId),
                        criterios:       crits,
                    });
                }

                sesionesComp.push({
                    sesionId:       sesion.id,
                    sesionTitulo:   sesion.titulo,
                    capacidades,
                    totalCriterios: critsDeEstaComp.length,
                });
            }

            if (!sesionesComp.length) continue;

            const totalCriterios = sesionesComp.reduce((s, x) => s + x.totalCriterios, 0);

            result.push({
                id:     compId,
                nombre: comp.nombre,
                sesiones: sesionesComp,
                totalCriterios,
            });
        }

        return result;
    })();





    // ── Exportar Excel ────────────────────────────────────────────────────
    // 4 filas de encabezado: Competencia / Sesión / Capacidad / Criterio
    // + columna Promedio vacía al final de cada competencia
    async function exportarExcel() {
        exportando = true;
        try {
            const XLSX = await import("https://cdn.sheetjs.com/xlsx-0.20.3/package/xlsx.mjs" as any);

            const h1: string[] = ["N°", "Apellidos y Nombres"]; // competencias
            const h2: string[] = ["",   ""];                    // sesiones
            const h3: string[] = ["",   ""];                    // capacidades
            const h4: string[] = ["",   ""];                    // criterios

            const merges: any[] = [];
            let col = 2;

            for (const comp of estructura) {
                // colspan de competencia = totalCriterios + 1 (promedio)
                const colSpanComp = comp.totalCriterios + 1;
                h1.push(comp.nombre);
                for (let i = 1; i < colSpanComp; i++) h1.push("");
                if (colSpanComp > 1) merges.push({ s: { r: 0, c: col }, e: { r: 0, c: col + colSpanComp - 1 } });

                let colSesion = col;
                for (const ses of comp.sesiones) {
                    h2.push(ses.sesionTitulo);
                    for (let i = 1; i < ses.totalCriterios; i++) h2.push("");
                    if (ses.totalCriterios > 1) merges.push({ s: { r: 1, c: colSesion }, e: { r: 1, c: colSesion + ses.totalCriterios - 1 } });

                    let colCap = colSesion;
                    for (const cap of ses.capacidades) {
                        h3.push(cap.capacidadNombre);
                        for (let i = 1; i < cap.criterios.length; i++) h3.push("");
                        if (cap.criterios.length > 1) merges.push({ s: { r: 2, c: colCap }, e: { r: 2, c: colCap + cap.criterios.length - 1 } });
                        for (const { criterio } of cap.criterios) h4.push(criterio.criterio);
                        colCap += cap.criterios.length;
                    }
                    colSesion += ses.totalCriterios;
                }

                // Columna Promedio (vacía)
                h2.push("Promedio");
                h3.push("");
                h4.push("(docente)");
                // Promedio ocupa 1 col en filas 2-4, rowspan visual en Excel → merge filas 1-3
                merges.push({ s: { r: 1, c: col + comp.totalCriterios }, e: { r: 3, c: col + comp.totalCriterios } });

                col += colSpanComp;
            }



            // Filas de datos
            const dataRows = alumnos.map((alumno, idx) => {
                const row: (string | number)[] = [idx + 1, `${alumno.apellido}, ${alumno.nombre}`];
                for (const comp of estructura) {
                    for (const ses of comp.sesiones)
                        for (const cap of ses.capacidades)
                            for (const { criterio } of cap.criterios)
                                row.push(evalMap[`${alumno.id}_${criterio.id}`] ?? "");
                    row.push(""); // Promedio vacío
                }

                return row;
            });

            const wsData = [h1, h2, h3, h4, ...dataRows];
            const ws = XLSX.utils.aoa_to_sheet(wsData);
            if (merges.length) ws["!merges"] = merges;

            ws["!cols"] = [
                { wch: 4 }, { wch: 30 },
                ...estructura.flatMap((comp: CompItem) => [
                    ...comp.sesiones.flatMap((ses: SesionItem) =>
                        ses.capacidades.flatMap((cap: CapacidadItem) =>
                            cap.criterios.map(() => ({ wch: 14 }))
                        )
                    ),
                    { wch: 14 }, // promedio
                ]),
            ];

            // ── Estilos ──────────────────────────────────────────────────────
            const rangeRef = XLSX.utils.decode_range(ws["!ref"] ?? "A1");

            // Paleta
            const AZUL_OSCURO = "1B3A6B";
            const AZUL_MED    = "2A5298";
            const AZUL_CLARO  = "EEF2F9";
            const INDIGO      = "4338CA";
            const INDIGO_BG   = "EEF2FF";
            const NARANJA_BG  = "FFF7ED";
            const GRIS_BG     = "F9FAFB";
            const BORDE       = { style: "thin", color: { rgb: "CBD5E1" } };
            const BORDE_CELL  = { top: BORDE, bottom: BORDE, left: BORDE, right: BORDE };

            for (let R = rangeRef.s.r; R <= rangeRef.e.r; R++) {
                for (let C = rangeRef.s.c; C <= rangeRef.e.c; C++) {
                    const addr = XLSX.utils.encode_cell({ r: R, c: C });
                    if (!ws[addr]) ws[addr] = { t: "z", v: "" };
                    const isHeader = R < 4;
                    const isData   = R >= 4;
                    const isName   = C <= 1;

                    // Base: borde en todas las celdas
                    ws[addr].s = { border: BORDE_CELL, alignment: { vertical: "center", wrapText: false } };

                    if (isHeader) {
                        ws[addr].s.alignment = { horizontal: "center", vertical: "center", wrapText: true };
                        ws[addr].s.font      = { bold: true, sz: 9 };

                        if (R === 0) {
                            // Fila 1: competencias — azul institucional
                            if (C <= 1) {
                                ws[addr].s.fill = { fgColor: { rgb: AZUL_OSCURO }, patternType: "solid" };
                                ws[addr].s.font = { bold: true, sz: 9, color: { rgb: "FFFFFF" } };
                            } else {
                                ws[addr].s.fill = { fgColor: { rgb: AZUL_MED }, patternType: "solid" };
                                ws[addr].s.font = { bold: true, sz: 9, color: { rgb: "FFFFFF" } };
                            }
                        } else if (R === 1) {
                            // Fila 2: sesiones — azul claro
                            ws[addr].s.fill = { fgColor: { rgb: AZUL_CLARO }, patternType: "solid" };
                            ws[addr].s.font = { bold: true, sz: 8, color: { rgb: AZUL_OSCURO } };
                        } else if (R === 2) {
                            // Fila 3: capacidades — indigo suave
                            ws[addr].s.fill = { fgColor: { rgb: INDIGO_BG }, patternType: "solid" };
                            ws[addr].s.font = { bold: false, sz: 8, color: { rgb: INDIGO } };
                        } else if (R === 3) {
                            // Fila 4: criterios — gris
                            ws[addr].s.fill = { fgColor: { rgb: GRIS_BG }, patternType: "solid" };
                            ws[addr].s.font = { bold: false, sz: 8, color: { rgb: "6B7280" } };
                        }
                    }

                    if (isData) {
                        ws[addr].s.alignment = { horizontal: isName ? "left" : "center", vertical: "center" };
                        ws[addr].s.font      = { sz: 9 };
                        // Filas alternas levemente
                        if (R % 2 === 0) {
                            ws[addr].s.fill = { fgColor: { rgb: "F8FAFC" }, patternType: "solid" };
                        }
                        // Columna de nombres: negrita
                        if (C === 1) ws[addr].s.font = { sz: 9, bold: true };
                        // N°: gris centrado
                        if (C === 0) ws[addr].s.font = { sz: 8, color: { rgb: "9CA3AF" } };
                    }
                }
            }

            // Altura de filas
            ws["!rows"] = [
                { hpt: 28 }, // fila 1 competencias
                { hpt: 22 }, // fila 2 sesiones
                { hpt: 36 }, // fila 3 capacidades
                { hpt: 44 }, // fila 4 criterios
                ...alumnos.map(() => ({ hpt: 20 })),
            ];

            // Congelar las 4 filas de encabezado + columna de nombres
            ws["!freeze"] = { xSplit: 2, ySplit: 4 };

            const wb = XLSX.utils.book_new();
            XLSX.utils.book_append_sheet(wb, ws, `${gradoNombre} ${seccionNombre}`.slice(0, 31));

            // ── Hoja 2: Observaciones ──────────────────────────────────────
            const obsRows: (string | number)[][] = [
                ["N°", "Alumno", "Competencia", "Sesión", "Criterio", "Nota", "Observación"]
            ];
            let obsIdx = 1;
            for (const alumno of alumnos) {
                for (const comp of estructura) {
                    for (const ses of comp.sesiones) {
                        for (const cap of ses.capacidades) {
                            for (const { criterio } of cap.criterios) {
                                const k   = `${alumno.id}_${criterio.id}`;
                                const obs = obsMap[k];
                                if (!obs) continue;
                                obsRows.push([
                                    obsIdx++,
                                    `${alumno.apellido}, ${alumno.nombre}`,
                                    comp.nombre,
                                    ses.sesionTitulo,
                                    criterio.criterio,
                                    evalMap[k] ?? "—",
                                    obs,
                                ]);
                            }
                        }
                    }
                }
            }

            if (obsRows.length > 1) {
                const wsObs = XLSX.utils.aoa_to_sheet(obsRows);
                wsObs["!cols"] = [
                    { wch: 4 }, { wch: 28 }, { wch: 30 },
                    { wch: 22 }, { wch: 30 }, { wch: 8 }, { wch: 40 },
                ];
                XLSX.utils.book_append_sheet(wb, wsObs, "Observaciones");
            }

            XLSX.writeFile(wb, `Consolidado_${bimestreNombre}_${gradoNombre}_Sec${seccionNombre}.xlsx`);
        } catch (e) {
            error = "No se pudo generar el archivo Excel.";
            console.error(e);
        } finally {
            exportando = false;
        }
    }
</script>

<!-- BARRA DE ACCIONES -->
<div class="flex items-center justify-between gap-3 mb-5 flex-wrap">
    <p class="text-sm text-gray-500">
        {alumnos.length} alumno{alumnos.length !== 1 ? "s" : ""} ·
        {sesiones.length} sesión{sesiones.length !== 1 ? "es" : ""} ·
        {estructura.length} competencia{estructura.length !== 1 ? "s" : ""}
    </p>

    <div class="flex items-center gap-2 flex-wrap">
        <button
            on:click={exportarExcel}
            disabled={exportando || estructura.length === 0}
            class="flex items-center gap-1.5 text-sm text-green-700 border border-green-300
                   bg-green-50 hover:bg-green-100 rounded-lg px-3 py-2 transition-colors
                   cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
        >
            <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
                <path d="M8 2v8M4 7l4 4 4-4M2 13h12" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
            </svg>
            {exportando ? "Generando..." : "Exportar Excel"}
        </button>


    </div>
</div>

{#if error}
    <p class="mb-4 text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{error}</p>
{/if}
{#if exito}
    <p class="mb-4 text-sm text-green-700 bg-green-50 border border-green-200 rounded-lg px-3 py-2">{exito}</p>
{/if}

<div class="flex items-center gap-4 mb-4 flex-wrap">
    <span class="text-xs text-gray-400">Referencias:</span>
    {#each NOTAS as nota}
        <span class="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full {NOTA_COLORES[nota]}">{nota}</span>
    {/each}
    <span class="text-xs text-gray-400 ml-2">
        · Columna <strong class="text-gray-600">Promedio</strong>: la completas tú en Excel.
    </span>
</div>

<!-- CASOS VACÍOS -->
{#if sesiones.length === 0}
    <div class="text-center py-16 text-gray-400">
        <p class="text-sm">No hay sesiones registradas en este bimestre.</p>
    </div>
{:else if alumnos.length === 0}
    <div class="text-center py-16 text-gray-400">
        <p class="text-sm">No hay alumnos activos en esta sección.</p>
    </div>

<!-- TABLA -->
{:else}
    <div class="overflow-x-auto rounded-xl border border-gray-200">
        <table class="w-full border-collapse text-sm">
            <thead>

                <!-- ── Fila 1: Competencias ── -->
                <tr class="border-b border-gray-200">
                    <th
                        rowspan="4"
                        class="col-nombre text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase
                               tracking-wider sticky left-0 bg-gray-50 z-10 border-r border-gray-200 align-bottom"
                    >
                        Alumno
                    </th>

                    {#each estructura as comp, ci}
                        <!-- colspan = total criterios de la competencia + 1 (promedio) -->
                        <th
                            colspan={comp.totalCriterios + 1}
                            class="px-3 py-2 text-center text-xs font-semibold text-indigo-700 bg-indigo-50
                                   {ci < estructura.length - 1 ? 'border-r border-indigo-300' : ''}"
                        >
                            <span class="line-clamp-2 leading-tight">{comp.nombre}</span>
                        </th>
                    {/each}


                </tr>

                <!-- ── Fila 2: Sesiones + Promedio (rowspan=3) ── -->
                <tr class="border-b border-gray-200">
                    {#each estructura as comp, ci}
                        {#each comp.sesiones as ses, si}
                            <th
                                colspan={ses.totalCriterios}
                                class="px-2 py-1.5 text-center text-[10px] font-medium text-blue-700 bg-blue-50
                                       {si < comp.sesiones.length - 1 ? 'border-r border-blue-200' : ''}"
                            >
                                <span class="line-clamp-1 leading-tight">{ses.sesionTitulo}</span>
                            </th>
                        {/each}
                        <!-- Columna Promedio: rowspan=3 para abarcar filas 2-4 -->
                        <th
                            rowspan="3"
                            class="px-2 py-2 text-center text-[10px] font-semibold text-orange-600 bg-orange-50 align-middle
                                   {ci < estructura.length - 1 ? 'border-r border-orange-300' : ''}"
                            style="min-width:60px;"
                        >
                            Promedio
                        </th>
                    {/each}
                </tr>

                <!-- ── Fila 3: Capacidades ── -->
                <tr class="border-b border-gray-200">
                    {#each estructura as comp, ci}
                        {#each comp.sesiones as ses, si}
                            {#each ses.capacidades as cap, capi}
                                <th
                                    colspan={cap.criterios.length}
                                    class="px-2 py-1.5 text-center text-[10px] font-medium text-indigo-600 bg-indigo-50/60
                                           {capi < ses.capacidades.length - 1 ? 'border-r border-indigo-100' : si < comp.sesiones.length - 1 ? 'border-r border-blue-200' : ''}"
                                >
                                    <span class="line-clamp-2 leading-tight max-w-24 block mx-auto">{cap.capacidadNombre}</span>
                                </th>
                            {/each}
                        {/each}
                    {/each}
                </tr>

                <!-- ── Fila 4: Criterios ── -->
                <tr class="bg-gray-50 border-b border-gray-200">
                    {#each estructura as comp, ci}
                        {#each comp.sesiones as ses, si}
                            {#each ses.capacidades as cap, capi}
                                {#each cap.criterios as { criterio }, criti}
                                    <th
                                        class="px-2 py-2 text-center min-w-28
                                               {criti < cap.criterios.length - 1
                                                    ? 'border-r border-gray-200'
                                                    : capi < ses.capacidades.length - 1
                                                        ? 'border-r border-indigo-100'
                                                        : si < comp.sesiones.length - 1
                                                            ? 'border-r border-blue-200'
                                                            : ''}"
                                    >
                                        <span
                                            class="block text-[10px] text-gray-500 font-normal leading-tight max-w-28 line-clamp-3"
                                            title={criterio.criterio}
                                        >
                                            {criterio.criterio}
                                        </span>
                                    </th>
                                {/each}
                            {/each}
                        {/each}
                    {/each}
                </tr>

            </thead>

            <!-- CUERPO -->
            <tbody class="divide-y divide-gray-100">
                {#each alumnos as alumno, idx}
                    <tr class="hover:bg-gray-50/50 transition-colors group">

                        <!-- Nombre sticky -->
                        <td class="col-nombre px-2 py-2.5 sticky left-0 z-10 bg-white border-r border-gray-200
                                   group-hover:bg-gray-50/80 transition-colors">
                            <span class="text-xs text-gray-400 mr-0.5">{idx + 1}</span>
                            <span class="nombre-alumno text-sm text-gray-900 font-medium">
                                {alumno.apellido}, {alumno.nombre}
                            </span>
                        </td>

                        <!-- Notas agrupadas por competencia → sesión → capacidad → criterio -->
                        {#each estructura as comp, ci}
                            {#each comp.sesiones as ses, si}
                                {#each ses.capacidades as cap, capi}
                                    {#each cap.criterios as { criterio }, criti}
                                        {@const nota = evalMap[`${alumno.id}_${criterio.id}`] ?? ""}
                                        <td class="px-2 py-2 text-center
                                                   {criti < cap.criterios.length - 1
                                                        ? 'border-r border-gray-100'
                                                        : capi < ses.capacidades.length - 1
                                                            ? 'border-r border-indigo-50'
                                                            : si < comp.sesiones.length - 1
                                                                ? 'border-r border-blue-100'
                                                                : ''}">
                                            {#if nota}
                                                <span class="inline-block px-2 py-0.5 rounded text-xs {NOTA_COLORES[nota]}">{nota}</span>
                                            {:else}
                                                <span class="text-gray-200 text-xs">—</span>
                                            {/if}
                                            {#if obsMap[`${alumno.id}_${criterio.id}`]}
                                                <p class="obs-cell">{obsMap[`${alumno.id}_${criterio.id}`]}</p>
                                            {/if}
                                        </td>
                                    {/each}
                                {/each}
                            {/each}

                            <!-- Celda Promedio vacía (el docente la llena en Excel) -->
                            <td class="px-2 py-2 text-center bg-orange-50/40
                                       {ci < estructura.length - 1 ? 'border-r border-orange-200' : ''}">
                                <span class="text-[10px] text-orange-300 italic">—</span>
                            </td>
                        {/each}


                    </tr>
                {/each}
            </tbody>
        </table>
    </div>


{/if}

<style>
  .col-nombre {
    width: 150px;
    min-width: 150px;
    max-width: 150px;
  }
  .nombre-alumno { display: inline; }

  @media (max-width: 640px) {
    .col-nombre { width: 82px; min-width: 82px; max-width: 82px; }
    .nombre-alumno {
      font-size: .60rem;
      line-height: 1.25;
      word-break: break-word;
      white-space: normal;
      display: block;
    }
  }

  /* ── Observación en celda ── */
  .obs-cell {
    font-size: .62rem;
    color: #C8882A;
    line-height: 1.3;
    margin-top: 3px;
    text-align: left;
    white-space: pre-wrap;
    word-break: break-word;
    max-height: 36px;
    overflow: hidden;
    font-style: italic;
    padding: 0 2px;
  }

  :global(.bg-blue-600)                   { background-color: #1B3A6B !important; }
  :global(.bg-blue-500)                   { background-color: #2A5298 !important; }
  :global(.bg-blue-50)                    { background-color: #EEF2F9 !important; }
  :global(.bg-blue-100)                   { background-color: #D6E3F5 !important; }
  :global(.hover\:bg-blue-700:hover)      { background-color: #2A5298 !important; }
  :global(.hover\:bg-blue-50:hover)       { background-color: #EEF2F9 !important; }
  :global(.hover\:bg-blue-100:hover)      { background-color: #D6E3F5 !important; }
  :global(.disabled\:bg-blue-300)         { background-color: rgba(27,58,107,.32) !important; }
  :global(.text-blue-600)                 { color: #1B3A6B !important; }
  :global(.text-blue-700)                 { color: #1B3A6B !important; }
  :global(.text-blue-800)                 { color: #0F2A52 !important; }
  :global(.text-blue-500)                 { color: #2A5298 !important; }
  :global(.hover\:text-blue-600:hover)    { color: #1B3A6B !important; }
  :global(.hover\:text-blue-700:hover)    { color: #0F2A52 !important; }
  :global(.border-blue-500)              { border-color: #1B3A6B !important; }
  :global(.border-blue-300)              { border-color: rgba(27,58,107,.35) !important; }
  :global(.border-blue-200)              { border-color: rgba(27,58,107,.2) !important; }
  :global(.border-blue-100)              { border-color: rgba(27,58,107,.12) !important; }
  :global(.focus\:ring-blue-500)         { --tw-ring-color: rgba(27,58,107,.4) !important; }
  :global(.bg-blue-500.rounded-full)     { background-color: #1B3A6B !important; }
</style>