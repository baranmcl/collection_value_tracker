<script lang="ts">
  import type { PageData } from './$types';
  import { formatCents } from '$lib/money';
  import { CONDITION_LABELS } from '$lib/types';
  import type { Condition } from '$lib/types';
  import ItemEditor from '$lib/components/ItemEditor.svelte';

  let { data }: { data: PageData } = $props();

  type SortKey = 'title' | 'console' | 'value';
  let sortKey = $state<SortKey>('title');
  let filter = $state('');
  let editingId = $state<number | null>(null);

  let visible = $derived(
    data.items
      .filter((i) => i.title.toLowerCase().includes(filter.toLowerCase()))
      .toSorted((a, b) => {
        if (sortKey === 'value') return (b.value ?? 0) - (a.value ?? 0);
        return a[sortKey].localeCompare(b[sortKey]);
      })
  );
</script>

<h1>My Collection</h1>

<div class="summary">
  <span>Total <strong class="val">{formatCents(data.totalValue)}</strong></span>
  <span>Items <strong>{data.items.length}</strong></span>
  <span>Average <strong class="val">{formatCents(data.averageValue)}</strong></span>
</div>

<div class="controls">
  <input placeholder="Filter by title…" bind:value={filter} />
  <label>Sort
    <select bind:value={sortKey}>
      <option value="title">Title</option>
      <option value="console">Console</option>
      <option value="value">Value</option>
    </select>
  </label>
</div>

<div class="row header">
  <span>Title</span><span>Console</span><span>Condition</span><span>Grade</span>
  <span class="num">Value</span><span></span>
</div>

{#each visible as item (item.id)}
  <div class="row">
    <span class="title">{item.title}
      {#if item.notes}<em>— {item.notes}</em>{/if}</span>
    <span>{item.console}</span>
    <span class="badge">{CONDITION_LABELS[item.condition as Condition]}</span>
    <span>{item.grade ?? '—'}</span>
    <span class="num val">
      {formatCents(item.value)}
      <small data-testid={`value-source-${item.id}`} class="src">{item.valueSource}</small>
    </span>
    <button class="menu" onclick={() => (editingId = editingId === item.id ? null : item.id)}>⋯</button>
  </div>
  {#if editingId === item.id}
    <ItemEditor item={item} onclose={() => (editingId = null)} />
  {/if}
{/each}

{#if data.items.length === 0}
  <p class="empty">No items yet. Add games from the <a href="/browse">Browse</a> screen.</p>
{/if}

<style>
  h1 { font-size: var(--fs-xl); margin-bottom: var(--space-3); }
  .summary { display: flex; gap: var(--space-4); margin-bottom: var(--space-3); color: var(--text-dim); }
  .summary .val { color: var(--accent-warm); }
  .controls { display: flex; gap: var(--space-3); margin-bottom: var(--space-3); }
  input, select {
    background: var(--surface-2); border: 1px solid var(--border); color: var(--text);
    border-radius: var(--radius); padding: var(--space-2);
  }
  .row {
    display: grid; grid-template-columns: 2fr 1fr 1fr 1fr 1.2fr 40px;
    gap: var(--space-2); align-items: center;
    padding: var(--space-2) var(--space-3); border-bottom: 1px solid var(--border);
  }
  .row.header { color: var(--text-dim); font-size: var(--fs-sm); text-transform: uppercase; }
  .num { text-align: right; font-family: var(--mono); }
  .val { color: var(--accent-warm); }
  .src { display: block; font-size: 10px; color: var(--text-dim); text-transform: uppercase; }
  .badge {
    justify-self: start; background: var(--surface-2); border: 1px solid var(--border);
    border-radius: var(--radius); padding: 1px var(--space-2); font-size: var(--fs-sm);
  }
  .title em { color: var(--text-dim); font-style: italic; }
  .menu { background: transparent; border: none; color: var(--text-dim); font-size: var(--fs-lg); }
  .empty { color: var(--text-dim); margin-top: var(--space-4); }
  .empty a { color: var(--accent); }
</style>
