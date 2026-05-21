<script lang="ts">
  import type { RefreshProgress } from '$lib/sources/refresh';

  let { progress }: { progress: RefreshProgress } = $props();

  let pct = $derived(progress.total > 0 ? Math.round((progress.done / progress.total) * 100) : 0);
</script>

<div class="wrap">
  <div class="track">
    <div class="fill" data-testid="progress-fill" style="width: {pct}%"></div>
  </div>
  <p class="label">Pricing {progress.current}… — {progress.done} / {progress.total}</p>
</div>

<style>
  .wrap { margin-top: var(--space-3); }
  .track {
    height: 8px; background: var(--surface-2); border: 1px solid var(--border);
    border-radius: var(--radius); overflow: hidden;
  }
  .fill { height: 100%; background: var(--accent); transition: width 120ms linear; }
  .label { margin-top: var(--space-1); font-size: var(--fs-sm); color: var(--text-dim); }
</style>
