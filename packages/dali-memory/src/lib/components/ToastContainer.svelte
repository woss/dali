<script lang="ts">
  import { getToasts } from './toast.svelte.ts';
  import Toast from './Toast.svelte';

  let toasts = getToasts();
</script>

{#if toasts.length > 0}
  <div class="fixed bottom-4 right-4 z-[100] flex flex-col gap-2 max-w-sm w-full pointer-events-none">
    {#each toasts.slice(0, 5) as t (t.id)}
      <div class="pointer-events-auto">
        <Toast toast={t} />
      </div>
    {/each}
  </div>
{/if}
