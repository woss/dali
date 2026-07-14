<script lang="ts">
  import { enhance } from '$app/forms';
  import { invalidateAll } from '$app/navigation';
  import { toast } from '$lib/components/toast.svelte.ts';

  let { data } = $props();

  let workspaces = $derived(data.workspaces || []);
  let createDialog: HTMLDialogElement | undefined = $state(undefined);
  let creating = $state(false);
  let createError = $state('');
  let newName = $state('');
  let newDesc = $state('');

  let deleteDialog: HTMLDialogElement | undefined = $state(undefined);
  let deleteTarget: { id: string; name: string } | undefined = $state(undefined);
  let deleting = $state(false);
  let deleteError = $state('');

  function formatDate(d: string) {
    return new Date(d).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  }

  async function handleDelete() {
    if (deleting || !deleteTarget) return;
    deleting = true;
    deleteError = '';
    try {
      const fd = new FormData();
      fd.set('id', deleteTarget.id);
      const res = await fetch('?/delete', { method: 'POST', body: fd });
      if (res.ok) {
        deleteDialog?.close();
        toast.success('Workspace deleted.');
        deleteTarget = undefined;
        await invalidateAll();
      } else {
        try { const body = await res.json(); deleteError = body?.data?.error || 'Failed to delete workspace.'; }
        catch { deleteError = 'Failed to delete workspace.'; }
      }
    } finally {
      deleting = false;
    }
  }
</script>

<div class="space-y-6">
  <div class="flex items-center justify-between">
    <h1 class="font-heading bg-gradient-to-r from-primary to-secondary bg-clip-text text-transparent text-2xl">Workspaces</h1>
    <button onclick={() => createDialog?.showModal()} class="btn btn-primary">+ New Workspace</button>
  </div>

  <dialog bind:this={createDialog} class="modal">
    <div class="modal-box">
      <form method="dialog">
        <button class="btn btn-sm btn-circle btn-ghost absolute right-2 top-2">✕</button>
      </form>
      <h3 class="mb-4 text-lg font-bold">New Workspace</h3>
      <form method="POST" action="?/create" use:enhance={() => {
  creating = true;
  createError = '';
  return async ({ update, result }) => {
    creating = false;
    if (result.type === 'success') {
      createDialog?.close();
      toast.success('Workspace created.');
      newName = '';
      newDesc = '';
    } else if (result.type === 'failure') {
      createError = result.data?.error || 'Failed to create workspace.';
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
            <label for="modal-desc" class="mb-1 block text-sm font-medium">Description</label>
            <textarea name="description" id="modal-desc" bind:value={newDesc} rows={3} class="textarea textarea-bordered w-full"></textarea>
          </div>
          {#if createError}
            <div role="alert" class="alert alert-error text-sm">{createError}</div>
          {/if}
        </div>
        <div class="modal-action">
          <button type="submit" class="btn btn-success" disabled={creating}>
            {creating ? 'Creating...' : 'Create Workspace'}
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
      <h3 class="mb-4 text-lg font-bold">Delete Workspace</h3>
      <p>Are you sure you want to delete <strong>{deleteTarget?.name}</strong> and all its memories?</p>
      <p class="mt-1 text-sm opacity-70">This action cannot be undone.</p>
      {#if deleteError}
        <div role="alert" class="alert alert-error text-sm mt-3">{deleteError}</div>
      {/if}
      <div class="modal-action">
        <form method="dialog">
          <button class="btn btn-ghost">Cancel</button>
        </form>
        <button class="btn btn-error" disabled={deleting} onclick={handleDelete}>
          {deleting ? 'Deleting...' : 'Delete'}
        </button>
      </div>
    </div>
  </dialog>

  <!-- Workspaces list -->
  {#if workspaces.length === 0}
    <div class="glass rounded-2xl p-4">
      <p class="text-center opacity-60">No workspaces yet.</p>
    </div>
  {:else}
    <div class="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {#each workspaces as ws, i}
        <div class="card card-border glass rounded-xl animate-fade-in animate-slide-up" style="animation-delay: {i * 100}ms">
          <div class="card-body p-4">
            <div class="flex items-start justify-between">
              <div class="flex-1 min-w-0">
                <h3 class="card-title font-heading text-base">{ws.name}</h3>
                  {#if ws.description}
                    <p class="mt-1 text-sm opacity-70">{ws.description}</p>
                  {/if}
                  <div class="mt-2 flex items-center gap-2 text-xs opacity-50">
                    <span>{formatDate(ws.created_at)}</span>
                    <span class="badge badge-ghost badge-sm">{ws.memory_count ?? 0} memories</span>
                  </div>
                </div>
                <div class="card-actions items-center gap-2">
                <a
                  href="/workspaces/{ws.slug}/memories"
                  class="btn btn-ghost btn-sm"
                >
                  View &rarr;
                </a>
                <button
                  onclick={() => { deleteTarget = { id: ws.id, name: ws.name }; deleteDialog?.showModal(); }}
                  class="btn btn-ghost btn-xs text-error"
                >
                  Delete
                </button>
              </div>
            </div>
          </div>
        </div>
      {/each}
    </div>
  {/if}
</div>
