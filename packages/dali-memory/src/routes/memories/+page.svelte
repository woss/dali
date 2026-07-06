<script lang="ts">
  import { goto } from '$app/navigation';

  let { data } = $props();

  let allTags = $derived(data.allTags ?? []);
  let activeTag = $derived(data.activeTag ?? null);
  let workspaceNames = $derived<Record<string, string>>(data.workspaceNames ?? {});

  let allMemories = $derived<Array<{
    id: string;
    slug: string;
    name: string;
    content: string;
    memory_type: string;
    created_at: string;
    workspace_id: string;
    tags: Array<{ id: string; name: string }>;
  }>>(data.memories || []);

  function filterTag(tagName: string) {
    const url = new URL(window.location.href);
    if (activeTag === tagName) {
      url.searchParams.delete('tag');
    } else {
      url.searchParams.set('tag', tagName);
    }
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
    <h1 class="text-2xl font-heading font-bold bg-gradient-to-r from-primary to-secondary bg-clip-text text-transparent">All Memories</h1>
  </div>

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

  {#if allMemories.length === 0}
    <div class="glass rounded-2xl">
      <div class="card-body">
        <p class="text-center opacity-60">
          {#if activeTag}
            No memories tagged with "<strong>{activeTag}</strong>".
          {:else}
            No memories yet.
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
                <a href="/workspaces/{mem.workspace_id}/memories/{mem.slug}" class="hover:opacity-70 transition-opacity">
                  <h3 class="font-heading font-semibold">{mem.name}</h3>
                </a>
                <p class="mt-1 text-sm opacity-70">{truncate(mem.content, 200)}</p>
                <div class="mt-2 flex items-center gap-3 text-xs opacity-50">
                  <span class="badge badge-ghost">{mem.memory_type}</span>
                  <span>{formatDate(mem.created_at)}</span>
                  {#if workspaceNames[mem.workspace_id]}
                    <a
                      href="/workspaces/{mem.workspace_id}/memories"
                      class="badge badge-sm badge-outline hover:opacity-70 transition-opacity no-underline"
                    >
                      {workspaceNames[mem.workspace_id]}
                    </a>
                  {/if}
                </div>
                {#if mem.tags?.length > 0}
                  <div class="mt-1.5 flex flex-wrap gap-1.5">
                    {#each mem.tags as tag}
                      <span class="inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium bg-base-200/40 border border-base-300/20">{tag.name}</span>
                    {/each}
                  </div>
                {/if}
              </div>
            </div>
          </div>
        </div>
      {/each}
    </div>
  {/if}
</div>
