<script lang="ts">
  import type { Alumno } from "../../lib/types";

  interface FilaAsistencia {
    alumnoId: number;
    falta: boolean;
    observacion: string;
    mostrarObs: boolean;
  }

  export let alumnos: Alumno[] = [];
  export let sesionId: number;
  export let asistenciasIniciales: {
    alumnoId: number;
    estado: "P" | "F";
    observacion: string | null;
  }[] = [];

  const mapaInicial = new Map(asistenciasIniciales.map((a) => [a.alumnoId, a]));

  let filas: FilaAsistencia[] = alumnos.map((a) => {
    const prev = mapaInicial.get(a.id);
    return {
      alumnoId: a.id,
      falta: prev?.estado === "F",
      observacion: prev?.observacion ?? "",
      mostrarObs: !!prev?.observacion,
    };
  });

  let guardando = false;
  let error = "";
  let exito = "";

  $: totalFaltas = filas.filter((f) => f.falta).length;
  $: totalPresentes = filas.length - totalFaltas;

  function toggleFalta(fila: FilaAsistencia) {
    fila.falta = !fila.falta;
    if (!fila.falta) {
      fila.mostrarObs = false;
      fila.observacion = "";
    }
    filas = filas;
  }

  function toggleObs(fila: FilaAsistencia) {
    fila.mostrarObs = !fila.mostrarObs;
    filas = filas;
  }

  async function guardar() {
    guardando = true;
    error = "";
    exito = "";

    try {
      // Solo enviamos las faltas; presentes no se guardan
      const asistencias = filas
        .filter((f) => f.falta)
        .map((f) => ({
          alumnoId: f.alumnoId,
          estado: "F" as const,
          observacion: f.observacion.trim() || null,
        }));

      const res = await fetch(`/api/asistencias/${sesionId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ asistencias }),
      });

      const json = await res.json();
      if (!res.ok) {
        error = json.error ?? "Error al guardar.";
        return;
      }

      exito =
        totalFaltas === 0
          ? "Asistencia guardada — todos presentes."
          : `Asistencia guardada — ${totalFaltas} falta${totalFaltas !== 1 ? "s" : ""} registrada${totalFaltas !== 1 ? "s" : ""}.`;
      setTimeout(() => {
        exito = "";
      }, 3000);
    } catch {
      error = "No se pudo conectar con el servidor.";
    } finally {
      guardando = false;
    }
  }
</script>

<!-- Resumen -->
<div class="resumen-bar">
  <div class="resumen-item item-p">
    <span class="resumen-num">{totalPresentes}</span>
    <span class="resumen-lbl">Presentes</span>
  </div>
  <div class="resumen-item item-f">
    <span class="resumen-num">{totalFaltas}</span>
    <span class="resumen-lbl">Faltas</span>
  </div>
</div>

<!-- Mensajes -->
{#if error}
  <p class="msg-error">{error}</p>
{/if}
{#if exito}
  <p class="msg-exito">{exito}</p>
{/if}

<!-- Tabla -->
<div class="tabla-wrap">
  <table class="tabla">
    <thead>
      <tr>
        <th class="th-num">#</th>
        <th class="th-nombre">Apellidos y nombres</th>
        <th class="th-falta">Asistencia</th>
        <th class="th-obs">Obs.</th>
      </tr>
    </thead>
    <tbody>
      {#each filas as fila, i}
        {@const alumno = alumnos.find((a) => a.id === fila.alumnoId)}
        <tr class="fila" class:fila-falta={fila.falta}>
          <td class="td-num">{i + 1}</td>
          <td class="td-nombre">
            <span class:nombre-falta={fila.falta}>
              {alumno?.apellido}, {alumno?.nombre}
            </span>
          </td>
          <td class="td-falta">
            <button
              on:click={() => toggleFalta(fila)}
              class="btn-falta"
              class:btn-falta-activo={fila.falta}
              title={fila.falta ? "Quitar falta" : "Marcar falta"}
            >
              {#if fila.falta}
                <svg width="13" height="13" viewBox="0 0 16 16" fill="none">
                  <path
                    d="M3 3l10 10M13 3L3 13"
                    stroke="currentColor"
                    stroke-width="2"
                    stroke-linecap="round"
                  />
                </svg>
                Falta
              {:else}
                <svg width="13" height="13" viewBox="0 0 16 16" fill="none">
                  <circle
                    cx="8"
                    cy="8"
                    r="6"
                    stroke="currentColor"
                    stroke-width="1.5"
                  />
                  <path
                    d="M5.5 8l2 2 3-3"
                    stroke="currentColor"
                    stroke-width="1.5"
                    stroke-linecap="round"
                    stroke-linejoin="round"
                  />
                </svg>
                Presente
              {/if}
            </button>
          </td>
          <td class="td-obs">
            {#if fila.falta}
              <button
                on:click={() => toggleObs(fila)}
                class="obs-toggle"
                class:obs-activo={fila.mostrarObs}
                title="Agregar observación"
              >
                <svg width="13" height="13" viewBox="0 0 16 16" fill="none">
                  <path
                    d="M2 4h12M2 8h8M2 12h5"
                    stroke="currentColor"
                    stroke-width="1.4"
                    stroke-linecap="round"
                  />
                </svg>
              </button>
            {/if}
          </td>
        </tr>
        {#if fila.falta && fila.mostrarObs}
          <tr class="fila-obs-row">
            <td colspan="4" class="td-obs-input">
              <input
                type="text"
                bind:value={fila.observacion}
                placeholder="Observación para {alumno?.apellido}, {alumno?.nombre}..."
                class="obs-input"
              />
            </td>
          </tr>
        {/if}
      {/each}
    </tbody>
  </table>
</div>

<!-- Guardar -->
<div class="footer-guardar">
  <button on:click={guardar} disabled={guardando} class="btn-guardar">
    {#if guardando}
      <svg class="spin" width="14" height="14" viewBox="0 0 16 16" fill="none">
        <path
          d="M8 2a6 6 0 1 0 6 6"
          stroke="currentColor"
          stroke-width="1.8"
          stroke-linecap="round"
        />
      </svg>
      Guardando...
    {:else}
      <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
        <path
          d="M2 8l4 4 8-8"
          stroke="currentColor"
          stroke-width="1.8"
          stroke-linecap="round"
          stroke-linejoin="round"
        />
      </svg>
      Guardar asistencia
    {/if}
  </button>
</div>

<style>
  /* ── Resumen ── */
  .resumen-bar {
    display: flex;
    gap: 0.75rem;
    margin-bottom: 1.25rem;
    flex-wrap: wrap;
  }
  .resumen-item {
    display: flex;
    flex-direction: column;
    align-items: center;
    padding: 0.5rem 1.1rem;
    border-radius: 0.625rem;
    border: 1px solid;
    min-width: 72px;
  }
  .resumen-num {
    font-size: 1.3rem;
    font-weight: 700;
    line-height: 1;
  }
  .resumen-lbl {
    font-size: 0.65rem;
    margin-top: 0.25rem;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.05em;
  }

  .item-p {
    background: #f0faf4;
    border-color: #a7d7b8;
    color: #1a6b3a;
  }
  .item-f {
    background: #fef2f2;
    border-color: #fca5a5;
    color: #991b1b;
  }

  /* ── Mensajes ── */
  .msg-error {
    margin-bottom: 0.75rem;
    font-size: 0.825rem;
    color: #dc2626;
    background: #fef2f2;
    border: 1px solid #fca5a5;
    border-radius: 0.5rem;
    padding: 0.5rem 0.75rem;
  }
  .msg-exito {
    margin-bottom: 0.75rem;
    font-size: 0.825rem;
    color: #15803d;
    background: #f0fdf4;
    border: 1px solid #86efac;
    border-radius: 0.5rem;
    padding: 0.5rem 0.75rem;
  }

  /* ── Tabla ── */
  .tabla-wrap {
    border: 1px solid #e5e7eb;
    border-radius: 0.75rem;
    overflow: hidden;
    margin-bottom: 1rem;
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
  .th-num {
    width: 40px;
  }
  .th-falta {
    width: 140px;
  }
  .th-obs {
    width: 48px;
    text-align: center;
  }

  .fila {
    border-bottom: 1px solid #f3f4f6;
    transition: background 0.1s;
  }
  .fila:last-child {
    border-bottom: none;
  }
  .fila:hover {
    background: #f9fafb;
  }
  .fila-falta {
    background: #fff8f8;
  }
  .fila-falta:hover {
    background: #fef2f2;
  }

  td {
    padding: 0.6rem 1rem;
  }
  .td-num {
    color: #9ca3af;
    font-size: 0.78rem;
  }
  .td-nombre {
    font-weight: 500;
    color: #111827;
  }
  .td-obs {
    text-align: center;
  }

  .nombre-falta {
    color: #dc2626;
  }

  /* ── Botón falta toggle ── */
  .btn-falta {
    display: inline-flex;
    align-items: center;
    gap: 0.3rem;
    font-size: 0.75rem;
    font-weight: 600;
    padding: 0.3rem 0.65rem;
    border-radius: 0.4rem;
    border: 1.5px solid #e5e7eb;
    background: #f9fafb;
    color: #6b7280;
    cursor: pointer;
    transition: all 0.15s;
    white-space: nowrap;
  }
  .btn-falta:hover:not(.btn-falta-activo) {
    border-color: #fca5a5;
    background: #fef2f2;
    color: #dc2626;
  }
  .btn-falta-activo {
    background: #fee2e2;
    border-color: #fca5a5;
    color: #dc2626;
  }
  .btn-falta-activo:hover {
    background: #fecaca;
    border-color: #f87171;
  }

  /* ── Observación ── */
  .obs-toggle {
    width: 28px;
    height: 28px;
    border-radius: 0.375rem;
    border: 1px solid #e5e7eb;
    background: transparent;
    color: #9ca3af;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    margin: 0 auto;
    transition: all 0.12s;
  }
  .obs-toggle:hover {
    background: #f3f4f6;
    color: #4b5563;
  }
  .obs-toggle.obs-activo {
    background: #eef2f9;
    border-color: rgba(27, 58, 107, 0.3);
    color: #1b3a6b;
  }

  .fila-obs-row td {
    padding: 0.25rem 1rem 0.5rem;
    background: #fffafa;
  }
  .obs-input {
    width: 100%;
    font-size: 0.8rem;
    border: 1px solid #fca5a5;
    border-radius: 0.4rem;
    padding: 0.35rem 0.6rem;
    color: #374151;
    background: #fff;
    outline: none;
  }
  .obs-input:focus {
    border-color: #f87171;
  }

  /* ── Footer ── */
  .footer-guardar {
    display: flex;
    justify-content: flex-end;
  }
  .btn-guardar {
    display: flex;
    align-items: center;
    gap: 0.4rem;
    font-size: 0.875rem;
    font-weight: 500;
    color: #fff;
    background: #1b3a6b;
    border: none;
    border-radius: 0.625rem;
    padding: 0.6rem 1.25rem;
    cursor: pointer;
    transition: background 0.2s;
    box-shadow: 0 3px 10px rgba(27, 58, 107, 0.25);
  }
  .btn-guardar:hover:not(:disabled) {
    background: #2a5298;
  }
  .btn-guardar:disabled {
    background: rgba(27, 58, 107, 0.32);
    cursor: not-allowed;
  }

  .spin {
    animation: spin 0.7s linear infinite;
  }
  @keyframes spin {
    to {
      transform: rotate(360deg);
    }
  }
</style>
