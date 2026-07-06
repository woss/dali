<script lang="ts">
  import { goto } from '$app/navigation';
  import { page } from '$app/stores';

  let { data, form } = $props();

  let workspaceId = $derived($page.params.id || '');
  let workspaceName = $derived(data.workspace?.name || '');
  let searchQuery = $derived(data.searchQuery ?? '');
  let allTags = $derived(data.allTags ?? []);
  let activeTag = $derived(data.activeTag ?? null);

  let showCreateForm = $state(false);
  let newName = $state('');
  let newContent = $state('');
  let newType = $state('fact');
  let searchInput = $state(searchQuery);

  $effect(() => {
    searchInput = searchQuery;
  });

  let allMemories = $state<Array<{
    id: string;
    slug: string;
    name: string;
    content: string;
    memory_type: string;
    created_at: string;
    tags: Array<{ id: string; name: string }>;
    matched_on?: 'vector' | 'fulltext' | 'both';
  }>>(data.memories || []);

  let lastOffset = $state(0);

  $effect(() => {
    const ms = data.memories || [];
    const off = data.offset ?? 0;

    // Form action just completed — reload fresh data from page 0
    if (form?.success && off > 0 && off === lastOffset) {
      allMemories = ms;
      lastOffset = 0;
      return;
    }

    if (off === 0) {
      allMemories = ms;
      lastOffset = 0;
    } else if (off > lastOffset) {
      const existingIds = new Set(allMemories.map(m => m.id));
      const newItems = ms.filter(m => !existingIds.has(m.id));
      if (newItems.length > 0) {
        allMemories = [...allMemories, ...newItems];
      }
      lastOffset = off;
    }
  });

  let hasMore = $derived(data.hasMore ?? false);
  let currentOffset = $derived(data.offset ?? 0);
  let pageSize = $derived(data.limit ?? 20);

  function doSearch(e: Event) {
    e.preventDefault();
    const url = new URL(window.location.href);
    if (searchInput.trim()) url.searchParams.set('q', searchInput.trim());
    else url.searchParams.delete('q');
    url.searchParams.delete('tag');
    url.searchParams.delete('offset');
    goto(url.toString(), { invalidateAll: true });
  }

  function clearSearch() {
    const url = new URL(window.location.href);
    url.searchParams.delete('q');
    url.searchParams.delete('offset');
    goto(url.toString(), { invalidateAll: true });
  }

  function filterTag(tagName: string) {
    const url = new URL(window.location.href);
    if (activeTag === tagName) {
      url.searchParams.delete('tag');
    } else {
      url.searchParams.set('tag', tagName);
    }
    url.searchParams.delete('q');
    url.searchParams.delete('offset');
    goto(url.toString(), { invalidateAll: true });
  }

  function loadMore() {
    const url = new URL(window.location.href);
    const nextOffset = currentOffset + pageSize;
    url.searchParams.set('offset', String(nextOffset));
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
</script>

<div class="space-y-6">
  <div class="flex items-center justify-between">
    <h1 class="text-2xl font-heading font-bold bg-gradient-to-r from-primary to-secondary bg-clip-text text-transparent">{workspaceName} Memories</h1>
    <button
      onclick={() => (showCreateForm = !showCreateForm)}
      class="btn btn-primary"
    >
      {showCreateForm ? 'Cancel' : '+ New Memory'}
    </button>
  </div>

  <form onsubmit={doSearch} class="flex items-center gap-2">
    <div class="relative flex-1">
      <svg class="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 opacity-40" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg>
      <input
        type="text"
        name="q"
        placeholder="Search memories..."
        bind:value={searchInput}
        class="input input-bordered input-sm w-full pl-9"
      />
    </div>
    <button type="submit" class="btn btn-primary btn-sm">Search</button>
    {#if searchQuery}
      <button onclick={clearSearch} type="button" class="btn btn-ghost btn-sm">Clear</button>
    {/if}
  </form>

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
          class="inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium transition-all cursor-pointer
            {activeTag === tag.name
              ? 'bg-primary text-primary-content shadow-sm'
              : 'bg-base-200/50 hover:bg-base-300/70 text-base-content/70 hover:text-base-content'}"
        >
          {tag.name}
        </button>
      {/each}
      {#if activeTag}
        <button
          onclick={() => filterTag(activeTag)}
          class="inline-flex items-center rounded-full px-2 py-0.5 text-xs opacity-40 hover:opacity-70 transition-opacity cursor-pointer"
        >
          &times; clear
        </button>
      {/if}
    </div>
  {/if}

  {#if showCreateForm}
    <form method="POST" action="?/create" class="glass rounded-2xl">
      <div class="card-body space-y-3">
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

  {#if allMemories.length === 0}
    <div class="glass rounded-2xl">
      <div class="card-body">
        <p class="text-center opacity-60">
          {#if searchQuery}
            No results found for "<strong>{searchQuery}</strong>".
          {:else}
            No memories yet in this workspace.
          {/if}
        </p>
      </div>
    </div>
  {:else}
    <div class="space-y-3">
      {#each allMemories as mem, i (mem.id)}
        <div class="glass rounded-xl animate-fade-in animate-slide-up" style="animation-delay: {i * 100}ms">
          <div class="card-body">
            <div class="flex items-start justify-between">
              <div class="flex-1">
                <a href="/workspaces/{workspaceId}/memories/{mem.slug}" class="hover:opacity-70 transition-opacity">
                  <h3 class="font-heading font-semibold">{mem.name}</h3>
                </a>
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

    {#if hasMore}
      <div class="flex justify-center pt-2">
        <button onclick={loadMore} class="btn btn-outline btn-wide">
          Load More
        </button>
      </div>
    {/if}
  {/if}
</div>
