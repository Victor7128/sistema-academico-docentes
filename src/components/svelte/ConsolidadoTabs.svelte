<script lang="ts">
    import ConsolidadoForm from "./Consolidado.svelte";
    import ConsolidadoAsistencia from "./ConsolidadoAsistencia.svelte";
    import type { Alumno, Sesion, SesionCriterio } from "../../lib/types";

    export let alumnos: Alumno[] = [];
    export let sesiones: (Sesion & { criterios: SesionCriterio[] })[] = [];
    export let evaluaciones: {
        sesionCriterioId: number;
        sesionId: number;
        alumnoId: number;
        nota: string;
        observacion: string | null;
    }[] = [];
    export let consolidadosIniciales: {
        alumnoId: number;
        notaFinal: string;
    }[] = [];
    export let faltas: {
        sesionId: number;
        alumnoId: number;
        observacion: string | null;
    }[] = [];
    export let curriculo: any = null;
    export let bimestreId: number;
    export let seccionId: number;
    export let seccionNombre: string = "";
    export let gradoNombre: string = "";
    export let bimestreNombre: string = "";
    // NUEVO
    export let examenNotas: { alumnoId: number; competenciaId: string; nota: string | null }[] = [];

    type Tab = "notas" | "asistencia";
    let tabActivo: Tab = "notas";

    function cambiarTab(t: Tab) {
        tabActivo = t;
    }
</script>

<!-- Tabs -->
<div class="tabs-bar">
    <button
        class="tab-btn"
        class:tab-btn--activo={tabActivo === "notas"}
        on:click={() => cambiarTab("notas")}
        type="button"
    >
        <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
            <rect x="1" y="2" width="14" height="12" rx="2" stroke="currentColor" stroke-width="1.4"/>
            <path d="M4 6h8M4 9h5M4 12h3" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/>
        </svg>
        Notas
    </button>
    <button
        class="tab-btn"
        class:tab-btn--activo={tabActivo === "asistencia"}
        on:click={() => cambiarTab("asistencia")}
        type="button"
    >
        <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
            <rect x="1" y="2" width="14" height="12" rx="2" stroke="currentColor" stroke-width="1.4"/>
            <path d="M5 7l2 2 4-4" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"/>
        </svg>
        Asistencia
    </button>
</div>

{#if tabActivo === "notas"}
    <ConsolidadoForm
        {alumnos}
        {sesiones}
        {evaluaciones}
        {consolidadosIniciales}
        {curriculo}
        {bimestreId}
        {seccionId}
        {seccionNombre}
        {gradoNombre}
        {bimestreNombre}
        {examenNotas}
    />
{:else}
    <ConsolidadoAsistencia {alumnos} {sesiones} {faltas} />
{/if}

<style>
    .tabs-bar {
        display: flex;
        gap: 0.5rem;
        margin-bottom: 1.5rem;
    }
    .tab-btn {
        display: inline-flex;
        align-items: center;
        gap: 0.4rem;
        font-size: 0.875rem;
        font-weight: 500;
        padding: 0.45rem 1rem;
        border-radius: 0.5rem;
        border: 1px solid #d1d5db;
        background: transparent;
        color: #6b7280;
        cursor: pointer;
        transition: background 0.12s, color 0.12s, border-color 0.12s;
    }
    .tab-btn:hover {
        background: #f9fafb;
        color: #374151;
    }
    .tab-btn--activo {
        background: #1d4ed8;
        color: #fff;
        border-color: #1d4ed8;
        font-weight: 600;
    }
    .tab-btn--activo:hover {
        background: #1e40af;
        color: #fff;
    }
</style>