<script lang="ts">
  import { GRADES } from '$lib/types';
  import { invalidateAll } from '$app/navigation';
  import { untrack } from 'svelte';

  let { item, onclose }: {
    item: {
      id: number; gameId: number; title: string; condition: string;
      grade: string | null; notes: string | null;
      acquiredAt: string | null; manualPrice: number | null;
    };
    onclose: () => void;
  } = $props();

  let grade = $state(untrack(() => item.grade ?? ''));
  let notes = $state(untrack(() => item.notes ?? ''));
  let acquiredAt = $state(untrack(() => item.acquiredAt ?? ''));
  let manualPriceInput = $state(untrack(() => item.manualPrice !== null ? (item.manualPrice / 100).toFixed(2) : ''));
  let busy = $state(false);

  async function withBusy(fn: () => Promise<void>) {
    busy = true;
    try {
      await fn();
      await invalidateAll();
      onclose();
    } finally {
      busy = false;
    }
  }

  const save = () =>
    withBusy(async () => {
      await fetch(`/api/collection/${item.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ grade: grade || null, notes: notes || null,
          acquiredAt: acquiredAt || null, manualPriceInput })
      });
    });

  const remove = () =>
    withBusy(async () => {
      await fetch('/api/collection', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ itemId: item.id })
      });
    });

  const addAnother = () =>
    withBusy(async () => {
      await fetch('/api/collection', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ gameId: item.gameId, condition: item.condition })
      });
    });
</script>

<div class="editor">
  <h3>{item.title} <span class="dim">· {item.condition}</span></h3>

  <label>Grade
    <select bind:value={grade}>
      <option value="">—</option>
      {#each GRADES as g}<option value={g}>{g}</option>{/each}
    </select>
  </label>

  <label>Acquired date
    <input type="date" bind:value={acquiredAt} />
  </label>

  <label>Manual price (overrides the estimate)
    <input type="text" inputmode="decimal" placeholder="e.g. 49.99" bind:value={manualPriceInput} />
  </label>

  <label>Notes
    <textarea bind:value={notes} rows="2"></textarea>
  </label>

  <div class="actions">
    <button onclick={save} disabled={busy}>{busy ? 'Working…' : 'Save'}</button>
    <button class="ghost" onclick={addAnother} disabled={busy}>Add another copy</button>
    <button class="danger" onclick={remove} disabled={busy}>Remove</button>
    <button class="ghost" onclick={onclose} disabled={busy}>Cancel</button>
  </div>
</div>

<style>
  .editor {
    background: var(--surface); border: 1px solid var(--border);
    border-radius: var(--radius); padding: var(--space-4); display: grid; gap: var(--space-3);
  }
  h3 { font-size: var(--fs-lg); }
  .dim { color: var(--text-dim); }
  label { display: grid; gap: var(--space-1); font-size: var(--fs-sm); color: var(--text-dim); }
  input, select, textarea {
    background: var(--surface-2); border: 1px solid var(--border); color: var(--text);
    border-radius: var(--radius); padding: var(--space-2); font-family: inherit; font-size: var(--fs-base);
  }
  .actions { display: flex; flex-wrap: wrap; gap: var(--space-2); }
  button { background: var(--accent); color: var(--bg); border: none;
    border-radius: var(--radius); padding: var(--space-2) var(--space-3); font-weight: 600; }
  button:disabled { opacity: 0.5; cursor: default; }
  button.ghost { background: transparent; color: var(--text-dim); border: 1px solid var(--border); }
  button.danger { background: transparent; color: var(--negative); border: 1px solid var(--negative); }
</style>
