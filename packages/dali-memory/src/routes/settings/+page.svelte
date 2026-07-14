<script lang="ts">
  import { page } from '$app/stores';
  import { enhance } from '$app/forms';

  let { data, form } = $props();
  let config = $derived(data.config || {});
  let apiKeys = $derived(data.apiKeys || []);
  let newKeyName = $state('');

  function formatDate(d: string | null) {
    if (!d) return 'Never';
    return new Date(d).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
  }
</script>

<div class="space-y-8">
  <h1 class="font-heading text-2xl font-bold bg-gradient-to-r from-primary to-secondary bg-clip-text text-transparent">Settings</h1>

  <!-- New key notification -->
  {#if form?.newKey}
    <div role="alert" class="alert alert-success">
      <span class="font-medium">API Key Generated: {form.keyName}</span>
      <span>Copy this key now — it will not be shown again:</span>
      <code class="block break-all bg-base-200 px-3 py-2 rounded text-sm">{form.newKey}</code>
    </div>
  {/if}

  {#if form?.success && !form?.newKey}
    <div role="alert" class="alert alert-success">
      <span>Done.</span>
    </div>
  {/if}
  {#if form?.error}
    <div role="alert" class="alert alert-error">
      <span>{form.error}</span>
    </div>
  {/if}

  <!-- Profile section -->
  {#if $page.data.authenticated}
    <div class="glass rounded-2xl animate-fade-in animate-slide-up p-6">
      <div class="space-y-4">
        <h2 class="text-lg font-bold">Profile</h2>
        <form method="POST" action="?/update-profile" class="space-y-3" use:enhance>
          <div>
            <label for="name" class="mb-1 block text-sm font-medium">Name</label>
            <input name="name" id="name" type="text" value={$page.data.name ?? ''} required class="input input-bordered w-full" />
          </div>
          <div>
            <label for="email" class="mb-1 block text-sm font-medium">Email</label>
            <input name="email" id="email" type="email" value={$page.data.userEmail ?? ''} required class="input input-bordered w-full" />
          </div>
          <button type="submit" class="btn btn-primary">Save</button>
        </form>
        {#if form?.success}
          <div role="alert" class="alert alert-success">
            <span>Profile updated.</span>
          </div>
        {/if}
        {#if form?.error}
          <div role="alert" class="alert alert-error">
            <span>{form.error}</span>
          </div>
        {/if}
      </div>
    </div>
  {/if}

  <!-- Config section -->
  <div class="glass rounded-2xl animate-fade-in animate-slide-up p-6">
    <div class="space-y-4">
      <h2 class="text-lg font-bold">Configuration</h2>
      <div class="overflow-x-auto">
        <table class="table">
          <tbody>
            {#each Object.entries(config) as [key, val]}
              <tr>
                <td class="font-medium">{key}</td>
                <td>{String(val)}</td>
              </tr>
            {/each}
          </tbody>
        </table>
      </div>
    </div>
  </div>

  <!-- API Keys section -->
  <div class="glass rounded-2xl animate-fade-in animate-slide-up p-6">
    <div class="space-y-4">
      <h2 class="text-lg font-bold">API Keys</h2>

      <!-- Generate key form -->
      <form method="POST" action="?/generate-key" class="flex items-end gap-3 mb-4" use:enhance>
        <div class="flex-1">
          <label for="key-name" class="mb-1 block text-sm font-medium">New Key Name</label>
          <input name="name" id="key-name" type="text" bind:value={newKeyName} placeholder="e.g. my-claude-client" class="input input-bordered w-full" />
        </div>
        <button type="submit" class="btn btn-primary">Generate</button>
      </form>

      <!-- Key list -->
      {#if apiKeys.length === 0}
        <p class="text-sm opacity-60">No API keys yet.</p>
      {:else}
        <div class="space-y-2">
          {#each apiKeys as key}
            <div class="glass rounded-xl p-4">
                <div class="flex items-center justify-between">
                  <div>
                    <p class="text-sm font-medium">{key.name}</p>
                    <p class="text-xs opacity-50">Created: {formatDate(key.created_at)} | Last used: {formatDate(key.last_used_at)}</p>
                  </div>
                  <form method="POST" action="?/delete-key" use:enhance={({ cancel }) => { if (!confirm('Delete this API key?')) cancel(); }}>
                    <input type="hidden" name="id" value={key.id} />
                    <button type="submit" class="btn btn-ghost btn-xs text-error">Revoke</button>
                  </form>
                </div>
            </div>
          {/each}
        </div>
      {/if}
    </div>
  </div>
</div>
