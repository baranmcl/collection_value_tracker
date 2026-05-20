<script lang="ts">
  import { formatCents } from '$lib/money';
  import { invalidateAll } from '$app/navigation';
  import { untrack } from 'svelte';
  import type { Condition } from '$lib/types';

  let { gameId, condition, owned, estimate }: {
    gameId: number;
    condition: Condition;
    owned: boolean;
    estimate: number | null;
  } = $props();

  let pending = $state(false);
  // owned is intentionally captured once as initial state; untrack avoids the compiler warning
  let isOwned: boolean = $state(untrack(() => owned));
  let failed = $state(false);

  async function toggle() {
    pending = true;
    failed = false;
    try {
      const res = isOwned
        ? await fetch('/api/collection/by-pair', {
            method: 'DELETE',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ gameId, condition })
          })
        : await fetch('/api/collection', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ gameId, condition })
          });
      if (!res.ok) {
        // The request failed — do NOT flip ownership; surface the failure.
        failed = true;
        return;
      }
      isOwned = !isOwned;
      await invalidateAll();
    } catch {
      failed = true;
    } finally {
      pending = false;
    }
  }
</script>

<button
  class="cond-btn"
  class:owned={isOwned}
  class:failed
  aria-busy={pending}
  disabled={pending}
  title={failed ? 'Request failed — click to retry' : ''}
  onclick={toggle}
>
  {#if pending}
    <span class="spin">…</span>
  {:else if isOwned}
    <span class="val">{estimate === null ? 'owned' : formatCents(estimate)}</span>
  {:else}
    <span class="add">+</span>
  {/if}
</button>

<style>
  .cond-btn {
    width: 100%; text-align: right; font-family: var(--mono); font-size: var(--fs-sm);
    background: var(--surface-2); color: var(--text-dim);
    border: 1px solid var(--border); border-radius: var(--radius);
    padding: var(--space-1) var(--space-2);
  }
  .cond-btn:hover:not(:disabled) { border-color: var(--accent); color: var(--text); }
  .cond-btn.owned { border-color: var(--accent-warm); color: var(--accent-warm); }
  .cond-btn.failed { border-color: var(--negative); color: var(--negative); }
  .cond-btn[aria-busy='true'] { opacity: 0.6; }
  .add { color: var(--accent); }
</style>
