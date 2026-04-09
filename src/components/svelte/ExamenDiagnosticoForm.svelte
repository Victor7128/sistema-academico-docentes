<script lang="ts">
    import type { Alumno, ExamenNota, Nota } from "../../lib/types";

    export let alumnos: Alumno[];
    export let notasIniciales: ExamenNota[] = [];
    export let curriculo: any = null;
    export let examenBimestreId: number;
    export let bimestreId: number;

    const NOTAS: Nota[] = ["AD", "A", "B", "C"];

    type Celda  = Nota | null;
    type NotaMap = Record<string, Celda>;
    type ObsMap  = Record<string, string>;

    let guardando = false;
    let error     = "";
    let exito     = "";

    function buildNotaMap(notas: ExamenNota[]): NotaMap {
        const m: NotaMap = {};
        for (const n of notas) m[`${n.alumnoId}_${n.competenciaId}`] = n.nota;
        return m;
    }
    function buildObsMap(notas: ExamenNota[]): ObsMap {
        const m: ObsMap = {};
        for (const n of notas) if (n.observacion) m[`${n.alumnoId}_${n.competenciaId}`] = n.observacion;
        return m;
    }

    let notas:         NotaMap = buildNotaMap(notasIniciales);
    let notasGuardado: NotaMap = buildNotaMap(notasIniciales);
    let obs:           ObsMap  = buildObsMap(notasIniciales);
    let obsGuardado:   ObsMap  = buildObsMap(notasIniciales);

    let obsActiva: string | null = null;

    $: competencias   = curriculo?.competencias ?? [];
    $: hayAlumnos     = alumnos.length > 0;
    $: hayCompetencias = competencias.length > 0;

    $: celdasConNota = Object.values(notas).filter(Boolean).length;
    $: totalCeldas   = alumnos.length * competencias.length;
    $: porcentaje    = totalCeldas > 0 ? Math.round((celdasConNota / totalCeldas) * 100) : 0;
    $: hayCambios    = JSON.stringify(notas) !== JSON.stringify(notasGuardado)
                    || JSON.stringify(obs)   !== JSON.stringify(obsGuardado);

    function setNota(alumnoId: number, competenciaId: string, nota: Nota) {
        const key  = `${alumnoId}_${competenciaId}`;
        notas[key] = notas[key] === nota ? null : nota;
        notas      = { ...notas };
        error = ""; exito = "";
    }

    function setObs(key: string, valor: string) {
        if (valor.trim()) obs[key] = valor;
        else delete obs[key];
        obs   = { ...obs };
        error = ""; exito = "";
    }

    function toggleObs(key: string) {
        obsActiva = obsActiva === key ? null : key;
    }

    async function guardar() {
        guardando = true;
        error = ""; exito = "";

        const payload: { alumnoId: number; competenciaId: string; nota: Nota | null; observacion?: string }[] = [];

        for (const alumno of alumnos) {
            for (const comp of competencias) {
                const key  = `${alumno.id}_${comp.id}`;
                const nota = notas[key] ?? null;
                payload.push({
                    alumnoId:      alumno.id,
                    competenciaId: String(comp.id),
                    nota,
                    ...(obs[key] ? { observacion: obs[key] } : {}),
                });
            }
        }

        try {
            const res  = await fetch(`/api/examen-diagnostico/${examenBimestreId}`, {
                method:  "POST",
                headers: { "Content-Type": "application/json" },
                body:    JSON.stringify({ notas: payload }),
            });
            const json = await res.json();
            if (!res.ok) { error = json.error ?? "Error al guardar."; return; }
            notasGuardado = { ...notas };
            obsGuardado   = { ...obs };
            const guardados = json.data.guardados;
            exito = `${guardados} nota${guardados !== 1 ? "s" : ""} guardada${guardados !== 1 ? "s" : ""}.`;
        } catch {
            error = "No se pudo conectar con el servidor.";
        } finally {
            guardando = false;
        }
    }

    function notaColor(nota: Nota, sel: boolean): string {
        if (!sel) return "bg-gray-100 text-gray-400 hover:bg-gray-200 hover:text-gray-600";
        return { AD: "bg-indigo-600 text-white", A: "bg-green-600 text-white", B: "bg-amber-500 text-white", C: "bg-red-600 text-white" }[nota];
    }
    function notaDot(nota: Nota): string {
        return { AD: "bg-indigo-500", A: "bg-green-500", B: "bg-amber-400", C: "bg-red-500" }[nota];
    }
</script>

<!-- Barra superior -->
<div class="flex items-center justify-between gap-4 mb-4 flex-wrap">
    <div class="flex items-center gap-3">
        <div>
            <p class="text-sm font-medium text-gray-800">
                {celdasConNota} / {totalCeldas}
                <span class="text-gray-400 font-normal">notas registradas</span>
            </p>
            <div class="mt-1 h-1.5 w-48 bg-gray-100 rounded-full overflow-hidden">
                <div class="h-full bg-amber-500 rounded-full transition-all duration-300" style="width: {porcentaje}%"></div>
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
            class="text-sm text-white bg-amber-600 hover:bg-amber-700
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

<!-- Leyenda de notas -->
<div class="flex items-center gap-3 mb-1 flex-wrap">
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
<p class="text-xs text-gray-400 mb-4">
    Una nota por competencia por alumno. Si el alumno estuvo ausente, deja la celda vacía — podrás completarla después.
</p>

