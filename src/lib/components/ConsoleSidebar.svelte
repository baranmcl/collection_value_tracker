<script lang="ts">
  let { consoles, selected }: {
    consoles: { console: string; count: number }[];
    selected: string;
  } = $props();
</script>

<aside>
  <h2>Consoles</h2>
  <ul>
    {#each consoles as c}
      <li>
        <a href={`/browse?console=${encodeURIComponent(c.console)}`} class:active={c.console === selected}>
          <span>{c.console}</span><span class="count">{c.count}</span>
        </a>
      </li>
    {/each}
  </ul>
</aside>

<style>
  aside { width: 200px; flex-shrink: 0; }
  h2 { font-size: var(--fs-sm); text-transform: uppercase; color: var(--text-dim); margin-bottom: var(--space-2); }
  ul { list-style: none; }
  a {
    display: flex; justify-content: space-between; padding: var(--space-2);
    border-radius: var(--radius); color: var(--text-dim);
  }
  a:hover { background: var(--surface-2); color: var(--text); }
  a.active { background: var(--surface-2); color: var(--accent); }
  .count { font-family: var(--mono); font-size: var(--fs-sm); }
</style>
