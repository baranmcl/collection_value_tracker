<script lang="ts">
  import { formatCents } from '$lib/money';

  let { byConsole }: {
    byConsole: { console: string; count: number; value: number }[];
  } = $props();

  const palette = ['#3dd9d6', '#f0a830', '#8b7ff0', '#4caf78', '#e0644b', '#5b9bd5'];
  let total = $derived(byConsole.reduce((s, c) => s + c.value, 0));
</script>

{#if byConsole.length === 0}
  <p class="dim">No items yet.</p>
{:else}
  {#if total > 0}
    <div class="bar">
      {#each byConsole as c, i}
        {#if c.value > 0}
          <div
            class="seg"
            data-testid={`seg-${c.console}`}
            style:width={`${(c.value / total) * 100}%`}
            style:background={palette[i % palette.length]}
          ></div>
        {/if}
      {/each}
    </div>
  {/if}
  <ul class="legend">
    {#each byConsole as c, i}
      <li>
        <span class="dot" style:background={palette[i % palette.length]}></span>
        <span class="name">{c.console}</span>
        <span class="count">{c.count} {c.count === 1 ? 'item' : 'items'}</span>
        {#if c.value > 0}<span class="value">{formatCents(c.value)}</span>{/if}
      </li>
    {/each}
  </ul>
{/if}

<style>
  .bar { display: flex; height: 28px; border-radius: var(--radius); overflow: hidden; }
  .seg { min-width: 2px; }
  .legend { display: grid; gap: var(--space-1); list-style: none; margin-top: var(--space-3); }
  .legend li {
    display: flex; align-items: baseline; gap: var(--space-2);
    font-size: var(--fs-sm); color: var(--text-dim);
  }
  .dot { width: 10px; height: 10px; border-radius: 2px; flex-shrink: 0; align-self: center; }
  .name { color: var(--text); min-width: 140px; }
  .count { font-family: var(--mono); }
  .value { margin-left: auto; font-family: var(--mono); color: var(--accent-warm); }
  .dim { color: var(--text-dim); }
</style>
