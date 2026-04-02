<script lang="ts">
    import type { Sesion, SesionCriterio } from "../../lib/types";

    export let alumnos: { id: number; nombre: string; apellido: string }[] = [];
    export let sesiones: (Sesion & { criterios: SesionCriterio[] })[] = [];
    export let faltas: {
        sesionId: number;
        alumnoId: number;
        observacion: string | null;
    }[] = [];
    export let curriculo: any = null;

    // ── Mapa de faltas por sesión ─────────────────────────────────────────
    $: faltasPorSesion = (() => {
        const m = new Map<
            number,
            { alumnoId: number; observacion: string | null }[]
        >();
        for (const f of faltas) {
            if (!m.has(f.sesionId)) m.set(f.sesionId, []);
            m.get(f.sesionId)!.push({
                alumnoId: f.alumnoId,
                observacion: f.observacion,
            });
        }
        return m;
    })();

    // ── Helpers ───────────────────────────────────────────────────────────
    function nombreAlumno(id: number): string {
        const a = alumnos.find((a) => a.id === id);
        return a ? `${a.apellido}, ${a.nombre}` : `Alumno ${id}`;
    }

    function nombreCompetencia(id: string): string {
        const comp = curriculo?.competencias?.find(
            (c: any) => String(c.id) === id,
        );
        return comp?.nombre ?? id;
    }

    function competenciasDeSeison(
        sesion: Sesion & { criterios: SesionCriterio[] },
    ): string[] {
        const ids = [
            ...new Set(sesion.criterios.map((c) => String(c.competenciaId))),
        ];
        return ids;
    }

    function formatFecha(fecha: string): string {
        return new Date(fecha + "T12:00:00").toLocaleDateString("es-PE", {
            day: "2-digit",
            month: "short",
            year: "numeric",
        });
    }

    // ── Filtros ───────────────────────────────────────────────────────────
    let filtroDesde = "";
    let filtroHasta = "";
    let filtroCompetencia = "";

    $: competenciasDisponibles = (() => {
        const ids = new Set<string>();
        for (const s of sesiones)
            for (const c of s.criterios) ids.add(String(c.competenciaId));
        return [...ids];
    })();

    $: sesionesFiltradas = sesiones.filter((s) => {
        if (filtroDesde && s.fecha < filtroDesde) return false;
        if (filtroHasta && s.fecha > filtroHasta) return false;
        if (filtroCompetencia) {
            const ids = s.criterios.map((c) => String(c.competenciaId));
            if (!ids.includes(filtroCompetencia)) return false;
        }
        return true;
    });

    function limpiarFiltros() {
        filtroDesde = "";
        filtroHasta = "";
        filtroCompetencia = "";
    }

    $: hayFiltros = filtroDesde || filtroHasta || filtroCompetencia;

    // ── Modal ─────────────────────────────────────────────────────────────
    let modalSesion: (Sesion & { criterios: SesionCriterio[] }) | null = null;

    function abrirModal(sesion: Sesion & { criterios: SesionCriterio[] }) {
        modalSesion = sesion;
    }

    function cerrarModal() {
        modalSesion = null;
    }
</script>

