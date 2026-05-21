<script lang="ts">
  import { untrack } from 'svelte';
  import type { PageData } from './$types';
  import type { RefreshResult, RefreshProgress } from '$lib/sources/refresh';
  import RefreshProgressBar from '$lib/components/RefreshProgressBar.svelte';
  let { data }: { data: PageData } = $props();
  let syncing = $state(false);
  let refreshing = $state(false);
  let message = $state('');
  let refreshProgress = $state<RefreshProgress | null>(null);

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

  function refreshMessage(r: RefreshResult): string {
    if (r.aborted) {
      const reason = (r.errorsByReason?.auth ?? 0) > 0 ? 'an authentication error' : 'a rate limit';
      return `Refresh aborted after ${reason} — ${r.itemsUpdated} estimate(s) changed before stopping.`;
    }
    if (r.errors > 0) {
      return `Refresh complete — ${r.itemsUpdated} changed, ${r.errors} failed.`;
    }
    return `Refresh complete — ${r.itemsUpdated} estimate(s) changed.`;
  }

  async function runRefresh() {
    refreshing = true;
    message = '';
    refreshProgress = null;
    try {
      const res = await fetch('/api/refresh', { method: 'POST' });
      if (!res.ok || !res.body) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.message ?? 'failed');
      }
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buf = '';
      let result: RefreshResult | null = null;
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        buf += decoder.decode(value, { stream: true });
        let nl: number;
        while ((nl = buf.indexOf('\n')) !== -1) {
          const raw = buf.slice(0, nl);
          buf = buf.slice(nl + 1);
          if (raw.length === 0) continue;
          const event = JSON.parse(raw);
          if (event.type === 'progress') {
            refreshProgress = { done: event.done, total: event.total, current: event.current };
          } else if (event.type === 'result') {
            result = event;
          }
        }
      }
      refreshProgress = null;
      if (!result) throw new Error('refresh ended without a result');
      // Clean run: reload so counts and history update. Failed/aborted run:
      // stay on the page and show the categorized message.
      if (result.aborted || result.errors > 0) {
        message = refreshMessage(result);
      } else {
        location.reload();
      }
    } catch (e) {
      refreshProgress = null;
      message = e instanceof Error ? e.message : 'error';
    } finally {
      refreshing = false;
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
  <button onclick={runRefresh} disabled={refreshing}>
    {refreshing ? 'Refreshing…' : 'Refresh estimates'}
  </button>
  {#if refreshProgress}
    <RefreshProgressBar progress={refreshProgress} />
  {/if}
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
        <li>
          {e.triggeredAt.toLocaleString()} — {e.itemsUpdated} updated, {e.errors} errors{#if e.errorSummary} — {e.errorSummary}{/if}
        </li>
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
