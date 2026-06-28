<script lang="ts">
  let { data } = $props();
  let stats = $derived(data.stats);
</script>

<div class="space-y-12">
  <!-- Hero Section -->
  <div class="relative overflow-hidden pt-8 pb-4 md:pt-12 md:pb-8">
    <!-- Glow behind heading -->
    <div class="pointer-events-none absolute inset-0 flex justify-center">
      <div class="h-64 w-96 rounded-full bg-gradient-to-r from-primary/20 via-secondary/20 to-accent/20 blur-[100px]" />
    </div>

    <div class="relative mx-auto max-w-3xl text-center space-y-4 animate-fade-in animate-slide-up">
      <h1 class="font-heading text-5xl md:text-6xl lg:text-7xl font-bold bg-gradient-to-r from-primary via-secondary to-accent bg-clip-text text-transparent">
        dali-memory
      </h1>
      <p class="font-body text-lg md:text-xl text-base-content/70 max-w-xl mx-auto">
        Persistent memory server with hybrid semantic search
      </p>
    </div>
  </div>

  <!-- Stats Section -->
  <div class="grid grid-cols-1 md:grid-cols-3 gap-4 md:gap-6">
    <div class="glass p-6 text-center animate-fade-in animate-slide-up stagger-1">
      <p class="font-heading text-4xl md:text-5xl font-bold text-primary">{stats.memories}</p>
      <p class="text-sm text-base-content/70 mt-1">Memories</p>
    </div>
    <div class="glass p-6 text-center animate-fade-in animate-slide-up stagger-2">
      <p class="font-heading text-4xl md:text-5xl font-bold text-primary">{stats.workspaces}</p>
      <p class="text-sm text-base-content/70 mt-1">Workspaces</p>
    </div>
    <div class="glass p-6 text-center animate-fade-in animate-slide-up stagger-3">
      <p class="font-heading text-4xl md:text-5xl font-bold text-primary">{stats.tags}</p>
      <p class="text-sm text-base-content/70 mt-1">Tags</p>
    </div>
  </div>

  <!-- Getting Started Section -->
  <div class="glass p-6 md:p-8 animate-fade-in animate-slide-up stagger-4">
    <h2 class="text-xl md:text-2xl font-heading font-bold text-primary mb-4">Getting Started</h2>
    <ol class="space-y-3">
      <li class="flex items-center gap-3">
        <span class="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary/20 text-xs font-bold text-primary">1</span>
        <span class="text-base-content/70">Connect your MCP client to <code class="badge glass text-xs font-mono">/mcp</code></span>
      </li>
      <li class="flex items-center gap-3">
        <span class="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary/20 text-xs font-bold text-primary">2</span>
        <span class="text-base-content/70">Use <code class="badge glass text-xs font-mono">store_memory</code> tool to save memories</span>
      </li>
      <li class="flex items-center gap-3">
        <span class="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary/20 text-xs font-bold text-primary">3</span>
        <span class="text-base-content/70">Use <code class="badge glass text-xs font-mono">retrieve_memory</code> for hybrid semantic search</span>
      </li>
    </ol>
  </div>
</div>