<!-- Filtros -->
<div class="filtros-bar">
    <div class="filtro-grupo">
        <label for="filtro-desde" class="filtro-label">Desde</label>
        <input
            id="filtro-desde"
            type="date"
            bind:value={filtroDesde}
            class="filtro-input"
        />
    </div>
    <div class="filtro-grupo">
        <label for="filtro-hasta" class="filtro-label">Hasta</label>
        <input
            id="filtro-hasta"
            type="date"
            bind:value={filtroHasta}
            class="filtro-input"
        />
    </div>
    <div class="filtro-grupo filtro-comp">
        <label for="filtro-comp" class="filtro-label">Competencia</label>
        <select
            id="filtro-comp"
            bind:value={filtroCompetencia}
            class="filtro-input"
        >
            <option value="">Todas</option>
            {#each competenciasDisponibles as id}
                <option value={id}>{nombreCompetencia(id)}</option>
            {/each}
        </select>
    </div>
    {#if hayFiltros}
        <button on:click={limpiarFiltros} class="btn-limpiar">
            <svg width="12" height="12" viewBox="0 0 16 16" fill="none">
                <path
                    d="M3 3l10 10M13 3L3 13"
                    stroke="currentColor"
                    stroke-width="1.8"
                    stroke-linecap="round"
                />
            </svg>
            Limpiar
        </button>
    {/if}
</div>

<!-- Resumen -->
<p class="resumen-txt">
    {sesionesFiltradas.length} sesión{sesionesFiltradas.length !== 1
        ? "es"
        : ""}
    {#if hayFiltros}<span class="badge-filtro">filtradas</span>{/if}
</p>

<!-- Tabla sesiones -->
{#if sesionesFiltradas.length === 0}
    <div class="empty-state">
        <p>No hay sesiones que coincidan con los filtros.</p>
    </div>
{:else}
    <div class="tabla-wrap">
        <table class="tabla">
            <thead>
                <tr>
                    <th class="th-fecha">Fecha</th>
                    <th class="th-sesion">Sesión</th>
                    <th class="th-comp">Competencias</th>
                    <th class="th-faltas">Faltas</th>
                    <th class="th-accion"></th>
                </tr>
            </thead>
            <tbody>
                {#each sesionesFiltradas as sesion}
                    {@const totalFaltas =
                        faltasPorSesion.get(sesion.id)?.length ?? 0}
                    {@const compIds = competenciasDeSeison(sesion)}
                    <tr
                        class="fila"
                        class:fila-con-faltas={totalFaltas > 0}
                        on:click={() => abrirModal(sesion)}
                        role="button"
                        tabindex="0"
                        on:keydown={(e) =>
                            e.key === "Enter" && abrirModal(sesion)}
                    >
                        <td class="td-fecha">{formatFecha(sesion.fecha)}</td>
                        <td class="td-sesion">{sesion.titulo}</td>
                        <td class="td-comp">
                            <div class="comp-chips">
                                {#each compIds as id}
                                    <span class="chip"
                                        >{nombreCompetencia(id)}</span
                                    >
                                {/each}
                            </div>
                        </td>
                        <td class="td-faltas">
                            {#if totalFaltas > 0}
                                <span class="badge-faltas">{totalFaltas}</span>
                            {:else}
                                <span class="badge-ok">✓</span>
                            {/if}
                        </td>
                        <td class="td-accion">
                            <svg
                                width="13"
                                height="13"
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
                        </td>
                    </tr>
                {/each}
            </tbody>
        </table>
    </div>
{/if}

<!-- Modal detalle sesión -->
{#if modalSesion}
    {@const faltasSeion = faltasPorSesion.get(modalSesion.id) ?? []}
    {@const faltasOrdenadas = [...faltasSeion].sort((a, b) =>
        nombreAlumno(a.alumnoId).localeCompare(nombreAlumno(b.alumnoId), "es"),
    )}

    <!-- svelte-ignore a11y-click-events-have-key-events -->
    <div class="modal-overlay" role="presentation" on:click={cerrarModal}>
        <div class="modal" role="dialog" aria-modal="true" tabindex="-1" on:click|stopPropagation>
            <div class="modal-header">
                <div class="modal-icon">
                    <svg width="18" height="18" viewBox="0 0 16 16" fill="none">
                        <rect
                            x="1"
                            y="2"
                            width="14"
                            height="12"
                            rx="2"
                            stroke="#1B3A6B"
                            stroke-width="1.4"
                        />
                        <path
                            d="M5 6h6M5 9h4"
                            stroke="#1B3A6B"
                            stroke-width="1.3"
                            stroke-linecap="round"
                        />
                    </svg>
                </div>
                <div>
                    <h2 class="modal-titulo">{modalSesion.titulo}</h2>
                    <p class="modal-fecha">{formatFecha(modalSesion.fecha)}</p>
                </div>
                <button on:click={cerrarModal} class="modal-cerrar" aria-label="Cerrar">
                    <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                        <path
                            d="M3 3l10 10M13 3L3 13"
                            stroke="currentColor"
                            stroke-width="1.8"
                            stroke-linecap="round"
                        />
                    </svg>
                </button>
            </div>

            {#if faltasOrdenadas.length === 0}
                <div class="modal-empty">
                    <svg width="32" height="32" viewBox="0 0 16 16" fill="none">
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
                    <p>Todos los alumnos presentes en esta sesión.</p>
                </div>
            {:else}
                <p class="modal-subtitulo">
                    {faltasOrdenadas.length} alumno{faltasOrdenadas.length !== 1
                        ? "s"
                        : ""} con falta
                </p>
                <div class="modal-lista">
                    {#each faltasOrdenadas as f}
                        <div class="modal-fila">
                            <div class="modal-alumno">
                                <span class="dot-falta"></span>
                                {nombreAlumno(f.alumnoId)}
                            </div>
                            {#if f.observacion}
                                <span class="modal-obs">{f.observacion}</span>
                            {/if}
                        </div>
                    {/each}
                </div>
            {/if}
        </div>
    </div>
{/if}

<style>
    /* ── Filtros ── */
    .filtros-bar {
        display: flex;
        gap: 0.75rem;
        align-items: flex-end;
        flex-wrap: wrap;
        margin-bottom: 1rem;
    }
    .filtro-grupo {
        display: flex;
        flex-direction: column;
        gap: 0.25rem;
    }
    .filtro-comp {
        flex: 1;
        min-width: 160px;
    }
    .filtro-label {
        font-size: 0.7rem;
        font-weight: 600;
        color: #6b7280;
        text-transform: uppercase;
        letter-spacing: 0.04em;
    }
    .filtro-input {
        font-size: 0.82rem;
        color: #1a2332;
        border: 1px solid #e5e7eb;
        border-radius: 0.5rem;
        padding: 0.4rem 0.65rem;
        background: #fff;
        outline: none;
        transition: border-color 0.15s;
    }
    .filtro-input:focus {
        border-color: rgba(27, 58, 107, 0.4);
    }

    .btn-limpiar {
        display: inline-flex;
        align-items: center;
        gap: 0.3rem;
        font-size: 0.75rem;
        font-weight: 500;
        color: #6b7280;
        border: 1px solid #e5e7eb;
        background: #f9fafb;
        border-radius: 0.5rem;
        padding: 0.4rem 0.65rem;
        cursor: pointer;
        transition: all 0.15s;
        align-self: flex-end;
    }
    .btn-limpiar:hover {
        background: #f3f4f6;
        color: #374151;
    }

    /* ── Resumen ── */
    .resumen-txt {
        font-size: 0.8rem;
        color: #8a96aa;
        margin-bottom: 0.75rem;
        display: flex;
        align-items: center;
        gap: 0.4rem;
    }
    .badge-filtro {
        font-size: 0.65rem;
        font-weight: 600;
        background: #eef2f9;
        color: #1b3a6b;
        border: 1px solid rgba(27, 58, 107, 0.2);
        border-radius: 999px;
        padding: 0.1rem 0.45rem;
        text-transform: uppercase;
        letter-spacing: 0.04em;
    }

    /* ── Empty ── */
    .empty-state {
        text-align: center;
        padding: 3rem 1rem;
        color: #9ca3af;
        font-size: 0.85rem;
    }

    /* ── Tabla ── */
    .tabla-wrap {
        border: 1px solid #e5e7eb;
        border-radius: 0.75rem;
        overflow: hidden;
    }
    .tabla {
        width: 100%;
        border-collapse: collapse;
        font-size: 0.85rem;
    }

    thead {
        background: #f9fafb;
        border-bottom: 1px solid #e5e7eb;
    }
    th {
        padding: 0.65rem 1rem;
        text-align: left;
        font-size: 0.7rem;
        font-weight: 600;
        color: #6b7280;
        text-transform: uppercase;
        letter-spacing: 0.05em;
    }
    .th-fecha {
        width: 110px;
    }
    .th-faltas {
        width: 70px;
        text-align: center;
    }
    .th-accion {
        width: 32px;
    }

    .fila {
        border-bottom: 1px solid #f3f4f6;
        cursor: pointer;
        transition: background 0.1s;
    }
    .fila:last-child {
        border-bottom: none;
    }
    .fila:hover {
        background: #f5f7fb;
    }
    .fila-con-faltas {
        background: #fff9f9;
    }
    .fila-con-faltas:hover {
        background: #fef2f2;
    }

    td {
        padding: 0.65rem 1rem;
    }
    .td-fecha {
        color: #6b7280;
        font-size: 0.78rem;
        white-space: nowrap;
    }
    .td-sesion {
        font-weight: 500;
        color: #111827;
    }
    .td-faltas {
        text-align: center;
    }
    .td-accion {
        color: #d1d5db;
    }

    /* ── Chips competencias ── */
    .comp-chips {
        display: flex;
        flex-wrap: wrap;
        gap: 0.3rem;
    }
    .chip {
        font-size: 0.68rem;
        font-weight: 500;
        background: #eef2f9;
        color: #1b3a6b;
        border: 1px solid rgba(27, 58, 107, 0.15);
        border-radius: 999px;
        padding: 0.15rem 0.55rem;
        white-space: nowrap;
        max-width: 180px;
        overflow: hidden;
        text-overflow: ellipsis;
    }

    /* ── Badges ── */
    .badge-faltas {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        min-width: 24px;
        height: 24px;
        background: #fee2e2;
        color: #dc2626;
        border: 1px solid #fca5a5;
        border-radius: 999px;
        font-size: 0.75rem;
        font-weight: 700;
        padding: 0 0.4rem;
    }
    .badge-ok {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        font-size: 0.8rem;
        color: #86efac;
    }

    /* ── Modal ── */
    .modal-overlay {
        position: fixed;
        inset: 0;
        background: rgba(0, 0, 0, 0.3);
        display: flex;
        align-items: center;
        justify-content: center;
        z-index: 50;
        padding: 1rem;
    }
    .modal {
        background: #fff;
        border-radius: 1.25rem;
        box-shadow: 0 20px 60px rgba(0, 0, 0, 0.15);
        width: 100%;
        max-width: 480px;
        max-height: 80vh;
        overflow-y: auto;
        padding: 1.5rem;
    }
    .modal-header {
        display: flex;
        align-items: flex-start;
        gap: 0.75rem;
        margin-bottom: 1.25rem;
    }
    .modal-icon {
        width: 40px;
        height: 40px;
        flex-shrink: 0;
        border-radius: 0.75rem;
        background: #eef2f9;
        border: 1px solid rgba(27, 58, 107, 0.12);
        display: flex;
        align-items: center;
        justify-content: center;
    }
    .modal-titulo {
        font-size: 0.95rem;
        font-weight: 600;
        color: #1a2332;
        margin: 0;
    }
    .modal-fecha {
        font-size: 0.75rem;
        color: #8a96aa;
        margin: 0.15rem 0 0;
    }
    .modal-cerrar {
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
    .modal-cerrar:hover {
        background: #f3f4f6;
        color: #374151;
    }

    .modal-subtitulo {
        font-size: 0.78rem;
        font-weight: 600;
        color: #dc2626;
        margin-bottom: 0.75rem;
    }
    .modal-empty {
        text-align: center;
        padding: 1.5rem 0;
        color: #9ca3af;
        font-size: 0.85rem;
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 0.5rem;
    }
    .modal-lista {
        display: flex;
        flex-direction: column;
        gap: 0.4rem;
    }
    .modal-fila {
        padding: 0.6rem 0.75rem;
        background: #fff8f8;
        border: 1px solid #fecaca;
        border-radius: 0.5rem;
    }
    .modal-alumno {
        display: flex;
        align-items: center;
        gap: 0.5rem;
        font-size: 0.85rem;
        font-weight: 500;
        color: #1a2332;
    }
    .dot-falta {
        width: 7px;
        height: 7px;
        border-radius: 50%;
        background: #dc2626;
        flex-shrink: 0;
    }
    .modal-obs {
        display: block;
        font-size: 0.75rem;
        color: #6b7280;
        margin-top: 0.25rem;
        padding-left: 1.1rem;
        font-style: italic;
    }
</style>
