<script lang="ts">
  let { byConsole }: { byConsole: { console: string; value: number }[] } = $props();
  const palette = ['#3dd9d6', '#f0a830', '#8b7ff0', '#4caf78', '#e0644b', '#5b9bd5'];
  let total = $derived(byConsole.reduce((s, c) => s + c.value, 0));
</script>

{#if total === 0}
  <p class="dim">No value to break down yet.</p>
{:else}
  <div class="bar">
    {#each byConsole as c, i}
      <div
        class="seg"
        data-testid={`seg-${c.console}`}
        style:width={`${(c.value / total) * 100}%`}
        style:background={palette[i % palette.length]}
      ></div>
    {/each}
  </div>
  <ul class="legend">
    {#each byConsole as c, i}
      <li>
        <span class="dot" style:background={palette[i % palette.length]}></span>
        {c.console}
      </li>
    {/each}
  </ul>
{/if}

<style>
  .bar { display: flex; height: 28px; border-radius: var(--radius); overflow: hidden; }
  .seg { min-width: 2px; }
  .legend { display: flex; flex-wrap: wrap; gap: var(--space-3); list-style: none; margin-top: var(--space-2); }
  .legend li { display: flex; align-items: center; gap: var(--space-1); font-size: var(--fs-sm); color: var(--text-dim); }
  .dot { width: 10px; height: 10px; border-radius: 2px; display: inline-block; }
  .dim { color: var(--text-dim); }
</style>
