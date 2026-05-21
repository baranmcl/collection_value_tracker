<script lang="ts">
  import type { ValuePoint } from '$lib/db/queries/refresh';
  import { formatCents } from '$lib/money';

  let { history }: { history: ValuePoint[] } = $props();

  // SVG viewBox and plot-area bounds.
  const W = 600, H = 160;
  const L = 44, R = 560, TOP = 20, BOT = 128;

  // Geometry for the 2+-point line. null for the empty / single-point states.
  let chart = $derived.by(() => {
    if (history.length < 2) return null;
    const values = history.map((p) => p.value);
    const min = Math.min(...values);
    const max = Math.max(...values);
    const span = max - min;
    const x = (i: number) => L + (i * (R - L)) / (history.length - 1);
    const y = (v: number) => (span === 0 ? (TOP + BOT) / 2 : BOT - ((v - min) / span) * (BOT - TOP));
    const points = history.map((p, i) => ({ cx: x(i), cy: y(p.value), point: p }));
    return { points, polyline: points.map((p) => `${p.cx},${p.cy}`).join(' ') };
  });

  let last = $derived(history[history.length - 1]);
</script>

{#if history.length === 0}
  <p class="note">No value history yet — run a refresh to start tracking.</p>
{:else if history.length === 1}
  <p class="note">
    First value recorded: {formatCents(history[0].value)} on {history[0].at.toLocaleDateString()}.
    The trend line appears after your next refresh.
  </p>
{:else if chart}
  <svg viewBox="0 0 {W} {H}" class="chart" role="img" aria-label="Collection value over time">
    <polyline points={chart.polyline} fill="none" stroke="var(--accent)" stroke-width="2" />
    {#each chart.points as p}
      <circle cx={p.cx} cy={p.cy} r="3.5" fill="var(--accent-warm)">
        <title>{p.point.at.toLocaleDateString()} — {formatCents(p.point.value)}</title>
      </circle>
    {/each}
    <text x={L} y="148" class="axis">{history[0].at.toLocaleDateString()}</text>
    <text x={R} y="148" class="axis end">{last.at.toLocaleDateString()}</text>
    <text x={chart.points[0].cx} y={chart.points[0].cy - 9} class="val">{formatCents(history[0].value)}</text>
    <text x={chart.points[chart.points.length - 1].cx} y={chart.points[chart.points.length - 1].cy - 9} class="val end">{formatCents(last.value)}</text>
  </svg>
{/if}

<style>
  .note { color: var(--text-dim); font-size: var(--fs-sm); }
  .chart { width: 100%; height: auto; }
  .axis { fill: var(--text-dim); font-size: 11px; }
  .val { fill: var(--accent-warm); font-size: 12px; font-family: var(--mono); }
  .end { text-anchor: end; }
</style>
