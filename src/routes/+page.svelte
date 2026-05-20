<script lang="ts">
  import type { PageData } from './$types';
  import { formatCents } from '$lib/money';
  import ConsoleBar from '$lib/components/ConsoleBar.svelte';
  import MoversPanel from '$lib/components/MoversPanel.svelte';

  let { data }: { data: PageData } = $props();
  let delta = $derived(data.refreshDelta);
</script>

<h1>Dashboard</h1>

<div class="tiles">
  <div class="tile">
    <span class="label">Total estimated value</span>
    <span class="figure">{formatCents(data.totalValue)}</span>
    {#if delta !== 0}
      <span class="delta" class:up={delta > 0} class:down={delta < 0}>
        {delta > 0 ? '+' : '−'}{formatCents(Math.abs(delta))} from re-priced games
      </span>
    {/if}
  </div>
  <div class="tile">
    <span class="label">Items</span>
    <span class="figure">{data.itemCount}</span>
    {#if data.unvaluedCount > 0}
      <span class="delta">{data.unvaluedCount} without an estimate</span>
    {/if}
  </div>
</div>

<section class="card">
  <h2>By console</h2>
  <ConsoleBar byConsole={data.byConsole} />
</section>

<section class="card">
  <h2>Top movers</h2>
  <MoversPanel movers={data.movers} />
</section>

<p class="dim foot">Values are estimates from current eBay active listings, not sold-price data.</p>

<style>
  h1 { font-size: var(--fs-xl); margin-bottom: var(--space-4); }
  h2 { font-size: var(--fs-lg); margin-bottom: var(--space-3); }
  .tiles { display: grid; grid-template-columns: 1fr 1fr; gap: var(--space-3); margin-bottom: var(--space-3); }
  .tile, .card {
    background: var(--surface); border: 1px solid var(--border);
    border-radius: var(--radius); padding: var(--space-4);
  }
  .card { margin-bottom: var(--space-3); }
  .label { color: var(--text-dim); font-size: var(--fs-sm); text-transform: uppercase; }
  .figure { display: block; font-size: var(--fs-xl); color: var(--accent-warm); font-family: var(--mono); margin-top: var(--space-1); }
  .delta { font-size: var(--fs-sm); color: var(--text-dim); }
  .delta.up { color: var(--positive); }
  .delta.down { color: var(--negative); }
  .dim { color: var(--text-dim); }
  .foot { font-size: var(--fs-sm); margin-top: var(--space-3); }
</style>
