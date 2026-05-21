<script lang="ts">
  import type { PageData } from './$types';
  import { formatCents } from '$lib/money';
  import { CONDITION_LABELS, CONDITIONS, GRADES } from '$lib/types';
  import { isLowConfidence } from '$lib/estimate-quality';
  import type { Condition, Grade } from '$lib/types';
  import ItemEditor from '$lib/components/ItemEditor.svelte';
  import GameThumb from '$lib/components/GameThumb.svelte';

  let { data }: { data: PageData } = $props();

  type CollectionItem = PageData['items'][number];
  type SortKey = 'title' | 'console' | 'condition' | 'grade' | 'value';

  let sortKey = $state<SortKey>('title');
  let sortDir = $state<'asc' | 'desc'>('asc');
  let filter = $state('');
  let consoleFilter = $state('');
  let editingId = $state<number | null>(null);

  // Consoles present in the collection, for the filter dropdown.
  let consoles = $derived(
    [...new Set(data.items.map((i) => i.console))].sort((a, b) => a.localeCompare(b))
  );

  // Click a header: toggle direction if already sorting by it, else switch to
  // it (value defaults to highest-first, the rest to A→Z / lowest-first).
  function sortBy(key: SortKey) {
    if (sortKey === key) {
      sortDir = sortDir === 'asc' ? 'desc' : 'asc';
    } else {
      sortKey = key;
      sortDir = key === 'value' ? 'desc' : 'asc';
    }
  }

  function indicator(key: SortKey): string {
    if (sortKey !== key) return '';
    return sortDir === 'asc' ? ' ▲' : ' ▼';
  }

  /** Ascending comparison for the active sort key. Condition and grade sort
   *  by their domain order, not alphabetically; blank grades sort last. */
  function compare(a: CollectionItem, b: CollectionItem): number {
    switch (sortKey) {
      case 'title':
      case 'console':
        return a[sortKey].localeCompare(b[sortKey]);
      case 'condition':
        return CONDITIONS.indexOf(a.condition as Condition) - CONDITIONS.indexOf(b.condition as Condition);
      case 'grade': {
        const rank = (g: string | null) => (g ? GRADES.indexOf(g as Grade) : GRADES.length);
        return rank(a.grade) - rank(b.grade);
      }
      case 'value':
        return (a.value ?? 0) - (b.value ?? 0);
    }
  }

  let visible = $derived(
    data.items
      .filter((i) => i.title.toLowerCase().includes(filter.toLowerCase()))
      .filter((i) => consoleFilter === '' || i.console === consoleFilter)
      .toSorted((a, b) => (sortDir === 'asc' ? compare(a, b) : -compare(a, b)))
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
  <label>Console
    <select bind:value={consoleFilter}>
      <option value="">All consoles</option>
      {#each consoles as c}<option value={c}>{c}</option>{/each}
    </select>
  </label>
  <a class="export" href="/api/export" download>Export CSV</a>
</div>

<div class="row header">
  <span></span>
  <button class="sort" onclick={() => sortBy('title')}>Title{indicator('title')}</button>
  <button class="sort" onclick={() => sortBy('console')}>Console{indicator('console')}</button>
  <button class="sort" onclick={() => sortBy('condition')}>Condition{indicator('condition')}</button>
  <button class="sort" onclick={() => sortBy('grade')}>Grade{indicator('grade')}</button>
  <button class="sort right" onclick={() => sortBy('value')}>Value{indicator('value')}</button>
  <span></span>
</div>

{#each visible as item (item.id)}
  <div class="row">
    <GameThumb url={item.boxartUrl} />
    <span class="title">{item.title}
      {#if item.notes}<em>— {item.notes}</em>{/if}</span>
    <span>{item.console}</span>
    <span class="badge">{CONDITION_LABELS[item.condition as Condition]}</span>
    <span>{item.grade ?? '—'}</span>
    <span class="num val">
      {formatCents(item.value)}
      <small data-testid={`value-source-${item.id}`} class="src">{item.valueSource}</small>
      {#if item.estimateAge}
        <small class="age" class:stale={item.estimateStale}>est. {item.estimateAge}</small>
      {/if}
      {#if item.listingCount !== null && isLowConfidence(item.listingCount)}
        <small class="lowconf">⚠ {item.listingCount} {item.listingCount === 1 ? 'listing' : 'listings'}</small>
      {/if}
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
  .export {
    margin-left: auto; align-self: center;
    background: var(--surface-2); border: 1px solid var(--border); color: var(--text);
    border-radius: var(--radius); padding: var(--space-2) var(--space-3);
    font-size: var(--fs-sm); text-decoration: none;
  }
  .row {
    display: grid; grid-template-columns: 44px 2fr 1fr 1fr 1fr 1.2fr 40px;
    gap: var(--space-2); align-items: center;
    padding: var(--space-2) var(--space-3); border-bottom: 1px solid var(--border);
  }
  .row.header { color: var(--text-dim); font-size: var(--fs-sm); text-transform: uppercase; }
  .sort {
    background: transparent; border: none; color: inherit;
    font: inherit; text-transform: inherit; letter-spacing: inherit;
    padding: 0; text-align: left; cursor: pointer;
  }
  .sort:hover { color: var(--text); }
  .sort.right { text-align: right; }
  .num { text-align: right; font-family: var(--mono); }
  .val { color: var(--accent-warm); }
  .src { display: block; font-size: 10px; color: var(--text-dim); text-transform: uppercase; }
  .age { display: block; font-size: 10px; color: var(--text-dim); }
  .age.stale { color: var(--accent-warm); }
  .lowconf { display: block; font-size: 10px; color: var(--accent-warm); }
  .badge {
    justify-self: start; background: var(--surface-2); border: 1px solid var(--border);
    border-radius: var(--radius); padding: 1px var(--space-2); font-size: var(--fs-sm);
  }
  .title em { color: var(--text-dim); font-style: italic; }
  .menu { background: transparent; border: none; color: var(--text-dim); font-size: var(--fs-lg); }
  .empty { color: var(--text-dim); margin-top: var(--space-4); }
  .empty a { color: var(--accent); }
</style>
