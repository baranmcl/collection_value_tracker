<script lang="ts">
  /** Box-art thumbnail — pass the front-cover URL, or null for a placeholder. */
  let { url }: { url: string | null } = $props();
</script>

{#if url}
  <img class="thumb" src={url} alt="" loading="lazy" />
{:else}
  <span class="thumb placeholder" aria-hidden="true"></span>
{/if}

<style>
  .thumb {
    width: 36px;
    border-radius: 2px;
    display: block;
  }
  img.thumb {
    height: auto;
    max-height: 50px;
  }
  .placeholder {
    height: 36px;
    background: var(--surface-2);
    border: 1px solid var(--border);
  }
</style>
