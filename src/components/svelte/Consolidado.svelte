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
    export let curriculo: any = null;
    export let seccionNombre = "";
    export let gradoNombre = "";
    export let bimestreNombre = "";
    export let examenNotas: {
        alumnoId: number;
        competenciaId: string;
        nota: string | null;
    }[] = [];

    const NOTAS: Nota[] = ["AD", "A", "B", "C"];

    const NOTA_COLORES: Record<string, string> = {
        AD: "bg-indigo-100 text-indigo-700 font-semibold",
        A: "bg-green-100  text-green-700  font-semibold",
        B: "bg-amber-100  text-amber-700  font-semibold",
        C: "bg-red-100    text-red-600    font-semibold",
        "": "text-gray-300",
    };

    let exportando = false;
    let error = "";
    let exito = "";

    $: evalMap = (() => {
        const m: Record<string, string> = {};
        for (const e of evaluaciones)
            m[`${e.alumnoId}_${e.sesionCriterioId}`] = e.nota;
        return m;
    })();

    $: obsMap = (() => {
        const m: Record<string, string> = {};
        for (const e of evaluaciones)
            if (e.observacion)
                m[`${e.alumnoId}_${e.sesionCriterioId}`] = e.observacion;
        return m;
    })();

    $: diagMap = (() => {
        const m: Record<string, string> = {};
        for (const n of examenNotas)
            if (n.nota) m[`${n.alumnoId}_${n.competenciaId}`] = n.nota;
        return m;
    })();

    $: hayDiagnostico = examenNotas.length > 0;

    function compTieneDiag(compId: string): boolean {
        return examenNotas.some(
            (n) => String(n.competenciaId) === String(compId) && n.nota,
        );
    }

    function nombreCapacidad(id: string): string {
        for (const comp of curriculo?.competencias ?? []) {
            const cap = comp.capacidades?.find((c: any) => String(c.id) === id);
            if (cap) return cap.nombre;
        }
        return id;
    }

    type CriterioItem = { criterio: SesionCriterio };
    type CapacidadItem = {
        capacidadId: string;
        capacidadNombre: string;
        criterios: CriterioItem[];
    };
    type SesionItem = {
        sesionId: number;
        sesionTitulo: string;
        capacidades: CapacidadItem[];
        totalCriterios: number;
    };
    type CompItem = {
        id: string;
        nombre: string;
        sesiones: SesionItem[];
        totalCriterios: number;
        soloDiag: boolean;
    };

    $: estructura = (() => {
        if (!curriculo?.competencias) return [] as CompItem[];

        const compIds = new Set<string>();
        for (const s of sesiones)
            for (const c of s.criterios) compIds.add(String(c.competenciaId));

        // Competencias que tienen diagnóstico registrado
        const diagCompIds = new Set<string>();
        for (const n of examenNotas)
            if (n.nota) diagCompIds.add(String(n.competenciaId));

        const result: CompItem[] = [];

        for (const comp of curriculo.competencias) {
            const compId = String(comp.id);
            const tieneSesiones = compIds.has(compId);
            const tieneDiag = diagCompIds.has(compId);

            // Incluir siempre todas las competencias del currículo
            // (para que las columnas de eval. diagnóstica aparezcan aunque no haya sesiones ni notas aún)

            const sesionesComp: SesionItem[] = [];

            if (tieneSesiones) {
                for (const sesion of sesiones) {
                    const critsDeEstaComp = sesion.criterios.filter(
                        (c) => String(c.competenciaId) === compId,
                    );
                    if (!critsDeEstaComp.length) continue;

                    const capMap = new Map<string, CriterioItem[]>();
                    for (const c of critsDeEstaComp) {
                        const capId = String(c.capacidadId);
                        if (!capMap.has(capId)) capMap.set(capId, []);
                        capMap.get(capId)!.push({ criterio: c });
                    }

                    const capacidades: CapacidadItem[] = [];
                    for (const [capId, crits] of capMap) {
                        capacidades.push({
                            capacidadId: capId,
                            capacidadNombre: nombreCapacidad(capId),
                            criterios: crits,
                        });
                    }

                    sesionesComp.push({
                        sesionId: sesion.id,
                        sesionTitulo: sesion.titulo,
                        capacidades,
                        totalCriterios: critsDeEstaComp.length,
                    });
                }
            }

            const totalCriterios = sesionesComp.reduce(
                (s, x) => s + x.totalCriterios,
                0,
            );

            result.push({
                id: compId,
                nombre: comp.nombre,
                sesiones: sesionesComp,
                totalCriterios,
                soloDiag: !tieneSesiones,
            });
        }

        return result;
    })();

    async function exportarExcel() {
        exportando = true;
        try {
            const XLSX = await import(
                "https://cdn.sheetjs.com/xlsx-0.20.3/package/xlsx.mjs" as any
            );

            const h1: string[] = ["N°", "Apellidos y Nombres"];
            const h2: string[] = ["", ""];
            const h3: string[] = ["", ""];
            const h4: string[] = ["", ""];

            const merges: any[] = [];
            const diagColSet = new Set<number>();
            let col = 2;

            for (const comp of estructura) {
                // siempre: Diag(1) + criterios + Promedio(1)
                const colSpanComp = comp.soloDiag ? 2 : comp.totalCriterios + 2;

                h1.push(comp.nombre);
                for (let i = 1; i < colSpanComp; i++) h1.push("");
                if (colSpanComp > 1)
                    merges.push({
                        s: { r: 0, c: col },
                        e: { r: 0, c: col + colSpanComp - 1 },
                    });

                // Eval. Diagnóstica: siempre primer hijo (rowspan 3)
                h2.push("Eval. Diagnóstica");
                h3.push("");
                h4.push("");
                merges.push({ s: { r: 1, c: col }, e: { r: 3, c: col } });
                diagColSet.add(col);
                col++;

                if (comp.soloDiag) {
                    // Promedio
                    h2.push("Promedio");
                    h3.push("");
                    h4.push("(docente)");
                    merges.push({ s: { r: 1, c: col }, e: { r: 3, c: col } });
                    col++;
                    continue;
                }

                let colSesion = col;
                for (const ses of comp.sesiones) {
                    h2.push(ses.sesionTitulo);
                    for (let i = 1; i < ses.totalCriterios; i++) h2.push("");
                    if (ses.totalCriterios > 1)
                        merges.push({
                            s: { r: 1, c: colSesion },
                            e: { r: 1, c: colSesion + ses.totalCriterios - 1 },
                        });

                    let colCap = colSesion;
                    for (const cap of ses.capacidades) {
                        h3.push(cap.capacidadNombre);
                        for (let i = 1; i < cap.criterios.length; i++)
                            h3.push("");
                        if (cap.criterios.length > 1)
                            merges.push({
                                s: { r: 2, c: colCap },
                                e: { r: 2, c: colCap + cap.criterios.length - 1 },
                            });
                        for (const { criterio } of cap.criterios)
                            h4.push(criterio.criterio);
                        colCap += cap.criterios.length;
                    }
                    colSesion += ses.totalCriterios;
                }

                h2.push("Promedio");
                h3.push("");
                h4.push("(docente)");
                merges.push({
                    s: { r: 1, c: col + comp.totalCriterios },
                    e: { r: 3, c: col + comp.totalCriterios },
                });
                col += comp.totalCriterios + 1;
            }

            const dataRows = alumnos.map((alumno, idx) => {
                const row: (string | number)[] = [
                    idx + 1,
                    `${alumno.apellido}, ${alumno.nombre}`,
                ];

                for (const comp of estructura) {
                    // Diag: siempre primer valor
                    row.push(diagMap[`${alumno.id}_${comp.id}`] ?? "");

                    if (!comp.soloDiag) {
                        for (const ses of comp.sesiones)
                            for (const cap of ses.capacidades)
                                for (const { criterio } of cap.criterios)
                                    row.push(evalMap[`${alumno.id}_${criterio.id}`] ?? "");
                    }

                    // Promedio (siempre vacío, lo rellena el docente)
                    row.push("");
                }

                return row;
            });

            const wsData = [h1, h2, h3, h4, ...dataRows];
            const ws = XLSX.utils.aoa_to_sheet(wsData);
            if (merges.length) ws["!merges"] = merges;

            ws["!cols"] = [
                { wch: 4 },
                { wch: 30 },
                ...estructura.flatMap((comp: CompItem) => [
                    { wch: 14 }, // Diag
                    ...comp.sesiones.flatMap((ses: SesionItem) =>
                        ses.capacidades.flatMap((cap: CapacidadItem) =>
                            cap.criterios.map(() => ({ wch: 14 })),
                        ),
                    ),
                    { wch: 14 }, // Promedio
                ]),
            ];

            const rangeRef = XLSX.utils.decode_range(ws["!ref"] ?? "A1");
            const AZUL_OSCURO = "1B3A6B";
            const AZUL_MED    = "2A5298";
            const AZUL_CLARO  = "EEF2F9";
            const INDIGO      = "4338CA";
            const INDIGO_BG   = "EEF2FF";
            const AMBER_BG    = "FEF3E2";
            const AMBER_TEXT  = "92400E";
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
                    const isDiag   = diagColSet.has(C);

                    ws[addr].s = { border: BORDE_CELL, alignment: { vertical: "center", wrapText: false } };

                    if (isHeader) {
                        ws[addr].s.alignment = { horizontal: "center", vertical: "center", wrapText: true };
                        ws[addr].s.font = { bold: true, sz: 9 };

                        if (isDiag) {
                            ws[addr].s.fill = { fgColor: { rgb: AMBER_BG }, patternType: "solid" };
                            ws[addr].s.font = { bold: true, sz: 9, color: { rgb: AMBER_TEXT } };
                        } else if (R === 0) {
                            if (C <= 1) {
                                ws[addr].s.fill = { fgColor: { rgb: AZUL_OSCURO }, patternType: "solid" };
                                ws[addr].s.font = { bold: true, sz: 9, color: { rgb: "FFFFFF" } };
                            } else {
                                ws[addr].s.fill = { fgColor: { rgb: AZUL_MED }, patternType: "solid" };
                                ws[addr].s.font = { bold: true, sz: 9, color: { rgb: "FFFFFF" } };
                            }
                        } else if (R === 1) {
                            ws[addr].s.fill = { fgColor: { rgb: AZUL_CLARO }, patternType: "solid" };
                            ws[addr].s.font = { bold: true, sz: 8, color: { rgb: AZUL_OSCURO } };
                        } else if (R === 2) {
                            ws[addr].s.fill = { fgColor: { rgb: INDIGO_BG }, patternType: "solid" };
                            ws[addr].s.font = { bold: false, sz: 8, color: { rgb: INDIGO } };
                        } else if (R === 3) {
                            ws[addr].s.fill = { fgColor: { rgb: GRIS_BG }, patternType: "solid" };
                            ws[addr].s.font = { bold: false, sz: 8, color: { rgb: "6B7280" } };
                        }
                    }

                    if (isData) {
                        ws[addr].s.alignment = { horizontal: isName ? "left" : "center", vertical: "center" };
                        ws[addr].s.font = { sz: 9 };
                        if (R % 2 === 0)
                            ws[addr].s.fill = { fgColor: { rgb: "F8FAFC" }, patternType: "solid" };
                        if (isDiag && ws[addr].v) {
                            ws[addr].s.fill = { fgColor: { rgb: AMBER_BG }, patternType: "solid" };
                            ws[addr].s.font = { sz: 9, bold: true, color: { rgb: AMBER_TEXT } };
                        }
                        if (C === 1) ws[addr].s.font = { sz: 9, bold: true };
                        if (C === 0) ws[addr].s.font = { sz: 8, color: { rgb: "9CA3AF" } };
                    }
                }
            }

            ws["!rows"] = [
                { hpt: 28 }, { hpt: 22 }, { hpt: 36 }, { hpt: 44 },
                ...alumnos.map(() => ({ hpt: 20 })),
            ];
            ws["!freeze"] = { xSplit: 2, ySplit: 4 };

            const wb = XLSX.utils.book_new();
            XLSX.utils.book_append_sheet(wb, ws, `${gradoNombre} ${seccionNombre}`.slice(0, 31));

            const obsRows: (string | number)[][] = [
                ["N°", "Alumno", "Competencia", "Sesión", "Criterio", "Nota", "Observación"],
            ];
            let obsIdx = 1;
            for (const alumno of alumnos) {
                for (const comp of estructura) {
                    for (const ses of comp.sesiones) {
                        for (const cap of ses.capacidades) {
                            for (const { criterio } of cap.criterios) {
                                const k = `${alumno.id}_${criterio.id}`;
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
    {#if hayDiagnostico}
        <span class="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded px-2 py-0.5 ml-1">
            · Columnas amber = evaluación diagnóstica
        </span>
    {/if}
</div>

<!-- CASOS VACÍOS -->
{#if estructura.length === 0}
    <div class="text-center py-16 text-gray-400">
        <p class="text-sm">No hay competencias configuradas en el currículo.</p>
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
                        <!-- Diag(1) siempre + criterios + Promedio(1) si tiene sesiones -->
                        {@const colSpan = comp.soloDiag ? 2 : comp.totalCriterios + 2}
                        <th
                            colspan={colSpan}
                            class="px-3 py-2 text-center text-xs font-semibold text-indigo-700 bg-indigo-50
                                   {ci < estructura.length - 1 ? 'border-r border-indigo-300' : ''}"
                        >
                            <span class="line-clamp-2 leading-tight">{comp.nombre}</span>
                        </th>
                    {/each}
                </tr>

                <!-- ── Fila 2: Diagnóstico (rowspan=3) siempre + Sesiones + Promedio ── -->
                <tr class="border-b border-gray-200">
                    {#each estructura as comp, ci}
                        <!-- Eval. Diagnóstica: primer hijo siempre -->
                        <th
                            rowspan="3"
                            class="px-2 py-2 text-center text-[10px] font-semibold text-amber-700 bg-amber-50 align-middle border-r border-amber-300"
                            style="min-width:56px;"
                        >
                            <span class="block leading-tight">Eval.</span>
                            <span class="block leading-tight">Diagnóstica</span>
                        </th>

                        {#if !comp.soloDiag}
                            {#each comp.sesiones as ses, si}
                                <th
                                    colspan={ses.totalCriterios}
                                    class="px-2 py-1.5 text-center text-[10px] font-medium text-blue-700 bg-blue-50
                                           {si < comp.sesiones.length - 1 ? 'border-r border-blue-200' : ''}"
                                >
                                    <span class="line-clamp-1 leading-tight">{ses.sesionTitulo}</span>
                                </th>
                            {/each}

                            <!-- Promedio: rowspan=3 -->
                            <th
                                rowspan="3"
                                class="px-2 py-2 text-center text-[10px] font-semibold text-orange-600 bg-orange-50 align-middle
                                       {ci < estructura.length - 1 ? 'border-r border-orange-300' : ''}"
                                style="min-width:60px;"
                            >
                                Promedio
                            </th>
                        {:else}
                            <!-- Sin sesiones: Promedio ocupa rowspan=3 también -->
                            <th
                                rowspan="3"
                                class="px-2 py-2 text-center text-[10px] font-semibold text-orange-600 bg-orange-50 align-middle
                                       {ci < estructura.length - 1 ? 'border-r border-orange-300' : ''}"
                                style="min-width:60px;"
                            >
                                Promedio
                            </th>
                        {/if}
                    {/each}
                </tr>

                <!-- ── Fila 3: Capacidades (solo competencias con sesiones) ── -->
                <tr class="border-b border-gray-200">
                    {#each estructura as comp}
                        {#if !comp.soloDiag}
                            {#each comp.sesiones as ses, si}
                                {#each ses.capacidades as cap, capi}
                                    <th
                                        colspan={cap.criterios.length}
                                        class="px-2 py-1.5 text-center text-[10px] font-medium text-indigo-600 bg-indigo-50/60
                                               {capi < ses.capacidades.length - 1
                                                   ? 'border-r border-indigo-100'
                                                   : si < comp.sesiones.length - 1
                                                     ? 'border-r border-blue-200'
                                                     : ''}"
                                    >
                                        <span class="line-clamp-2 leading-tight max-w-24 block mx-auto">{cap.capacidadNombre}</span>
                                    </th>
                                {/each}
                            {/each}
                        {/if}
                    {/each}
                </tr>

                <!-- ── Fila 4: Criterios (solo competencias con sesiones) ── -->
                <tr class="bg-gray-50 border-b border-gray-200">
                    {#each estructura as comp}
                        {#if !comp.soloDiag}
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
                        {/if}
                    {/each}
                </tr>

            </thead>

            <!-- CUERPO -->
            <tbody class="divide-y divide-gray-100">
                {#each alumnos as alumno, idx}
                    <tr class="hover:bg-gray-50/50 transition-colors group">

                        <td class="col-nombre px-2 py-2.5 sticky left-0 z-10 bg-white border-r border-gray-200
                                   group-hover:bg-gray-50/80 transition-colors">
                            <span class="text-xs text-gray-400 mr-0.5">{idx + 1}</span>
                            <span class="nombre-alumno text-sm text-gray-900 font-medium">
                                {alumno.apellido}, {alumno.nombre}
                            </span>
                        </td>

                        {#each estructura as comp, ci}
                            <!-- Diagnóstico: siempre primer hijo -->
                            {@const notaDiag = diagMap[`${alumno.id}_${comp.id}`] ?? ""}
                            <td class="px-2 py-2 text-center bg-amber-50/40 border-r border-amber-200">
                                {#if notaDiag}
                                    <span class="inline-block px-2 py-0.5 rounded text-xs {NOTA_COLORES[notaDiag]}">{notaDiag}</span>
                                {:else}
                                    <span class="text-amber-200 text-xs">—</span>
                                {/if}
                            </td>

                            {#if !comp.soloDiag}
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
                            {/if}

                            <!-- Promedio vacío -->
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

    {#if alumnos.length > 10}
        <div class="flex justify-end mt-4">
            <button
                on:click={exportarExcel}
                disabled={exportando || estructura.length === 0}
                class="text-sm text-green-700 border border-green-300 bg-green-50 hover:bg-green-100
                       rounded-lg px-5 py-2.5 transition-colors cursor-pointer
                       disabled:opacity-50 disabled:cursor-not-allowed"
            >
                {exportando ? "Generando..." : "Exportar Excel"}
            </button>
        </div>
    {/if}
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