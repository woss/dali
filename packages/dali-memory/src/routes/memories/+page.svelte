<script lang="ts">
  import { enhance } from '$app/forms';
  import { goto, invalidateAll } from '$app/navigation';
  import { navigating, page } from '$app/stores';
  import { toast } from 'svelte-sonner';

  let { data, form } = $props<{ data: any; form?: any }>();

  let searchQuery = $derived(data.searchQuery ?? '');
  let allTags = $derived(data.allTags ?? []);
  let activeTag = $derived(data.activeTag ?? null);
  let workspaceNames = $derived<Record<string, string>>(data.workspaceNames ?? {});
  let workspaces = $derived<Array<{ id: string; name: string }>>(data.workspaces ?? []);

  let createDialog: HTMLDialogElement | undefined = $state(undefined);
  let creating = $state(false);
  let createError = $state('');
  let newName = $state('');
  let newContent = $state('');
  let newType = $state('fact');
  let newWorkspaceId = $state('');
  let searchInput = $state(searchQuery);
  let debounceTimer: ReturnType<typeof setTimeout> | undefined;

  let deleteDialog: HTMLDialogElement | undefined = $state(undefined);
  let deleteConfirmTarget: { id: string; name: string } | null = $state(null);
  let deleting = $state(false);
  let deleteError = $state('');

  let searchInputEl: HTMLInputElement | undefined = $state(undefined);

  function handleKeydown(e: KeyboardEvent) {
    if (e.key === 'k' && (e.metaKey || e.ctrlKey)) {
      e.preventDefault();
      searchInputEl?.focus();
    }
  }

  $effect(() => {
    searchInput = searchQuery;
  });

  $effect(() => {
    if (debounceTimer) clearTimeout(debounceTimer);
    if (searchInput.trim() === searchQuery) return;
    const timer = setTimeout(() => updateSearch(searchInput), 300);
    debounceTimer = timer;
    return () => clearTimeout(timer);
  });

  // Set default workspace when workspaces load
  $effect(() => {
    if (!newWorkspaceId && workspaces.length > 0) {
      newWorkspaceId = workspaces[0].id;
    }
  });

  let allMemories = $derived<Array<{
    id: string;
    slug: string;
    name: string;
    content: string;
    memory_type: string;
    created_at: string;
    workspace_id: string;
    tags: Array<{ id: string; name: string }>;
    matched_on?: 'vector' | 'fulltext' | 'both';
  }>>(data.memories || []);

  function updateSearch(query: string) {
    const url = new URL(window.location.href);
    const trimmed = query.trim();
    if (trimmed) url.searchParams.set('q', trimmed);
    else url.searchParams.delete('q');
    url.searchParams.delete('tag');
    goto(url.toString(), { invalidateAll: true });
  }

  function clearSearch() {
    if (debounceTimer) clearTimeout(debounceTimer);
    debounceTimer = undefined;
    searchInput = '';
    const url = new URL(window.location.href);
    url.searchParams.delete('q');
    goto(url.toString(), { invalidateAll: true });
  }

  function filterTag(tagName: string) {
    if (debounceTimer) clearTimeout(debounceTimer);
    debounceTimer = undefined;
    const url = new URL(window.location.href);
    if (activeTag === tagName) {
      url.searchParams.delete('tag');
    } else {
      url.searchParams.set('tag', tagName);
    }
    url.searchParams.delete('q');
    goto(url.toString(), { invalidateAll: true });
  }

  function formatDate(d: string) {
    return new Date(d).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  }

  function truncate(s: string, n: number) {
    return s.length > n ? s.slice(0, n) + '...' : s;
  }

  async function handleDelete(e: Event) {
    e.preventDefault();
    if (deleting || !deleteConfirmTarget) return;

    const targetId = deleteConfirmTarget.id;
    deleteDialog?.close();

    deleting = true;
    try {
      const fd = new FormData();
      fd.append('id', targetId);
      const res = await fetch('?/delete', { method: 'POST', body: fd });
      if (res.ok) {
        toast.success('Memory deleted.');
        deleteConfirmTarget = null;
        await invalidateAll();
      } else {
        try { const body = await res.json(); toast.error(body?.data?.error || 'Failed to delete memory.'); }
        catch { toast.error('Failed to delete memory.'); }
        await invalidateAll();
      }
    } finally {
      deleting = false;
    }
  }
