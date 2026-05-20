<script lang="ts">
  import { untrack } from 'svelte';
  import type { PageData } from './$types';
  let { data }: { data: PageData } = $props();
  let syncing = $state(false);
  let refreshing = $state(false);
  let message = $state('');

  // Consoles to sync — all selected by default. `untrack` snapshots the
  // initial platform list; the set is user-controlled from here on.
  const selected = $state(untrack(() => new Set(data.platforms.map((p) => p.thegamesdbId))));

  function toggle(id: number) {
    if (selected.has(id)) selected.delete(id);
    else selected.add(id);
  }

  async function syncCatalog() {
    syncing = true;
    message = '';
    try {
      const res = await fetch('/api/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ platformIds: [...selected] })
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.message ?? 'failed');
      location.reload();
    } catch (e) {
      message = e instanceof Error ? e.message : 'error';
    } finally {
      syncing = false;
    }
  }

  async function run(url: string, setBusy: (b: boolean) => void) {
    setBusy(true);
    message = '';
    try {
      const res = await fetch(url, { method: 'POST' });
      const body = await res.json();
      if (!res.ok) throw new Error(body.message ?? 'failed');
      message = JSON.stringify(body);
      location.reload();
    } catch (e) {
      message = e instanceof Error ? e.message : 'error';
    } finally {
      setBusy(false);
    }
  }
</script>

<h1>Settings</h1>

<section class="card">
  <h2>Catalog</h2>
  <p><strong>{data.gameCount}</strong> games loaded.
    {#if data.lastSyncedAt}Last synced {data.lastSyncedAt.toLocaleString()}.{/if}</p>

  <fieldset class="consoles">
    <legend>Consoles to sync</legend>
    {#each data.platforms as p}
      <label>
        <input
          type="checkbox"
          checked={selected.has(p.thegamesdbId)}
          onchange={() => toggle(p.thegamesdbId)}
        />
        {p.name}
      </label>
    {/each}
  </fieldset>

  <button onclick={syncCatalog} disabled={syncing || selected.size === 0}>
    {syncing ? 'Syncing…' : 'Sync catalog'}
  </button>
  {#if selected.size === 0}<span class="hint">Pick at least one console.</span>{/if}
</section>

<section class="card">
  <h2>Prices</h2>
  <p>{data.ownedItemCount} owned items.
    {#if data.lastRefreshAt}Last refreshed {data.lastRefreshAt.toLocaleString()}.{/if}</p>
  <button onclick={() => run('/api/refresh', (b) => (refreshing = b))} disabled={refreshing}>
    {refreshing ? 'Refreshing…' : 'Refresh estimates'}
  </button>
</section>

<section class="card">
  <h2>Credentials</h2>
  <p class:ok={data.credentials.thegamesdb} class:bad={!data.credentials.thegamesdb}>
    TheGamesDB API key: {data.credentials.thegamesdb ? 'configured' : 'missing'}
  </p>
  <p class:ok={data.credentials.ebay} class:bad={!data.credentials.ebay}>
    eBay credentials: {data.credentials.ebay ? 'configured' : 'missing — set EBAY_APP_ID and EBAY_CLIENT_SECRET in .env'}
  </p>
</section>

<section class="card">
  <h2>Recent refreshes</h2>
  {#if data.refreshHistory.length === 0}
    <p class="dim">No refreshes yet.</p>
  {:else}
    <ul>
      {#each data.refreshHistory as e}
        <li>{e.triggeredAt.toLocaleString()} — {e.itemsUpdated} updated, {e.errors} errors</li>
      {/each}
    </ul>
  {/if}
</section>

{#if message}<p class="message">{message}</p>{/if}

<p class="dim footnote">
  Database lives at <code>data/collection.db</code> — back it up by copying that file.
  Nothing is sent anywhere except external price and catalog APIs.
</p>

<style>
  h1 { font-size: var(--fs-xl); margin-bottom: var(--space-4); }
  h2 { font-size: var(--fs-lg); margin-bottom: var(--space-2); }
  .card {
    background: var(--surface); border: 1px solid var(--border);
    border-radius: var(--radius); padding: var(--space-4); margin-bottom: var(--space-3);
  }
  .consoles {
    margin-top: var(--space-3); border: 1px solid var(--border);
    border-radius: var(--radius); padding: var(--space-2) var(--space-3);
    display: flex; flex-wrap: wrap; gap: var(--space-3);
  }
  .consoles legend { color: var(--text-dim); font-size: var(--fs-sm); padding: 0 var(--space-1); }
  .consoles label { display: flex; align-items: center; gap: var(--space-1); font-size: var(--fs-sm); }
  .consoles input { accent-color: var(--accent); }
  button {
    margin-top: var(--space-3); background: var(--accent); color: var(--bg);
    border: none; border-radius: var(--radius); padding: var(--space-2) var(--space-3); font-weight: 600;
  }
  button:disabled { opacity: 0.5; cursor: default; }
  .hint { margin-left: var(--space-2); font-size: var(--fs-sm); color: var(--text-dim); }
  .ok { color: var(--positive); }
  .bad { color: var(--negative); }
  .dim { color: var(--text-dim); }
  .footnote { margin-top: var(--space-4); font-size: var(--fs-sm); }
  .message { margin-top: var(--space-3); font-family: var(--mono); font-size: var(--fs-sm); }
  ul { list-style: none; }
  code { font-family: var(--mono); }
</style>
