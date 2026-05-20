<script lang="ts">
  import type { PageData } from './$types';
  import { CONDITIONS, CONDITION_LABELS } from '$lib/types';
  import ConsoleSidebar from '$lib/components/ConsoleSidebar.svelte';
  import ConditionButton from '$lib/components/ConditionButton.svelte';
  let { data }: { data: PageData } = $props();
</script>

<div class="browse">
  <ConsoleSidebar consoles={data.consoles} selected={data.selectedConsole} />

  <div class="list">
    <h1>{data.selectedConsole}</h1>
    <div class="row header">
      <span>Title</span>
      {#each CONDITIONS as c}<span class="cond">{CONDITION_LABELS[c]}</span>{/each}
    </div>
    {#each data.games as game}
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
  </div>
</div>

<style>
  .browse { display: flex; gap: var(--space-4); }
  .list { flex: 1; }
  h1 { font-size: var(--fs-xl); margin-bottom: var(--space-3); }
  .row {
    display: grid; grid-template-columns: 1fr 90px 90px 90px;
    gap: var(--space-2); align-items: center;
    padding: var(--space-2) var(--space-3); border-bottom: 1px solid var(--border);
  }
  .row.header { color: var(--text-dim); font-size: var(--fs-sm); text-transform: uppercase; }
  .cond { text-align: right; font-family: var(--mono); }
  .title em { color: var(--text-dim); font-style: italic; }
</style>
