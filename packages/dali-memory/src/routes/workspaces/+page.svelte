<script lang="ts">
  let { data, form } = $props();

  let workspaces = $derived(data.workspaces || []);
  let newName = $state('');
  let newDesc = $state('');

  function formatDate(d: string) {
    return new Date(d).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  }
</script>

<div class="space-y-6">
  <h1 class="font-heading bg-gradient-to-r from-primary to-secondary bg-clip-text text-transparent text-2xl">Workspaces</h1>

  <!-- Create form -->
  <form method="POST" action="?/create" class="glass rounded-2xl">
    <div class="card-body space-y-3">
      <h2 class="card-title font-heading">New Workspace</h2>
      <div>
        <label for="ws-name" class="mb-1 block text-sm font-medium">Name</label>
        <input
          name="name"
          id="ws-name"
          type="text"
          required
          bind:value={newName}
          class="input input-bordered w-full"
        />
      </div>
      <div>
        <label for="ws-desc" class="mb-1 block text-sm font-medium">Description</label>
        <textarea
          name="description"
          id="ws-desc"
          bind:value={newDesc}
          rows={2}
          class="textarea textarea-bordered w-full"
        ></textarea>
      </div>
      <button
        type="submit"
        class="btn btn-primary"
      >
        Create
      </button>
    </div>
  </form>

  {#if form?.success}
    <div role="alert" class="alert alert-success">
      <span>Workspace created.</span>
    </div>
  {/if}
  {#if form?.error}
    <div role="alert" class="alert alert-error">
      <span>{form.error}</span>
    </div>
  {/if}

  <!-- Workspaces list -->
  {#if workspaces.length === 0}
    <div class="glass rounded-2xl p-4">
      <p class="text-center opacity-60">No workspaces yet.</p>
    </div>
  {:else}
    <div class="grid gap-3 sm:grid-cols-2">
      {#each workspaces as ws, i}
        <div class="glass rounded-xl p-4 animate-fade-in animate-slide-up" style="animation-delay: {i * 100}ms">
          <div class="flex items-start justify-between">
            <div class="flex-1 min-w-0">
              <h3 class="font-heading text-base">{ws.name}</h3>
                {#if ws.description}
                  <p class="mt-1 text-sm opacity-70">{ws.description}</p>
                {/if}
                <p class="mt-2 text-xs opacity-50">{formatDate(ws.created_at)}</p>
              </div>
              <div class="card-actions items-center gap-2">
                <a
                  href="/memories?workspace={ws.id}"
                  class="btn btn-ghost btn-sm"
                >
                  View &rarr;
                </a>
                <form
                  method="POST"
                  action="?/delete"
                  onsubmit={(e) => { if (!confirm('Delete this workspace and all its memories?')) e.preventDefault() }}
                >
                  <input type="hidden" name="id" value={ws.id} />
                  <button
                    type="submit"
                    class="btn btn-ghost btn-xs text-error"
                  >
                    Delete
                  </button>
                </form>
              </div>
          </div>
        </div>
      {/each}
    </div>
  {/if}
</div>
