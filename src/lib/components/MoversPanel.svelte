<script lang="ts">
  import { formatCents } from '$lib/money';
  import { CONDITION_LABELS } from '$lib/types';
  import type { Condition } from '$lib/types';

  let { movers }: {
    movers: { gameId: number; title: string; condition: string;
      previous: number; current: number; delta: number }[];
  } = $props();
</script>

{#if movers.length === 0}
  <p class="dim">No movement yet — need at least two refreshes to compare.</p>
{:else}
  <ul>
    {#each movers as m}
      <li>
        <span class="title">{m.title}
          <small>{CONDITION_LABELS[m.condition as Condition]}</small></span>
        <span class="prices">{formatCents(m.previous)} → {formatCents(m.current)}</span>
        <span class="delta" class:up={m.delta > 0} class:down={m.delta < 0}>
          {m.delta > 0 ? '+' : '−'}{formatCents(Math.abs(m.delta))}
        </span>
      </li>
    {/each}
  </ul>
{/if}

<style>
  ul { list-style: none; }
  li {
    display: grid; grid-template-columns: 2fr 1.5fr 1fr; gap: var(--space-2);
    align-items: center; padding: var(--space-2) 0; border-bottom: 1px solid var(--border);
  }
  li:last-child { border-bottom: none; }
  .title small { color: var(--text-dim); margin-left: var(--space-1); }
  .prices { font-family: var(--mono); font-size: var(--fs-sm); color: var(--text-dim); }
  .delta { text-align: right; font-family: var(--mono); }
  .delta.up { color: var(--positive); }
  .delta.down { color: var(--negative); }
  .dim { color: var(--text-dim); }
</style>
