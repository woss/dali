<script lang="ts">
  import { page } from '$app/stores';
  import { invalidateAll } from '$app/navigation';
  import { toast } from '$lib/components/toast.svelte.ts';
  import { enhance } from '$app/forms';

  let { data, form } = $props();
  let memory = $derived(data.memory);
  let workspaceId = $derived($page.params.id);
  let showEditForm = $state(false);
  let deleteDialog: HTMLDialogElement | undefined = $state(undefined);
  let deleting = $state(false);
  let deleteError = $state('');

  // Close edit form on successful save
  $effect(() => {
    if (form?.success && form?.action === 'edit') showEditForm = false;
  });

  async function handleDelete() {
    if (deleting) return;
    deleting = true;
    deleteError = '';

    try {
      const res = await fetch('?/delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({ id: memory.id }),
      });
      if (res.ok) {
        toast.success('Memory deleted');
        invalidateAll();
        deleteDialog?.close();
      } else {
        const text = await res.text();
        deleteError = text || 'Failed to delete memory';
      }
    } catch (e) {
      deleteError = 'Network error — could not delete memory';
    } finally {
      deleting = false;
    }
  }

  function formatDate(d: string) {
    return new Date(d).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  }
</script>

<div class="space-y-6">
  <a href="/workspaces/{workspaceId}/memories" class="text-sm opacity-60 hover:opacity-100 transition-opacity">
    &larr; Back to Workspace
  </a>

  <div class="glass rounded-2xl animate-fade-in animate-slide-up">
    <div class="card-body space-y-4">
      <div class="flex items-start justify-between">
        <div>
          <h1 class="text-2xl font-heading font-bold bg-gradient-to-r from-primary to-secondary bg-clip-text text-transparent">{memory.name}</h1>
          <div class="mt-2 flex items-center gap-3 text-xs opacity-50">
            <span class="badge badge-ghost">{memory.memory_type}</span>
            <span>{formatDate(memory.created_at)}</span>
          </div>
        </div>
        <div class="flex gap-1">
          <button onclick={() => (showEditForm = !showEditForm)} class="btn btn-ghost btn-xs">
            {showEditForm ? 'Cancel' : 'Edit'}
          </button>
          <button onclick={() => deleteDialog?.showModal()} class="btn btn-ghost btn-xs text-error">Delete</button>
        </div>
      </div>

      {#if showEditForm}
        <form method="POST" action="?/edit" id="edit-form" class="space-y-3" use:enhance>
          <div>
            <label class="mb-1 block text-sm font-medium">Name</label>
            <input name="name" type="text" value={memory.name} required class="input input-bordered w-full" />
          </div>
          <div>
            <label class="mb-1 block text-sm font-medium">Content</label>
            <textarea name="content" rows={6} required class="textarea textarea-bordered w-full">{memory.content}</textarea>
          </div>
          <div class="flex gap-2">
            <button type="submit" class="btn btn-success btn-sm">Save</button>
            <button type="button" onclick={() => (showEditForm = false)} class="btn btn-ghost btn-sm">Cancel</button>
          </div>
        </form>
      {:else}
        <div class="prose prose-sm max-w-none">
          <p class="whitespace-pre-wrap text-sm leading-relaxed">{memory.content}</p>
        </div>
      {/if}

      {#if memory.metadata && Object.keys(memory.metadata).length > 0}
        <div class="border-t border-base-300 pt-4">
          <h3 class="text-sm font-medium opacity-60 mb-2">Metadata</h3>
          <pre class="text-xs opacity-50 whitespace-pre-wrap">{JSON.stringify(memory.metadata, null, 2)}</pre>
        </div>
      {/if}

      <div class="border-t border-base-300 pt-4">
        <h3 class="text-sm font-medium opacity-60 mb-2">Tags</h3>

        <div class="flex flex-wrap gap-2">
          {#if data.tags?.length > 0}
            {#each data.tags as tag}
              {#if showEditForm}
                <form method="POST" action="?/remove_tag" class="inline" use:enhance>
                  <input type="hidden" name="tag_id" value={tag.id} />
                  <button type="submit" class="inline-flex items-center gap-1 rounded-full px-3 py-0.5 text-xs font-medium bg-base-200/70 hover:bg-base-300 transition-colors cursor-pointer border border-base-300/30">
                    {tag.name}
                    <span class="ml-0.5 leading-none opacity-50 hover:opacity-100 text-sm">&times;</span>
                  </button>
                </form>
              {:else}
                <span class="inline-flex items-center rounded-full px-3 py-0.5 text-xs font-medium bg-base-200/70 border border-base-300/30">
                  {tag.name}
                </span>
              {/if}
            {/each}
          {:else}
            <span class="text-xs opacity-40">No tags</span>
          {/if}
        </div>

        {#if showEditForm}
          <form method="POST" action="?/add_tag" class="flex gap-2 mt-3" use:enhance>
            <input type="text" name="tag_name" placeholder="Add tags (comma separated)..." class="input input-bordered input-xs flex-1" />
            <button type="submit" class="btn btn-ghost btn-xs">Add</button>
          </form>

        {/if}
      </div>
    </div>
  </div>

  <dialog bind:this={deleteDialog} class="modal">
    <div class="modal-box">
      <form method="dialog">
        <button class="btn btn-sm btn-circle btn-ghost absolute right-2 top-2">✕</button>
      </form>
      <h3 class="mb-4 text-lg font-bold">Delete Memory</h3>
      <p>Are you sure you want to delete <strong>{memory.name}</strong>?</p>
      <p class="mt-1 text-sm text-error">This action cannot be undone.</p>
      {#if deleteError}
        <div role="alert" class="alert alert-error text-sm mt-3">{deleteError}</div>
      {/if}
      <div class="modal-action">
        <form method="dialog">
          <button class="btn btn-ghost">Cancel</button>
        </form>
        <button onclick={handleDelete} class="btn btn-error" disabled={deleting}>
          {deleting ? 'Deleting...' : 'Delete'}
        </button>
      </div>
    </div>
  </dialog>

  {#if form?.error}
    <div role="alert" class="alert alert-error">
      <span>{form.error}</span>
    </div>
  {/if}
</div>