</script>

<svelte:window onkeydown={handleKeydown} />

<div class="space-y-6">
  <div class="flex items-center justify-between">
    <h1 class="text-2xl font-heading font-bold bg-gradient-to-r from-primary to-secondary bg-clip-text text-transparent">All Memories</h1>
    <button
      onclick={() => createDialog?.showModal()}
      class="btn btn-primary"
    >
      + New Memory
    </button>
  </div>

  <div class="flex items-center gap-2">
    <div class="relative flex-1">
      <svg class="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 opacity-40" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg>
      <input
        type="text"
        name="q"
        placeholder="Search memories..."
        bind:value={searchInput}
        bind:this={searchInputEl}
        class="input input-bordered input-sm w-full pl-9"
      />
    </div>
    {#if searchQuery}
      <button onclick={clearSearch} type="button" class="btn btn-ghost btn-sm">Clear</button>
    {/if}
  </div>

  {#if searchQuery}
    <div class="flex items-center gap-2 text-sm">
      <span>Search results for: <strong>"{searchQuery}"</strong></span>
      <button onclick={clearSearch} class="btn btn-ghost btn-xs">Clear</button>
    </div>
  {/if}

  {#if allTags.length > 0}
    <div class="glass inline-flex flex-wrap items-center gap-1.5 px-3 py-2 rounded-xl">
      {#each allTags as tag}
        <button
          onclick={() => filterTag(tag.name)}
          class="badge cursor-pointer transition-all
            {activeTag === tag.name
              ? 'badge-primary shadow-sm'
              : 'badge-ghost hover:badge-outline'}"
        >
          {tag.name}
        </button>
      {/each}
      {#if activeTag}
        <button
          onclick={() => filterTag(activeTag)}
          class="badge badge-ghost cursor-pointer opacity-40 hover:opacity-70 transition-opacity"
        >
          &times; clear
        </button>
      {/if}
    </div>
  {/if}

  <dialog bind:this={createDialog} class="modal">
    <div class="modal-box">
      <form method="dialog">
        <button class="btn btn-sm btn-circle btn-ghost absolute right-2 top-2">✕</button>
      </form>
      <h3 class="mb-4 text-lg font-bold">New Memory</h3>
      <form id="create-memory-form" method="POST" action="?/create" use:enhance={() => {
  creating = true;
  createError = '';
  return async ({ update, result }) => {
    creating = false;
    if (result.type === 'success') {
      createDialog?.close();
      toast.success('Memory created.');
      newName = '';
      newContent = '';
      newType = 'fact';
      newWorkspaceId = workspaces[0]?.id ?? '';
    } else if (result.type === 'failure') {
      createError = result.data?.error || 'Failed to create memory.';
    } else {
      createError = 'Network error.';
    }
    await update();
  };
}}>
        <div class="space-y-3">
          <div>
            <label for="modal-name" class="mb-1 block text-sm font-medium">Name</label>
            <input name="name" id="modal-name" type="text" required bind:value={newName} class="input input-bordered w-full" />
          </div>
          <div>
            <label for="modal-content" class="mb-1 block text-sm font-medium">Content</label>
            <textarea name="content" id="modal-content" required bind:value={newContent} rows={4} class="textarea textarea-bordered w-full"></textarea>
          </div>
          <div>
            <label for="modal-type" class="mb-1 block text-sm font-medium">Type</label>
            <select name="memory_type" id="modal-type" bind:value={newType} class="select select-bordered w-full">
              <option value="fact">Fact</option>
              <option value="note">Note</option>
              <option value="code">Code</option>
              <option value="config">Config</option>
            </select>
          </div>
          <div>
            <label for="modal-workspace" class="mb-1 block text-sm font-medium">Workspace</label>
            <select name="workspace_id" id="modal-workspace" bind:value={newWorkspaceId} class="select select-bordered w-full">
              {#each workspaces as ws}
                <option value={ws.id}>{ws.name}</option>
              {/each}
            </select>
          </div>
          {#if createError}
            <div role="alert" class="alert alert-error text-sm">{createError}</div>
          {/if}
        </div>
        <div class="modal-action">
          <button type="submit" class="btn btn-success" disabled={creating}>
            {creating ? 'Saving...' : 'Save Memory'}
          </button>
        </div>
      </form>
    </div>
  </dialog>

  <dialog bind:this={deleteDialog} class="modal">
    <div class="modal-box">
      <form method="dialog">
        <button class="btn btn-sm btn-circle btn-ghost absolute right-2 top-2">✕</button>
      </form>
      <h3 class="mb-4 text-lg font-bold">Delete Memory</h3>
      {#if deleteConfirmTarget}
        <p class="mb-1 opacity-70">Are you sure you want to delete <strong>{deleteConfirmTarget.name}</strong>?</p>
        <p class="text-sm text-error">This action cannot be undone.</p>
      {/if}
      {#if deleteError}
        <div role="alert" class="alert alert-error text-sm mt-3">{deleteError}</div>
      {/if}
      <div class="modal-action">
        <form method="dialog">
          <button class="btn btn-ghost" disabled={deleting}>Cancel</button>
        </form>
        <button onclick={handleDelete} class="btn btn-error" disabled={deleting}>
          {deleting ? 'Deleting...' : 'Delete'}
        </button>
      </div>
    </div>
  </dialog>

  {#if $navigating}
    <div class="flex items-center justify-center py-12">
      <span class="loading loading-spinner loading-lg text-primary"></span>
    </div>
  {:else if allMemories.length === 0}
    <div class="glass rounded-2xl">
      <div class="card-body">
        <p class="text-center opacity-60">
          {#if searchQuery}
            No results found for "<strong>{searchQuery}</strong>".
          {:else if activeTag}
            No memories tagged with "<strong>{activeTag}</strong>".
          {:else}
            No memories yet.
          {/if}
        </p>
      </div>
    </div>
  {:else if !$navigating}
    <div class="space-y-3">
      {#each allMemories as mem, i (mem.id)}
        <div
          class="card card-border card-hover-3d glass rounded-xl"
        >
          <div class="card-body">
            <div class="flex items-start justify-between">
              <div class="flex-1">
                <div class="flex items-center gap-2 flex-wrap">
                  <a href="/workspaces/{mem.workspace_id}/memories/{mem.slug}" class="hover:opacity-70 transition-opacity">
                    <h3 class="font-heading font-semibold">{mem.name}</h3>
                  </a>
                  {#if workspaceNames[mem.workspace_id]}
                    <a
                      href="/workspaces/{mem.workspace_id}/memories"
                      class="badge badge-sm badge-outline no-underline hover:opacity-70 transition-opacity"
                    >
                      {workspaceNames[mem.workspace_id]}
                    </a>
                  {/if}
                </div>
                <p class="mt-1 text-sm opacity-70">{truncate(mem.content, 200)}</p>
                <div class="mt-2 flex items-center gap-3 text-xs opacity-50">
                  <span class="badge badge-ghost">{mem.memory_type}</span>
                  {#if mem.matched_on}
                    <span class="badge badge-sm badge-outline">
                      {#if mem.matched_on === 'vector'}🔤 Semantic
                      {:else if mem.matched_on === 'fulltext'}📝 Text
                      {:else}🔄 Hybrid
                      {/if}
                    </span>
                  {/if}
                  <span>{formatDate(mem.created_at)}</span>
                </div>
                {#if mem.tags?.length > 0}
                  <div class="mt-1.5 flex flex-wrap gap-1.5">
                    {#each mem.tags as tag}
                      <span class="inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium bg-base-200/40 border border-base-300/20">{tag.name}</span>
                    {/each}
                  </div>
                {/if}
              </div>
              <button
                  onclick={() => { deleteConfirmTarget = { id: mem.id, name: mem.name }; deleteDialog?.showModal(); }}
                class="btn btn-ghost btn-xs text-error"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      {/each}
    </div>
  {/if}
</div>
