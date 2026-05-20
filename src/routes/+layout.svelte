<script lang="ts">
  import '@fontsource/inter';
  import '@fontsource/jetbrains-mono';
  import '../app.css';
  import { page } from '$app/state';
  import Nav from '$lib/components/Nav.svelte';
  let { children } = $props();
</script>

<div class="app">
  <Nav pathname={page.url.pathname} />
  <main>{@render children()}</main>
</div>

<style>
  .app { min-height: 100%; }
  main { padding: var(--space-4); max-width: 1100px; margin: 0 auto; }
</style>
