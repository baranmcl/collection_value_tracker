<script lang="ts">
  import type { PageData } from './$types';
  import { goto } from '$app/navigation';
  import { CONDITIONS, CONDITION_LABELS } from '$lib/types';
  import { untrack } from 'svelte';
  import ConsoleSidebar from '$lib/components/ConsoleSidebar.svelte';
  import ConditionButton from '$lib/components/ConditionButton.svelte';
  import GameThumb from '$lib/components/GameThumb.svelte';

  let { data }: { data: PageData } = $props();

  // untrack suppresses the "only captures initial value" warning — the $effect
  // below handles reactive re-sync whenever data.query changes from outside.
  let searchValue = $state(untrack(() => data.query));
  // Re-sync the box when the URL's query changes from outside (e.g. switching
  // console clears it). Reads data.query, not searchValue, so live typing
  // (which only changes searchValue) does not trigger or fight this.
  $effect(() => {
    searchValue = data.query;
  });

  let debounceTimer: ReturnType<typeof setTimeout>;

  /** Build a /browse URL from the current filters, applying overrides.
   *  A null override removes that param. */
  function browseUrl(overrides: Record<string, string | null>): string {
    const params = new URLSearchParams();
    params.set('console', data.selectedConsole);
    if (data.query) params.set('q', data.query);
    if (data.show !== 'all') params.set('show', data.show);
    if (!data.hideHomebrew) params.set('homebrew', 'show');
    if (data.page > 1) params.set('page', String(data.page));
    for (const [k, v] of Object.entries(overrides)) {
      if (v === null) params.delete(k);
      else params.set(k, v);
    }
    return `/browse?${params}`;
  }

  function onSearchInput(e: Event) {
    // Read the value off the event so the debounce does not depend on the
    // bind:value signal having flushed.
    const v = (e.currentTarget as HTMLInputElement).value;
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => {
      goto(browseUrl({ q: v.trim() || null, page: null }), {
        replaceState: true,
        keepFocus: true,
        noScroll: true
      });
    }, 250);
  }

  function onShowChange(e: Event) {
    const v = (e.currentTarget as HTMLSelectElement).value;
    goto(browseUrl({ show: v === 'all' ? null : v, page: null }));
  }

  function onHomebrewChange(e: Event) {
    const checked = (e.currentTarget as HTMLInputElement).checked;
    goto(browseUrl({ homebrew: checked ? null : 'show', page: null }));
  }

  let firstRow = $derived(data.totalCount === 0 ? 0 : (data.page - 1) * data.pageSize + 1);
  let lastRow = $derived(Math.min(data.page * data.pageSize, data.totalCount));
  let hasPrev = $derived(data.page > 1);
  let hasNext = $derived(data.page * data.pageSize < data.totalCount);
</script>

<div class="browse">
  <ConsoleSidebar consoles={data.consoles} selected={data.selectedConsole} />

  <div class="list">
    <h1>{data.selectedConsole}</h1>

    <div class="filters">
      <input
        class="search"
        type="search"
        placeholder="Filter by title…"
        bind:value={searchValue}
        oninput={onSearchInput}
      />
      <label>
        Show
        <select value={data.show} onchange={onShowChange}>
          <option value="all">All games</option>
          <option value="owned">Owned — any</option>
          <option value="loose">Owned — Loose</option>
          <option value="cib">Owned — CIB</option>
          <option value="new">Owned — New</option>
          <option value="unowned">Not owned</option>
        </select>
      </label>
      <label class="check">
        <input type="checkbox" checked={data.hideHomebrew} onchange={onHomebrewChange} />
        Hide likely homebrew
      </label>
    </div>

    <div class="row header">
      <span></span>
      <span>Title</span>
      {#each CONDITIONS as c}<span class="cond">{CONDITION_LABELS[c]}</span>{/each}
    </div>

    {#each data.games as game (game.id)}
      <div class="row">
        <GameThumb url={game.boxartUrl} />
        <span class="title">{game.title}
          {#if game.releaseYear}<em>({game.releaseYear})</em>{/if}</span>
        {#each CONDITIONS as c}
          <span class="cond">
            <ConditionButton
              gameId={game.id}
              condition={c}
              owned={game.ownedConditions.includes(c)}
              estimate={game.estimates[c]}
            />
          </span>
        {/each}
      </div>
    {/each}

    {#if data.games.length === 0}
      <p class="empty">No games match the current filters.</p>
    {/if}

    <div class="pager">
      <span class="count">
        {#if data.totalCount === 0}No games{:else}Showing {firstRow}–{lastRow} of {data.totalCount}{/if}
      </span>
      <button onclick={() => goto(browseUrl({ page: String(data.page - 1) }))} disabled={!hasPrev}>Prev</button>
      <button onclick={() => goto(browseUrl({ page: String(data.page + 1) }))} disabled={!hasNext}>Next</button>
    </div>
  </div>
</div>

<style>
  .browse { display: flex; gap: var(--space-4); }
  .list { flex: 1; }
  h1 { font-size: var(--fs-xl); margin-bottom: var(--space-3); }
  .filters {
    display: flex; align-items: center; gap: var(--space-3);
    margin-bottom: var(--space-3); flex-wrap: wrap;
  }
  .search {
    flex: 1; min-width: 180px;
    background: var(--surface-2); border: 1px solid var(--border); color: var(--text);
    border-radius: var(--radius); padding: var(--space-2) var(--space-3); font: inherit;
  }
  .filters label {
    display: flex; align-items: center; gap: var(--space-2);
    color: var(--text-dim); font-size: var(--fs-sm);
  }
  .filters select {
    background: var(--surface-2); border: 1px solid var(--border); color: var(--text);
    border-radius: var(--radius); padding: var(--space-2); font: inherit;
  }
  .filters .check { cursor: pointer; }
  .filters input[type='checkbox'] { accent-color: var(--accent); cursor: pointer; }
  .row {
    display: grid; grid-template-columns: 44px 1fr 90px 90px 90px;
    gap: var(--space-2); align-items: center;
    padding: var(--space-2) var(--space-3); border-bottom: 1px solid var(--border);
  }
  .row.header { color: var(--text-dim); font-size: var(--fs-sm); text-transform: uppercase; }
  .cond { text-align: right; font-family: var(--mono); }
  .title em { color: var(--text-dim); font-style: italic; }
  .empty { color: var(--text-dim); margin-top: var(--space-4); }
  .pager {
    display: flex; align-items: center; gap: var(--space-3);
    margin-top: var(--space-3); color: var(--text-dim); font-size: var(--fs-sm);
  }
  .pager .count { font-family: var(--mono); margin-right: auto; }
  .pager button {
    background: var(--surface-2); border: 1px solid var(--border); color: var(--text);
    border-radius: var(--radius); padding: var(--space-1) var(--space-3); font: inherit;
  }
  .pager button:disabled { opacity: 0.4; cursor: default; }
</style>
