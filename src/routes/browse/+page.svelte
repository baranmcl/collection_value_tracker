<script lang="ts">
  import type { PageData } from './$types';
  import { CONDITIONS, CONDITION_LABELS } from '$lib/types';
  import ConsoleSidebar from '$lib/components/ConsoleSidebar.svelte';
  import ConditionButton from '$lib/components/ConditionButton.svelte';
  let { data }: { data: PageData } = $props();

  type Show = 'all' | 'owned' | 'unowned' | 'loose' | 'cib' | 'new';
  // No commercial GameCube / N64 / Game Boy game shipped this year or later,
  // so a catalog entry dated >= this is homebrew/fan-made with near-total
  // confidence. Games with no known year are never hidden.
  const HOMEBREW_YEAR = 2010;

  let filter = $state('');
  let show = $state<Show>('all');
  let hideHomebrew = $state(true);

  // Client-side filtering — the console's full game list is already loaded,
  // so this is instant with no round-trip.
  let visibleGames = $derived(
    data.games.filter((game) => {
      const q = filter.trim().toLowerCase();
      if (q && !game.title.toLowerCase().includes(q)) return false;

      if (hideHomebrew && game.releaseYear !== null && game.releaseYear >= HOMEBREW_YEAR) {
        return false;
      }

      const owned = game.ownedConditions.length > 0;
      if (show === 'owned') return owned;
      if (show === 'unowned') return !owned;
      if (show === 'loose' || show === 'cib' || show === 'new') {
        return game.ownedConditions.includes(show);
      }
      return true; // 'all'
    })
  );
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
        bind:value={filter}
      />
      <label>
        Show
        <select bind:value={show}>
          <option value="all">All games</option>
          <option value="owned">Owned — any</option>
          <option value="loose">Owned — Loose</option>
          <option value="cib">Owned — CIB</option>
          <option value="new">Owned — New</option>
          <option value="unowned">Not owned</option>
        </select>
      </label>
      <label class="check">
        <input type="checkbox" bind:checked={hideHomebrew} />
        Hide likely homebrew ({HOMEBREW_YEAR}+)
      </label>
      <span class="match-count">{visibleGames.length} of {data.games.length}</span>
    </div>

    <div class="row header">
      <span>Title</span>
      {#each CONDITIONS as c}<span class="cond">{CONDITION_LABELS[c]}</span>{/each}
    </div>

    {#each visibleGames as game (game.id)}
      <div class="row">
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

    {#if visibleGames.length === 0}
      <p class="empty">No games match the current filters.</p>
    {/if}
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
  .match-count { color: var(--text-dim); font-size: var(--fs-sm); font-family: var(--mono); }
  .row {
    display: grid; grid-template-columns: 1fr 90px 90px 90px;
    gap: var(--space-2); align-items: center;
    padding: var(--space-2) var(--space-3); border-bottom: 1px solid var(--border);
  }
  .row.header { color: var(--text-dim); font-size: var(--fs-sm); text-transform: uppercase; }
  .cond { text-align: right; font-family: var(--mono); }
  .title em { color: var(--text-dim); font-style: italic; }
  .empty { color: var(--text-dim); margin-top: var(--space-4); }
</style>
