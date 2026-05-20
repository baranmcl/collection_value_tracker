<script lang="ts">
  let { pathname }: { pathname: string } = $props();
  const links = [
    { href: '/', name: 'Dashboard' },
    { href: '/browse', name: 'Browse' },
    { href: '/collection', name: 'Collection' },
    { href: '/settings', name: 'Settings' }
  ];
</script>

<nav>
  <span class="brand">Collection Value Tracker</span>
  <ul>
    {#each links as link}
      <li><a href={link.href} class:active={pathname === link.href}>{link.name}</a></li>
    {/each}
  </ul>
</nav>

<style>
  nav {
    display: flex; align-items: center; gap: var(--space-5);
    padding: var(--space-3) var(--space-4);
    background: var(--surface); border-bottom: 1px solid var(--border);
  }
  .brand { font-weight: 600; letter-spacing: -0.01em; }
  ul { display: flex; gap: var(--space-3); list-style: none; }
  nav a { color: var(--text-dim); padding: var(--space-1) var(--space-2); border-radius: var(--radius); }
  nav a.active { color: var(--accent); }
  nav a:hover { color: var(--text); }
</style>