{#if !hayAlumnos}
    <div class="text-center py-16 text-gray-400">
        <p class="text-sm">No hay alumnos activos en esta sección.</p>
    </div>
{:else if !hayCompetencias}
    <div class="text-center py-16 text-gray-400">
        <p class="text-sm">No se encontró el currículo del área.</p>
    </div>
{:else}
    <div class="overflow-x-auto rounded-xl border border-gray-200">
        <table class="w-full border-collapse text-sm">
            <thead>
                <!-- Fila única: una columna por competencia -->
                <tr class="bg-gray-50 border-b border-gray-200">
                    <th
                        class="col-nombre text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase
                               tracking-wider sticky left-0 bg-gray-50 z-10 border-r border-gray-200"
                    >
                        Alumno
                    </th>
                    {#each competencias as comp, i}
                        <th
                            class="px-3 py-3 text-center min-w-44
                                   {i < competencias.length - 1 ? 'border-r border-amber-200' : ''}
                                   bg-amber-50"
                        >
                            <span class="text-xs font-semibold text-amber-800 leading-tight line-clamp-2 block">
                                {comp.nombre}
                            </span>
                        </th>
                    {/each}
                </tr>
            </thead>

            <tbody class="divide-y divide-gray-100">
                {#each alumnos as alumno}
                    {@const tieneAlgunaNota = competencias.some((c: any) => notas[`${alumno.id}_${c.id}`] != null)}

                    <tr class="transition-colors group {tieneAlgunaNota ? '' : 'opacity-80'}">
                        <td class="col-nombre px-2 py-2.5 sticky left-0 z-10 border-r border-gray-200 bg-white
                                   group-hover:bg-gray-50/60 transition-colors">
                            <div class="flex items-center gap-1.5">
                                <span class="shrink-0 w-1.5 h-1.5 rounded-full {tieneAlgunaNota ? 'bg-amber-400' : 'bg-gray-200'}"></span>
                                <span class="nombre-alumno text-sm text-gray-900 font-medium">
                                    {alumno.apellido}, {alumno.nombre}
                                </span>
                            </div>
                        </td>

                        {#each competencias as comp, compIdx}
                            {@const key        = `${alumno.id}_${comp.id}`}
                            {@const notaActual = notas[key] ?? null}
                            {@const obsAbierta = obsActiva === key}
                            {@const tieneObs   = !!obs[key]}

                            <td class="px-2 py-1.5 text-center align-top
                                       {compIdx < competencias.length - 1 ? 'border-r border-gray-100' : ''}">

                                <div class="flex items-center justify-center gap-0.5 mb-1">
                                    {#each NOTAS as nota}
                                        <button
                                            type="button"
                                            on:click={() => setNota(alumno.id, String(comp.id), nota)}
                                            title="{nota}: {nota === 'AD' ? 'Logro destacado' : nota === 'A' ? 'Logro esperado' : nota === 'B' ? 'En proceso' : 'En inicio'}"
                                            class="w-8 h-7 text-xs font-semibold rounded transition-all cursor-pointer
                                                   {notaColor(nota, notaActual === nota)}"
                                        >
                                            {nota}
                                        </button>
                                    {/each}

                                    <button
                                        type="button"
                                        on:click={() => toggleObs(key)}
                                        title="Observación"
                                        class="btn-obs {obsAbierta ? 'btn-obs--activo' : ''} {tieneObs ? 'btn-obs--con-datos' : ''}"
                                    >
                                        <svg width="11" height="11" viewBox="0 0 14 14" fill="none">
                                            <path d="M2 2h10v8H8l-2 2-1-2H2V2z" stroke="currentColor" stroke-width="1.3" stroke-linejoin="round"/>
                                            <path d="M4 5h6M4 7.5h4" stroke="currentColor" stroke-width="1.1" stroke-linecap="round"/>
                                        </svg>
                                    </button>
                                </div>

                                {#if !notaActual}
                                    <span class="text-[9px] text-gray-300 leading-none">sin nota</span>
                                {/if}

                                {#if obsAbierta}
                                    <div class="obs-box mt-1">
                                        <textarea
                                            value={obs[key] ?? ""}
                                            on:input={(e) => setObs(key, e.currentTarget.value)}
                                            placeholder="Observación..."
                                            rows="2"
                                            class="obs-textarea"
                                        ></textarea>
                                    </div>
                                {:else if tieneObs}
                                    <p class="obs-preview">{obs[key]}</p>
                                {/if}
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
                class="text-sm text-white bg-amber-600 hover:bg-amber-700
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

  .btn-obs {
    width: 22px; height: 28px;
    display: inline-flex; align-items: center; justify-content: center;
    border-radius: 4px; border: none; background: transparent;
    color: #C8D3E8; cursor: pointer;
    transition: background .15s, color .15s;
    flex-shrink: 0;
  }
  .btn-obs:hover            { background: #FEF3E2; color: #92400E; }
  .btn-obs--activo          { background: #FEF3E2; color: #92400E; }
  .btn-obs--con-datos       { color: #C8882A; }
  .btn-obs--con-datos:hover { background: #FEF3E2; color: #A06820; }

  .obs-box { width: 100%; }
  .obs-textarea {
    width: 100%; min-width: 130px;
    font-size: .72rem; line-height: 1.4;
    border: 1px solid #DDE3EE; border-radius: 6px;
    padding: 4px 6px; resize: vertical; outline: none;
    color: #1A2332; background: #FAFAFA;
    transition: border-color .15s;
  }
  .obs-textarea:focus { border-color: rgba(180,100,20,.35); background: #fff; }
  .obs-preview {
    font-size: .68rem; color: #C8882A;
    line-height: 1.3; margin-top: 2px;
    text-align: left; white-space: pre-wrap;
    word-break: break-word; max-height: 40px; overflow: hidden;
  }
</style>