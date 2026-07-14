<script lang="ts">
  import '../app.css';
  import { goto } from '$app/navigation';
  import { page } from '$app/stores';
  import ToastContainer from '$lib/components/ToastContainer.svelte';
  let { children } = $props();

  // Derive workspace context for nav
  let workspaceName = $state<string | null>(null);
  $effect(() => {
    const path = $page.url.pathname;
    const wsMatch = path.match(/^\/workspaces\/([^/]+)/);
    if (wsMatch) {
      const wsId = wsMatch[1];
      const ws = ($page.data.workspaces as Array<{id: string; name: string}>)?.find(w => w.id === wsId);
      workspaceName = ws?.name ?? null;
    } else {
      workspaceName = null;
    }
  });

  let memoriesHref = $derived('/memories');

  // Dynamic document title based on current route
  let pageTitle = $derived.by(() => {
    const path = $page.url.pathname;
    if (path === '/') return 'dali-memory';
    if (path.includes('/memories')) return 'Memories - dali-memory';
    if (path.startsWith('/workspaces')) return 'Workspaces - dali-memory';
    if (path === '/settings') return 'Settings - dali-memory';
    if (path === '/login') return 'Sign In - dali-memory';
    if (path === '/register') return 'Register - dali-memory';
    return 'dali-memory';
  });

  // Keyboard shortcuts
  let helpDialog: HTMLDialogElement | undefined = $state(undefined);
  let pendingG: string | null = $state(null);
  let gTimer: ReturnType<typeof setTimeout> | undefined;

  function isEditable(el: EventTarget | null): boolean {
    if (!el || !(el instanceof HTMLElement)) return false;
    const tag = el.tagName;
    return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || el.isContentEditable;
  }

  function cancelG() {
    pendingG = null;
    if (gTimer) clearTimeout(gTimer);
    gTimer = undefined;
  }

  function handleKeydown(e: KeyboardEvent) {
    // Never intercept when typing in editable elements
    if (isEditable(e.target)) return;

    // Help dialog: ? or Cmd+/
    if (e.key === '?' || (e.key === '/' && (e.metaKey || e.ctrlKey))) {
      e.preventDefault();
      helpDialog?.showModal();
      cancelG();
      return;
    }

    // Slash navigation: focus search input on page
    if (e.key === '/' && !e.metaKey && !e.ctrlKey && !e.altKey) {
      e.preventDefault();
      const searchInput = document.querySelector<HTMLInputElement>(
        'input[type="text"][placeholder*="Search" i]'
      ) ?? document.querySelector<HTMLInputElement>('input[type="text"]');
      searchInput?.focus();
      cancelG();
      return;
    }

    // Cmd/Ctrl+K — focus search
    if (e.key === 'k' && (e.metaKey || e.ctrlKey)) {
      e.preventDefault();
      const searchInput = document.querySelector<HTMLInputElement>(
        'input[type="text"][placeholder*="Search" i]'
      ) ?? document.querySelector<HTMLInputElement>('input[type="text"]');
      searchInput?.focus();
      cancelG();
      return;
    }

    // "g then X" navigation
    if (e.key === 'g' && !e.metaKey && !e.ctrlKey && !e.altKey) {
      e.preventDefault();
      cancelG();
      pendingG = 'g';
      gTimer = setTimeout(() => {
        pendingG = null;
        gTimer = undefined;
      }, 1000);
      return;
    }

    if (pendingG === 'g') {
      cancelG();
      if (e.key === 'h') {
        e.preventDefault();
        goto('/');
        return;
      }
      if (e.key === 'm') {
        e.preventDefault();
        goto('/memories');
        return;
      }
      if (e.key === 'w') {
        e.preventDefault();
        goto('/workspaces');
        return;
      }
      if (e.key === 's') {
        e.preventDefault();
        goto('/settings');
        return;
      }
    }
  }
</script>

