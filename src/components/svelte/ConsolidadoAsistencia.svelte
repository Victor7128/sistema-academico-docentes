<script lang="ts">
    import type { Sesion, SesionCriterio } from "../../lib/types";

    export let alumnos: {
        id: number;
        nombre: string;
        apellido: string;
        orden: number;
    }[] = [];
    export let sesiones: (Sesion & { criterios: SesionCriterio[] })[] = [];
    export let faltas: {
        sesionId: number;
        alumnoId: number;
        observacion: string | null;
    }[] = [];

    // ── Tipos internos ────────────────────────────────────────────────────
    interface FaltaAlumno {
        fecha: string; // "YYYY-MM-DD"
        sesionTitulo: string;
        observacion: string | null;
    }

    interface ResumenAlumno {
        id: number;
        nombre: string;
        apellido: string;
        orden: number;
        totalFaltas: number;
        totalSesiones: number;
        porcentajeAsistencia: number;
        faltas: FaltaAlumno[];
    }

    // ── Datos derivados ───────────────────────────────────────────────────
    $: sesionMap = new Map(sesiones.map((s) => [s.id, s]));

    $: resumenAlumnos = (() => {
        const total = sesiones.length;
        return alumnos.map((a): ResumenAlumno => {
            const faltasAlumno = faltas
                .filter((f) => f.alumnoId === a.id)
                .map((f) => {
                    const s = sesionMap.get(f.sesionId);
                    return {
                        fecha: s?.fecha ?? "",
                        sesionTitulo: s?.titulo ?? `Sesión ${f.sesionId}`,
                        observacion: f.observacion,
                    };
                })
                .filter((f) => f.fecha !== "")
                .sort((a, b) => a.fecha.localeCompare(b.fecha));

            const tf = faltasAlumno.length;
            return {
                ...a,
                totalFaltas: tf,
                totalSesiones: total,
                porcentajeAsistencia:
                    total > 0 ? Math.round(((total - tf) / total) * 100) : 100,
                faltas: faltasAlumno,
            };
        });
    })();

    // ── KPIs bimestre ─────────────────────────────────────────────────────
    $: totalFaltasBimestre = faltas.length;
    $: alumnosSinFaltas = resumenAlumnos.filter(
        (a) => a.totalFaltas === 0,
    ).length;
    $: alumnoConMasFaltas = [...resumenAlumnos].sort(
        (a, b) => b.totalFaltas - a.totalFaltas,
    )[0];

    // ── Búsqueda y ordenación ─────────────────────────────────────────────
    let busqueda = "";
    let orden: "faltas-desc" | "faltas-asc" | "nombre" = "faltas-desc";

    $: alumnosFiltrados = (() => {
        let lista = [...resumenAlumnos];
        if (busqueda.trim()) {
            const q = busqueda.toLowerCase();
            lista = lista.filter(
                (a) =>
                    a.nombre.toLowerCase().includes(q) ||
                    a.apellido.toLowerCase().includes(q),
            );
        }
        if (orden === "faltas-desc")
            lista.sort(
                (a, b) => b.totalFaltas - a.totalFaltas || a.orden - b.orden,
            );
        else if (orden === "faltas-asc")
            lista.sort(
                (a, b) => a.totalFaltas - b.totalFaltas || a.orden - b.orden,
            );
        else lista.sort((a, b) => a.apellido.localeCompare(b.apellido, "es"));
        return lista;
    })();

    // ── Panel de detalle alumno ───────────────────────────────────────────
    let alumnoSeleccionado: ResumenAlumno | null = null;

    function abrirDetalle(a: ResumenAlumno) {
        alumnoSeleccionado = a;
    }
    function cerrarDetalle() {
        alumnoSeleccionado = null;
    }

    // ── Calendario mini ───────────────────────────────────────────────────
    interface DiaCalendario {
        fecha: string; // "YYYY-MM-DD" o "" para celdas vacías
        dia: number;
        esFalta: boolean;
        esSesion: boolean;
        observacion: string | null;
        sesionTitulo: string;
    }

    function buildCalendario(
        faltasAlumno: FaltaAlumno[],
    ): { mes: string; dias: DiaCalendario[][] }[] {
        if (sesiones.length === 0) return [];

        // Rango de fechas del bimestre
        const fechasSesiones = sesiones.map((s) => s.fecha).sort();
        const primerFecha = new Date(fechasSesiones[0] + "T12:00:00");
        const ultimaFecha = new Date(
            fechasSesiones[fechasSesiones.length - 1] + "T12:00:00",
        );

        const fechasFaltas = new Set(faltasAlumno.map((f) => f.fecha));
        const obsMap = new Map(
            faltasAlumno.map((f) => [
                f.fecha,
                { obs: f.observacion, titulo: f.sesionTitulo },
            ]),
        );
        const fechasSesionesSet = new Set(fechasSesiones);

        // Iterar mes a mes
        const meses: { mes: string; dias: DiaCalendario[][] }[] = [];
        let cursor = new Date(
            primerFecha.getFullYear(),
            primerFecha.getMonth(),
            1,
        );
        const limiteAnio = ultimaFecha.getFullYear();
        const limiteMes = ultimaFecha.getMonth();

        while (
            cursor.getFullYear() < limiteAnio ||
            (cursor.getFullYear() === limiteAnio &&
                cursor.getMonth() <= limiteMes)
        ) {
            const anio = cursor.getFullYear();
            const mes = cursor.getMonth();
            const nombreMes = cursor.toLocaleDateString("es-PE", {
                month: "long",
                year: "numeric",
            });
            const diasEnMes = new Date(anio, mes + 1, 0).getDate();

            // primer día de semana (lunes=0)
            let inicioSemana = new Date(anio, mes, 1).getDay(); // 0=dom
            inicioSemana = (inicioSemana + 6) % 7; // convertir a lun=0

            const celdas: DiaCalendario[] = [];
            for (let i = 0; i < inicioSemana; i++) {
                celdas.push({
                    fecha: "",
                    dia: 0,
                    esFalta: false,
                    esSesion: false,
                    observacion: null,
                    sesionTitulo: "",
                });
            }
            for (let d = 1; d <= diasEnMes; d++) {
                const fStr = `${anio}-${String(mes + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
                const info = obsMap.get(fStr);
                celdas.push({
                    fecha: fStr,
                    dia: d,
                    esFalta: fechasFaltas.has(fStr),
                    esSesion: fechasSesionesSet.has(fStr),
                    observacion: info?.obs ?? null,
                    sesionTitulo: info?.titulo ?? "",
                });
            }
            // dividir en semanas
            const semanas: DiaCalendario[][] = [];
            for (let i = 0; i < celdas.length; i += 7)
                semanas.push(celdas.slice(i, i + 7));
            meses.push({ mes: nombreMes, dias: semanas });
            cursor = new Date(anio, mes + 1, 1);
        }
        return meses;
    }

    $: calendarioActual = alumnoSeleccionado
        ? buildCalendario(alumnoSeleccionado.faltas)
        : [];

    // ── Helpers ───────────────────────────────────────────────────────────
    function colorAsistencia(pct: number): string {
        if (pct >= 90) return "#16a34a";
        if (pct >= 75) return "#ca8a04";
        return "#dc2626";
    }

    function formatFecha(fecha: string): string {
        return new Date(fecha + "T12:00:00").toLocaleDateString("es-PE", {
            day: "2-digit",
            month: "short",
            year: "numeric",
        });
    }

    const DIAS_SEMANA = ["L", "M", "X", "J", "V", "S", "D"];
</script>

<!-- ══ KPI Cards ══════════════════════════════════════════════════════════ -->
<div class="kpi-grid">
    {#if alumnoConMasFaltas && alumnoConMasFaltas.totalFaltas > 0}
        <div class="kpi-card kpi-card--amber">
            <span class="kpi-icon kpi-icon--amber">
                <svg width="18" height="18" viewBox="0 0 16 16" fill="none">
                    <circle
                        cx="8"
                        cy="5"
                        r="2.5"
                        stroke="#ca8a04"
                        stroke-width="1.4"
                    />
                    <path
                        d="M3 13c0-2.76 2.24-5 5-5s5 2.24 5 5"
                        stroke="#ca8a04"
                        stroke-width="1.4"
                        stroke-linecap="round"
                    />
                </svg>
            </span>
            <div>
                <p class="kpi-label">Más ausencias</p>
                <p class="kpi-valor kpi-valor--amber kpi-nombre">
                    {alumnoConMasFaltas.apellido}, {alumnoConMasFaltas.nombre}
                </p>
                <p class="kpi-sub">
                    {alumnoConMasFaltas.totalFaltas} falta{alumnoConMasFaltas.totalFaltas !==
                    1
                        ? "s"
                        : ""}
                </p>
            </div>
        </div>
    {/if}
</div>

<!-- ══ Controles ══════════════════════════════════════════════════════════ -->
<div class="controles-bar">
    <div class="busqueda-wrap">
        <svg
            class="busqueda-ico"
            width="14"
            height="14"
            viewBox="0 0 16 16"
            fill="none"
        >
            <circle
                cx="6.5"
                cy="6.5"
                r="4.5"
                stroke="#9ca3af"
                stroke-width="1.5"
            />
            <path
                d="M10 10l3 3"
                stroke="#9ca3af"
                stroke-width="1.5"
                stroke-linecap="round"
            />
        </svg>
        <input
            type="text"
            placeholder="Buscar alumno…"
            bind:value={busqueda}
            class="busqueda-input"
        />
    </div>
    <div class="orden-wrap">
        <label for="orden-select" class="orden-label">Ordenar por</label>
        <select id="orden-select" bind:value={orden} class="orden-select">
            <option value="faltas-desc">Más faltas primero</option>
            <option value="faltas-asc">Menos faltas primero</option>
            <option value="nombre">Apellido (A → Z)</option>
        </select>
    </div>
</div>

<!-- ══ Lista de alumnos ════════════════════════════════════════════════════ -->
{#if alumnosFiltrados.length === 0}
    <div class="empty-state">
        <p>No se encontró ningún alumno.</p>
    </div>
{:else}
    <div class="alumnos-lista">
        {#each alumnosFiltrados as a}
            {@const color = colorAsistencia(a.porcentajeAsistencia)}
            <button
                class="alumno-fila"
                class:alumno-fila--alert={a.totalFaltas >= 3}
                on:click={() => abrirDetalle(a)}
                type="button"
            >
                <!-- Avatar -->
                <div
                    class="alumno-avatar"
                    style="background:{color}22; border-color:{color}44"
                >
                    <span
                        style="color:{color}; font-weight:700; font-size:0.75rem"
                    >
                        {a.apellido.charAt(0)}{a.nombre.charAt(0)}
                    </span>
                </div>

                <!-- Nombre y barra -->
                <div class="alumno-info">
                    <p class="alumno-nombre">{a.apellido}, {a.nombre}</p>
                    <div class="barra-wrap">
                        <div class="barra-fondo">
                            <div
                                class="barra-fill"
                                style="width:{a.porcentajeAsistencia}%; background:{color}"
                            ></div>
                        </div>
                        <span class="barra-pct" style="color:{color}"
                            >{a.porcentajeAsistencia}%</span
                        >
                    </div>
                </div>

                <!-- Contador de faltas -->
                <div class="alumno-faltas">
                    {#if a.totalFaltas === 0}
                        <span class="badge-ok">✓</span>
                    {:else}
                        <span
                            class="badge-faltas"
                            style="background:{color}18; color:{color}; border-color:{color}44"
                        >
                            {a.totalFaltas}F
                        </span>
                    {/if}
                </div>

                <!-- Chevron -->
                <svg
                    class="chevron"
                    width="12"
                    height="12"
                    viewBox="0 0 16 16"
                    fill="none"
                >
                    <path
                        d="M6 4l4 4-4 4"
                        stroke="currentColor"
                        stroke-width="1.6"
                        stroke-linecap="round"
                        stroke-linejoin="round"
                    />
                </svg>
            </button>
        {/each}
    </div>
{/if}

<!-- ══ Panel de detalle alumno ════════════════════════════════════════════ -->
{#if alumnoSeleccionado}
    {@const a = alumnoSeleccionado}
    {@const color = colorAsistencia(a.porcentajeAsistencia)}

    <!-- svelte-ignore a11y-click-events-have-key-events -->
    <div class="drawer-overlay" role="presentation" on:click={cerrarDetalle}>
        <div
            class="drawer"
            role="dialog"
            aria-modal="true"
            tabindex="-1"
            on:click|stopPropagation
        >
            <!-- Header -->
            <div class="drawer-header">
                <div
                    class="drawer-avatar"
                    style="background:{color}22; border-color:{color}44"
                >
                    <span
                        style="color:{color}; font-size:1rem; font-weight:700"
                    >
                        {a.apellido.charAt(0)}{a.nombre.charAt(0)}
                    </span>
                </div>
                <div class="drawer-titulo-wrap">
                    <h2 class="drawer-titulo">{a.apellido}, {a.nombre}</h2>
                    <div class="drawer-stats">
                        <span
                            class="stat-chip"
                            style="background:{color}18; color:{color}; border-color:{color}33"
                        >
                            {a.porcentajeAsistencia}% asistencia
                        </span>
                        {#if a.totalFaltas > 0}
                            <span class="stat-chip stat-chip--falta">
                                {a.totalFaltas} falta{a.totalFaltas !== 1
                                    ? "s"
                                    : ""}
                            </span>
                        {:else}
                            <span class="stat-chip stat-chip--ok"
                                >Sin faltas</span
                            >
                        {/if}
                    </div>
                </div>
                <button
                    on:click={cerrarDetalle}
                    class="drawer-cerrar"
                    aria-label="Cerrar"
                >
                    <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
                        <path
                            d="M3 3l10 10M13 3L3 13"
                            stroke="currentColor"
                            stroke-width="1.8"
                            stroke-linecap="round"
                        />
                    </svg>
                </button>
            </div>

            <!-- Calendarios -->
            {#if a.totalFaltas === 0}
                <div class="drawer-empty">
                    <svg width="36" height="36" viewBox="0 0 16 16" fill="none">
                        <circle
                            cx="8"
                            cy="8"
                            r="6"
                            stroke="#86efac"
                            stroke-width="1.4"
                        />
                        <path
                            d="M5 8l2 2 4-4"
                            stroke="#86efac"
                            stroke-width="1.4"
                            stroke-linecap="round"
                            stroke-linejoin="round"
                        />
                    </svg>
                    <p>¡Asistencia perfecta este bimestre!</p>
                </div>
            {:else}
                <div class="drawer-section-label">Calendario de asistencia</div>
                <div class="calendarios-wrap">
                    {#each calendarioActual as { mes, dias }}
                        <div class="calendario">
                            <p class="cal-mes">{mes}</p>
                            <div class="cal-grid-header">
                                {#each DIAS_SEMANA as d}
                                    <span class="cal-dia-nombre">{d}</span>
                                {/each}
                            </div>
                            {#each dias as semana}
                                <div class="cal-semana">
                                    {#each semana as celda}
                                        {#if celda.dia === 0}
                                            <span
                                                class="cal-celda cal-celda--vacia"
                                            ></span>
                                        {:else if celda.esFalta}
                                            <span
                                                class="cal-celda cal-celda--falta"
                                                title={celda.observacion
                                                    ? `${celda.sesionTitulo}: ${celda.observacion}`
                                                    : celda.sesionTitulo}
                                            >
                                                {celda.dia}
                                                {#if celda.observacion}
                                                    <span class="cal-obs-dot"
                                                    ></span>
                                                {/if}
                                            </span>
                                        {:else if celda.esSesion}
                                            <span
                                                class="cal-celda cal-celda--sesion"
                                                >{celda.dia}</span
                                            >
                                        {:else}
                                            <span class="cal-celda"
                                                >{celda.dia}</span
                                            >
                                        {/if}
                                    {/each}
                                </div>
                            {/each}
                        </div>
                    {/each}
                </div>

                <!-- Leyenda -->
                <div class="leyenda">
                    <span class="leyenda-item">
                        <span class="leyenda-dot leyenda-dot--falta"></span> Falta
                    </span>
                    <span class="leyenda-item">
                        <span class="leyenda-dot leyenda-dot--sesion"></span> Sesión
                        (presente)
                    </span>
                    <span class="leyenda-item">
                        <span class="leyenda-dot leyenda-dot--obs"></span> Con observación
                    </span>
                </div>

                <!-- Detalle de cada falta -->
                <div class="drawer-section-label" style="margin-top:1.25rem">
                    Detalle de faltas
                </div>
                <div class="faltas-lista">
                    {#each a.faltas as f}
                        <div class="falta-item">
                            <div class="falta-fecha-wrap">
                                <span class="falta-fecha"
                                    >{formatFecha(f.fecha)}</span
                                >
                            </div>
                            <div class="falta-info">
                                <p class="falta-sesion">{f.sesionTitulo}</p>
                                {#if f.observacion}
                                    <p class="falta-obs">
                                        <svg
                                            width="10"
                                            height="10"
                                            viewBox="0 0 16 16"
                                            fill="none"
                                            style="flex-shrink:0"
                                        >
                                            <path
                                                d="M2 2h12v9H9l-3 3v-3H2V2z"
                                                stroke="#6b7280"
                                                stroke-width="1.4"
                                                stroke-linejoin="round"
                                            />
                                        </svg>
                                        {f.observacion}
                                    </p>
                                {/if}
                            </div>
                        </div>
                    {/each}
                </div>
            {/if}
        </div>
    </div>
{/if}

<style>
    /* ── KPI Grid ── */
    .kpi-grid {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(160px, 1fr));
        gap: 0.75rem;
        margin-bottom: 1.25rem;
    }
    .kpi-card {
        display: flex;
        align-items: center;
        gap: 0.75rem;
        background: #fff;
        border: 1px solid #e5e7eb;
        border-radius: 0.875rem;
        padding: 0.9rem 1rem;
    }
    .kpi-icon {
        width: 38px;
        height: 38px;
        flex-shrink: 0;
        border-radius: 0.625rem;
        display: flex;
        align-items: center;
        justify-content: center;
    }
    .kpi-icon--amber {
        background: #fef9c3;
        border: 1px solid #fde047;
    }
    .kpi-label {
        font-size: 0.68rem;
        font-weight: 600;
        color: #9ca3af;
        text-transform: uppercase;
        letter-spacing: 0.04em;
        margin: 0 0 0.2rem;
    }
    .kpi-valor {
        font-size: 1.1rem;
        font-weight: 700;
        color: #1a2332;
        margin: 0;
        line-height: 1.2;
    }
    .kpi-valor--amber {
        color: #b45309;
    }
    .kpi-nombre {
        font-size: 0.82rem;
    }
    .kpi-sub {
        font-size: 0.7rem;
        color: #b45309;
        margin: 0.1rem 0 0;
    }

    /* ── Controles ── */
    .controles-bar {
        display: flex;
        gap: 0.75rem;
        align-items: center;
        flex-wrap: wrap;
        margin-bottom: 0.875rem;
    }
    .busqueda-wrap {
        position: relative;
        flex: 1;
        min-width: 180px;
    }
    .busqueda-ico {
        position: absolute;
        left: 0.6rem;
        top: 50%;
        transform: translateY(-50%);
        pointer-events: none;
    }
    .busqueda-input {
        width: 100%;
        padding: 0.45rem 0.75rem 0.45rem 2rem;
        font-size: 0.82rem;
        color: #1a2332;
        border: 1px solid #e5e7eb;
        border-radius: 0.5rem;
        background: #fff;
        outline: none;
        box-sizing: border-box;
    }
    .busqueda-input:focus {
        border-color: rgba(27, 58, 107, 0.4);
    }
    .busqueda-input::placeholder {
        color: #d1d5db;
    }

    .orden-wrap {
        display: flex;
        align-items: center;
        gap: 0.4rem;
    }
    .orden-label {
        font-size: 0.7rem;
        font-weight: 600;
        color: #9ca3af;
        text-transform: uppercase;
        letter-spacing: 0.04em;
        white-space: nowrap;
    }
    .orden-select {
        font-size: 0.8rem;
        color: #374151;
        border: 1px solid #e5e7eb;
        border-radius: 0.5rem;
        padding: 0.4rem 0.65rem;
        background: #fff;
        outline: none;
        cursor: pointer;
    }

    /* ── Lista alumnos ── */
    .alumnos-lista {
        display: flex;
        flex-direction: column;
        gap: 0.35rem;
    }
    .alumno-fila {
        display: flex;
        align-items: center;
        gap: 0.75rem;
        width: 100%;
        background: #fff;
        border: 1px solid #e5e7eb;
        border-radius: 0.75rem;
        padding: 0.65rem 0.9rem;
        cursor: pointer;
        text-align: left;
        transition:
            background 0.12s,
            border-color 0.12s;
    }
    .alumno-fila:hover {
        background: #f5f7fb;
        border-color: rgba(27, 58, 107, 0.2);
    }
    .alumno-fila--alert {
        border-left: 3px solid #dc2626;
    }

    .alumno-avatar {
        width: 36px;
        height: 36px;
        flex-shrink: 0;
        border-radius: 50%;
        border: 1.5px solid;
        display: flex;
        align-items: center;
        justify-content: center;
    }
    .alumno-info {
        flex: 1;
        min-width: 0;
    }
    .alumno-nombre {
        font-size: 0.85rem;
        font-weight: 500;
        color: #1a2332;
        margin: 0 0 0.3rem;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
    }
    .barra-wrap {
        display: flex;
        align-items: center;
        gap: 0.5rem;
    }
    .barra-fondo {
        flex: 1;
        height: 5px;
        background: #f3f4f6;
        border-radius: 999px;
        overflow: hidden;
    }
    .barra-fill {
        height: 100%;
        border-radius: 999px;
        transition: width 0.3s;
    }
    .barra-pct {
        font-size: 0.68rem;
        font-weight: 600;
        min-width: 32px;
        text-align: right;
    }

    .alumno-faltas {
        flex-shrink: 0;
    }
    .badge-faltas {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        min-width: 32px;
        height: 24px;
        border: 1px solid;
        border-radius: 999px;
        font-size: 0.72rem;
        font-weight: 700;
        padding: 0 0.45rem;
    }
    .badge-ok {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        font-size: 0.85rem;
        color: #86efac;
        min-width: 32px;
    }
    .chevron {
        color: #d1d5db;
        flex-shrink: 0;
    }

    /* ── Empty ── */
    .empty-state {
        text-align: center;
        padding: 3rem 1rem;
        color: #9ca3af;
        font-size: 0.85rem;
    }

    /* ── Drawer ── */
    .drawer-overlay {
        position: fixed;
        inset: 0;
        background: rgba(0, 0, 0, 0.32);
        display: flex;
        justify-content: flex-end;
        z-index: 50;
    }
    .drawer {
        background: #fff;
        width: 100%;
        max-width: 420px;
        height: 100%;
        overflow-y: auto;
        padding: 1.5rem;
        box-shadow: -8px 0 40px rgba(0, 0, 0, 0.12);
        display: flex;
        flex-direction: column;
        gap: 0;
    }

    .drawer-header {
        display: flex;
        align-items: flex-start;
        gap: 0.75rem;
        margin-bottom: 1.25rem;
    }
    .drawer-avatar {
        width: 48px;
        height: 48px;
        flex-shrink: 0;
        border-radius: 50%;
        border: 2px solid;
        display: flex;
        align-items: center;
        justify-content: center;
    }
    .drawer-titulo-wrap {
        flex: 1;
        min-width: 0;
    }
    .drawer-titulo {
        font-size: 0.95rem;
        font-weight: 600;
        color: #1a2332;
        margin: 0 0 0.4rem;
    }
    .drawer-stats {
        display: flex;
        gap: 0.4rem;
        flex-wrap: wrap;
    }
    .stat-chip {
        font-size: 0.7rem;
        font-weight: 600;
        border: 1px solid;
        border-radius: 999px;
        padding: 0.15rem 0.55rem;
    }
    .stat-chip--falta {
        background: #fee2e2;
        color: #dc2626;
        border-color: #fca5a5;
    }
    .stat-chip--ok {
        background: #dcfce7;
        color: #16a34a;
        border-color: #86efac;
    }

    .drawer-cerrar {
        margin-left: auto;
        flex-shrink: 0;
        width: 28px;
        height: 28px;
        border: 1px solid #e5e7eb;
        border-radius: 0.5rem;
        background: transparent;
        color: #9ca3af;
        cursor: pointer;
        display: flex;
        align-items: center;
        justify-content: center;
        transition: all 0.12s;
    }
    .drawer-cerrar:hover {
        background: #f3f4f6;
        color: #374151;
    }

    .drawer-empty {
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 0.75rem;
        padding: 2rem 0;
        color: #9ca3af;
        font-size: 0.85rem;
        text-align: center;
    }

    .drawer-section-label {
        font-size: 0.68rem;
        font-weight: 700;
        color: #9ca3af;
        text-transform: uppercase;
        letter-spacing: 0.06em;
        margin-bottom: 0.75rem;
    }

    /* ── Calendario ── */
    .calendarios-wrap {
        display: flex;
        flex-direction: column;
        gap: 1rem;
    }
    .calendario {
        background: #f9fafb;
        border: 1px solid #e5e7eb;
        border-radius: 0.75rem;
        padding: 0.875rem;
    }
    .cal-mes {
        font-size: 0.8rem;
        font-weight: 600;
        color: #374151;
        margin: 0 0 0.6rem;
        text-transform: capitalize;
    }
    .cal-grid-header {
        display: grid;
        grid-template-columns: repeat(7, 1fr);
        margin-bottom: 0.2rem;
    }
    .cal-dia-nombre {
        font-size: 0.62rem;
        font-weight: 700;
        color: #9ca3af;
        text-align: center;
        padding: 0.15rem 0;
        text-transform: uppercase;
    }
    .cal-semana {
        display: grid;
        grid-template-columns: repeat(7, 1fr);
        gap: 0.15rem;
    }
    .cal-celda {
        position: relative;
        display: flex;
        align-items: center;
        justify-content: center;
        height: 30px;
        font-size: 0.75rem;
        color: #374151;
        border-radius: 0.375rem;
    }
    .cal-celda--vacia {
        color: transparent;
    }
    .cal-celda--sesion {
        background: #e0e7ff;
        color: #1b3a6b;
        font-weight: 500;
    }
    .cal-celda--falta {
        background: #fee2e2;
        color: #dc2626;
        font-weight: 700;
        border: 1px solid #fca5a5;
    }
    .cal-obs-dot {
        position: absolute;
        bottom: 3px;
        right: 3px;
        width: 5px;
        height: 5px;
        border-radius: 50%;
        background: #f59e0b;
    }

    /* ── Leyenda ── */
    .leyenda {
        display: flex;
        gap: 1rem;
        flex-wrap: wrap;
        margin-top: 0.6rem;
    }
    .leyenda-item {
        display: flex;
        align-items: center;
        gap: 0.35rem;
        font-size: 0.7rem;
        color: #6b7280;
    }
    .leyenda-dot {
        width: 10px;
        height: 10px;
        border-radius: 0.2rem;
    }
    .leyenda-dot--falta {
        background: #fee2e2;
        border: 1px solid #fca5a5;
    }
    .leyenda-dot--sesion {
        background: #e0e7ff;
        border: 1px solid #a5b4fc;
    }
    .leyenda-dot--obs {
        background: #f59e0b;
        border-radius: 50%;
    }

    /* ── Detalle de faltas ── */
    .faltas-lista {
        display: flex;
        flex-direction: column;
        gap: 0.5rem;
    }
    .falta-item {
        display: flex;
        gap: 0.75rem;
        background: #fff8f8;
        border: 1px solid #fecaca;
        border-radius: 0.625rem;
        padding: 0.6rem 0.8rem;
    }
    .falta-fecha-wrap {
        flex-shrink: 0;
    }
    .falta-fecha {
        font-size: 0.7rem;
        font-weight: 600;
        color: #dc2626;
        background: #fee2e2;
        border: 1px solid #fca5a5;
        border-radius: 0.375rem;
        padding: 0.2rem 0.45rem;
        white-space: nowrap;
    }
    .falta-info {
        flex: 1;
        min-width: 0;
    }
    .falta-sesion {
        font-size: 0.82rem;
        font-weight: 500;
        color: #1a2332;
        margin: 0 0 0.2rem;
    }
    .falta-obs {
        display: flex;
        align-items: flex-start;
        gap: 0.3rem;
        font-size: 0.73rem;
        color: #6b7280;
        font-style: italic;
        margin: 0;
    }
</style>
