<script lang="ts">
  import type { Toast } from './toast.svelte.ts';
  import { removeToast } from './toast.svelte.ts';

  let { toast }: { toast: Toast } = $props();

  const icons: Record<string, string> = {
    success: 'M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z',
    error: 'M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z',
    info: 'M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z',
    warning: 'M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z',
  };
</script>

<div role="alert" class="alert alert-{toast.type} animate-fade-in animate-slide-up relative overflow-hidden shadow-xl">
  <svg class="w-5 h-5 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
    <path d={icons[toast.type]} />
  </svg>
  <span class="text-sm">{toast.message}</span>
  <button class="btn btn-ghost btn-xs btn-square shrink-0" onclick={() => removeToast(toast.id)} aria-label="Close">
    <svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
      <path d="M6 18L18 6M6 6l12 12" />
    </svg>
  </button>

  {#if toast.duration > 0}
    <div
      class="absolute bottom-0 left-0 h-1 bg-white/30"
      style="animation: toast-shrink {toast.duration}ms linear forwards"
    ></div>
  {/if}
</div>

<style>
  @keyframes toast-shrink {
    from { width: 100%; }
    to { width: 0%; }
  }
</style>