<div>
  <!-- Glass navbar — fixed top, full width -->
  <div class="glass fixed top-0 left-0 right-0 z-50 rounded-none border-b border-white/5 shadow-lg shadow-amber-500/5">
    <div class="navbar max-w-7xl mx-auto">
      <div class="navbar-start">
        <a href="/" class="btn btn-ghost text-xl font-heading">🧠 dali-memory</a>
      </div>
      <div class="navbar-center hidden sm:flex">
        <a href={memoriesHref} class="btn btn-ghost relative nav-link" class:btn-active={$page.url.pathname.includes('/memories') || $page.url.pathname.startsWith('/workspaces') && $page.url.pathname !== '/workspaces'}>Memories</a>
        <a href="/workspaces" class="btn btn-ghost relative nav-link" class:btn-active={$page.url.pathname === '/workspaces'}>Workspaces</a>
        <a href="/settings" class="btn btn-ghost relative nav-link" class:btn-active={$page.url.pathname === '/settings'}>Settings</a>
      </div>
      <div class="navbar-end">
        <!-- Workspace context pill -->
        {#if workspaceName}
          <span class="hidden sm:inline-flex items-center gap-1 mr-2 text-xs text-neutral-400 border border-white/10 rounded-full px-2.5 py-0.5">
            {workspaceName}
          </span>
        {/if}
        <!-- Desktop auth -->
        <div class="hidden sm:flex items-center gap-1">
          {#if $page.data.authenticated}
            <span class="text-sm text-neutral-400 mr-1">{$page.data.name ?? $page.data.userEmail}</span>
            <a href="/logout" class="btn btn-ghost btn-sm">Logout</a>
          {:else}
            <a href="/login" class="btn btn-ghost btn-sm">Sign In</a>
            <a href="/register" class="btn btn-ghost btn-sm">Register</a>
          {/if}
        </div>
        <div class="dropdown dropdown-end sm:hidden">
          <button class="btn btn-ghost btn-square" aria-label="Menu">
            <svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6h16M4 12h16M4 18h16" /></svg>
          </button>
          <ul tabindex="0" role="menu" class="dropdown-content menu bg-base-200 rounded-box z-[51] mt-3 w-52 p-2 shadow-xl">
            <li role="none"><a href={memoriesHref} role="menuitem" class:active={$page.url.pathname.includes('/memories')}>Memories</a></li>
            <li role="none"><a href="/workspaces" role="menuitem" class:active={$page.url.pathname === '/workspaces'}>Workspaces</a></li>
            <li role="none"><a href="/settings" role="menuitem" class:active={$page.url.pathname === '/settings'}>Settings</a></li>
            <li role="none" class="divider my-1"></li>
            {#if $page.data.authenticated}
              <li role="none"><span class="text-sm text-neutral-400">{$page.data.name ?? $page.data.userEmail}</span></li>
              <li role="none"><a href="/logout" role="menuitem">Logout</a></li>
            {:else}
              <li role="none"><a href="/login" role="menuitem">Sign In</a></li>
              <li role="none"><a href="/register" role="menuitem">Register</a></li>
            {/if}
          </ul>
        </div>
      </div>
    </div>
  </div>

  <!-- Main content — animated entrance -->
  <main class="animate-fade-in animate-slide-up mx-auto max-w-7xl px-6 py-8 pt-24 min-h-screen">
    {@render children()}
  </main>

  <ToastContainer />

  <!-- Keyboard shortcuts help dialog -->
  <dialog bind:this={helpDialog} class="modal">
    <div class="modal-box">
      <form method="dialog">
        <button class="btn btn-sm btn-circle btn-ghost absolute right-2 top-2">✕</button>
      </form>
      <h3 class="mb-4 text-lg font-bold">Keyboard Shortcuts</h3>
      <div class="overflow-x-auto">
        <table class="table table-sm">
          <thead>
            <tr>
              <th class="w-1/3">Shortcut</th>
              <th>Action</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td><kbd class="kbd kbd-sm">?</kbd></td>
              <td>Show this help</td>
            </tr>
            <tr>
              <td><kbd class="kbd kbd-sm">g</kbd> then <kbd class="kbd kbd-sm">h</kbd></td>
              <td>Go to Home</td>
            </tr>
            <tr>
              <td><kbd class="kbd kbd-sm">g</kbd> then <kbd class="kbd kbd-sm">m</kbd></td>
              <td>Go to Memories</td>
            </tr>
            <tr>
              <td><kbd class="kbd kbd-sm">g</kbd> then <kbd class="kbd kbd-sm">w</kbd></td>
              <td>Go to Workspaces</td>
            </tr>
            <tr>
              <td><kbd class="kbd kbd-sm">g</kbd> then <kbd class="kbd kbd-sm">s</kbd></td>
              <td>Go to Settings</td>
            </tr>
            <tr>
              <td><kbd class="kbd kbd-sm">⌘</kbd> / <kbd class="kbd kbd-sm">Ctrl</kbd> + <kbd class="kbd kbd-sm">K</kbd></td>
              <td>Search memories</td>
            </tr>
            <tr>
              <td><kbd class="kbd kbd-sm">Escape</kbd></td>
              <td>Close dialogs</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
    <form method="dialog" class="modal-backdrop">
      <button>close</button>
    </form>
  </dialog>
</div>

<svelte:head>
  <title>{pageTitle}</title>
</svelte:head>

<svelte:window onkeydown={handleKeydown} />

<style>
  .nav-link.btn-active::after {
    content: '';
    position: absolute;
    bottom: 0;
    left: 0.5rem;
    right: 0.5rem;
    height: 0.125rem;
    border-radius: 9999px;
    background-color: oklch(var(--p));
  }

  @media (prefers-reduced-motion: reduce) {
    .animate-fade-in,
    .animate-slide-up {
      animation: none;
    }
  }
</style>
