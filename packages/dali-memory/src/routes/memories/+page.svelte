<script lang="ts">
  let { data, form } = $props();

  let workspaces = $derived(data.workspaces || []);
  let activeWorkspaceId = $derived(data.activeWorkspaceId || '');

  let showCreateForm = $state(false);
  let newName = $state('');
  let newContent = $state('');
  let newType = $state('fact');

  let memories = $derived(data.memories || []);

  function switchWorkspace(e: Event) {
    const wsId = (e.target as HTMLSelectElement).value;
    const url = new URL(window.location.href);
    if (wsId) url.searchParams.set('workspace', wsId);
    else url.searchParams.delete('workspace');
    window.location.href = url.toString();
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
</script>

<div class="space-y-6">
  <div class="flex items-center justify-between">
    <h1 class="text-2xl font-heading font-bold bg-gradient-to-r from-primary to-secondary bg-clip-text text-transparent">Memories</h1>
    <button
      onclick={() => (showCreateForm = !showCreateForm)}
      class="btn btn-primary"
    >
      {showCreateForm ? 'Cancel' : '+ New Memory'}
    </button>
  </div>

  <div class="glass inline-flex items-center gap-2 px-4 py-2 rounded-xl">
    <label for="workspace" class="text-sm font-medium">Workspace:</label>
    <select
      id="workspace"
      value={activeWorkspaceId}
      onchange={switchWorkspace}
      class="select select-bordered select-sm w-full max-w-xs"
    >
      {#each workspaces as ws}
        <option value={ws.id}>{ws.name}</option>
      {/each}
    </select>
  </div>

  {#if showCreateForm}
    <form method="POST" action="?/create" class="glass rounded-2xl">
      <div class="card-body space-y-3">
        <input type="hidden" name="workspace_id" value={activeWorkspaceId} />
        <div>
          <label for="mem-name" class="mb-1 block text-sm font-medium">Name</label>
          <input
            name="name"
            id="mem-name"
            type="text"
            required
            bind:value={newName}
            class="input input-bordered w-full"
          />
        </div>
        <div>
          <label for="mem-content" class="mb-1 block text-sm font-medium">Content</label>
          <textarea
            name="content"
            id="mem-content"
            required
            bind:value={newContent}
            rows={4}
            class="textarea textarea-bordered w-full"
          ></textarea>
        </div>
        <div>
          <label for="mem-type" class="mb-1 block text-sm font-medium">Type</label>
          <select
            name="memory_type"
            id="mem-type"
            bind:value={newType}
            class="select select-bordered w-full"
          >
            <option value="fact">Fact</option>
            <option value="note">Note</option>
            <option value="code">Code</option>
            <option value="config">Config</option>
          </select>
        </div>
        <button
          type="submit"
          class="btn btn-success"
        >
          Save Memory
        </button>
      </div>
    </form>
  {/if}

  {#if form?.success}
    <div role="alert" class="alert alert-success">
      <span>Memory created.</span>
    </div>
  {/if}
  {#if form?.error}
    <div role="alert" class="alert alert-error">
      <span>{form.error}</span>
    </div>
  {/if}

  {#if memories.length === 0}
    <div class="glass rounded-2xl">
      <div class="card-body">
        <p class="text-center opacity-60">No memories yet in this workspace.</p>
      </div>
    </div>
  {:else}
    <div class="space-y-3">
      {#each memories as mem, i}
        <div class="glass rounded-xl animate-fade-in animate-slide-up" style="animation-delay: {i * 100}ms">
          <div class="card-body">
            <div class="flex items-start justify-between">
              <div class="flex-1">
                <h3 class="font-heading font-semibold">{mem.name}</h3>
                <p class="mt-1 text-sm opacity-70">{truncate(mem.content, 200)}</p>
                <div class="mt-2 flex items-center gap-3 text-xs opacity-50">
                  <span class="badge badge-ghost">{mem.memory_type}</span>
                  <span>{formatDate(mem.created_at)}</span>
                </div>
              </div>
              <form method="POST" action="?/delete" onsubmit={(e) => { if (!confirm('Delete this memory?')) e.preventDefault() }}>
                <input type="hidden" name="id" value={mem.id} />
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
