<script lang="ts">
  import type { PageData } from './$types';
  import { CONDITIONS, CONDITION_LABELS } from '$lib/types';
  import ConsoleSidebar from '$lib/components/ConsoleSidebar.svelte';
  import ConditionButton from '$lib/components/ConditionButton.svelte';
  import { CONSOLE_RELEASE_YEAR } from '$lib/sources/platforms';
  let { data }: { data: PageData } = $props();

  type Show = 'all' | 'owned' | 'unowned' | 'loose' | 'cib' | 'new';
  // "Likely homebrew" = a release year that can't belong to a commercial
  // game: dated >= 2010 (no console here had official releases that late),
  // or dated before the console itself launched (placeholder/epoch dates).
  // Games with no known year are never hidden.
  const HOMEBREW_YEAR = 2010;

  let filter = $state('');
  let show = $state<Show>('all');
  let hideHomebrew = $state(true);

  // The selected console's launch year, if known — anything dated earlier
  // is impossible and treated as homebrew/bad data.
  let consoleStart = $derived(CONSOLE_RELEASE_YEAR[data.selectedConsole] ?? null);

  // Strip diacritics so a search for "pokemon" also matches "Pokémon".
  // Official Pokémon titles use an accented "é"; without folding, a plain
  // ASCII search would silently miss every one of them.
  const fold = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

  // Client-side filtering — the console's full game list is already loaded,
  // so this is instant with no round-trip.
  let visibleGames = $derived(
    data.games
      .filter((game) => {
        const q = fold(filter.trim());
        if (q && !fold(game.title).includes(q)) return false;

        if (hideHomebrew && game.releaseYear !== null) {
          // Too modern to be commercial, or older than the console itself.
          if (game.releaseYear >= HOMEBREW_YEAR) return false;
          if (consoleStart !== null && game.releaseYear < consoleStart) return false;
        }

        const owned = game.ownedConditions.length > 0;
        if (show === 'owned') return owned;
        if (show === 'unowned') return !owned;
        if (show === 'loose' || show === 'cib' || show === 'new') {
          return game.ownedConditions.includes(show);
        }
        return true; // 'all'
      })
      // Accent-aware sort: "Pokémon Ruby" lands next to "Pokemon Rubino"
      // instead of after the entire rest of the alphabet.
      .toSorted((a, b) => a.title.localeCompare(b.title))
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
        Hide likely homebrew
      </label>
      <span class="match-count">{visibleGames.length} of {data.games.length}</span>
    </div>

    <div class="row header">
      <span></span>
      <span>Title</span>
      {#each CONDITIONS as c}<span class="cond">{CONDITION_LABELS[c]}</span>{/each}
    </div>

    {#each visibleGames as game (game.id)}
      <div class="row">
        <span class="art">
          {#if game.boxartUrl}
            <img src={game.boxartUrl} alt="" loading="lazy" />
          {:else}
            <span class="noart" aria-hidden="true"></span>
          {/if}
        </span>
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
    display: grid; grid-template-columns: 44px 1fr 90px 90px 90px;
    gap: var(--space-2); align-items: center;
    padding: var(--space-2) var(--space-3); border-bottom: 1px solid var(--border);
  }
  .row.header { color: var(--text-dim); font-size: var(--fs-sm); text-transform: uppercase; }
  .art { display: flex; align-items: center; justify-content: center; }
  .art img {
    width: 36px; height: auto; max-height: 50px;
    border-radius: 2px; display: block;
  }
  .noart {
    width: 36px; height: 36px; border-radius: 2px;
    background: var(--surface-2); border: 1px solid var(--border);
  }
  .cond { text-align: right; font-family: var(--mono); }
  .title em { color: var(--text-dim); font-style: italic; }
  .empty { color: var(--text-dim); margin-top: var(--space-4); }
</style>
