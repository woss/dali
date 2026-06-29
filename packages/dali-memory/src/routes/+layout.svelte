<script lang="ts">
  import '../app.css';
  import { page } from '$app/stores';
  let { children } = $props();
</script>

<div>
  <!-- Glass navbar — fixed top, full width -->
  <div class="glass fixed top-0 left-0 right-0 z-50 rounded-none border-b border-white/5 shadow-lg shadow-amber-500/5">
    <div class="navbar max-w-6xl mx-auto">
      <div class="navbar-start">
        <a href="/" class="btn btn-ghost text-xl font-heading">🧠 dali-memory</a>
      </div>
      <div class="navbar-center hidden sm:flex">
        <a href="/memories" class="btn btn-ghost" class:btn-active={$page.url.pathname === '/memories'}>Memories</a>
        <a href="/workspaces" class="btn btn-ghost" class:btn-active={$page.url.pathname === '/workspaces'}>Workspaces</a>
        <a href="/settings" class="btn btn-ghost" class:btn-active={$page.url.pathname === '/settings'}>Settings</a>
      </div>
      <div class="navbar-end">
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
            <li role="none"><a href="/memories" role="menuitem" class:active={$page.url.pathname === '/memories'}>Memories</a></li>
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
  <main class="animate-fade-in animate-slide-up mx-auto max-w-6xl px-6 py-8 pt-24 min-h-screen">
    {@render children()}
  </main>
</div>

<style>
  @media (prefers-reduced-motion: reduce) {
    .animate-fade-in,
    .animate-slide-up {
      animation: none;
    }
  }
</style>
