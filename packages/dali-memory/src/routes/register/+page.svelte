<script lang="ts">
  let { form } = $props();
</script>

<div class="hero min-h-[60vh]">
  <div class="hero-content w-full max-w-sm">
    <div class="card glass rounded-2xl w-full animate-fade-in animate-slide-up">
      <div class="card-body">
        <h1 class="card-title text-2xl font-heading bg-gradient-to-r from-primary to-secondary bg-clip-text text-transparent">dali-memory</h1>
        <p class="text-sm opacity-70 mb-4 font-body">Create an account to get started</p>

        <form method="POST" class="space-y-4 animate-fade-in" style="animation-delay: 150ms">
          <div>
            <label for="email" class="mb-1 block text-sm font-medium">Email</label>
            <input
              id="email"
              name="email"
              type="email"
              required
              class="input input-bordered w-full"
              placeholder="you@example.com"
            />
          </div>
          <div>
            <label for="password" class="mb-1 block text-sm font-medium">Password</label>
            <input
              id="password"
              name="password"
              type="password"
              required
              minlength="8"
              class="input input-bordered w-full"
              placeholder="At least 8 characters"
            />
          </div>
          <div>
            <label for="confirm_password" class="mb-1 block text-sm font-medium">Confirm Password</label>
            <input
              id="confirm_password"
              name="confirm_password"
              type="password"
              required
              class="input input-bordered w-full"
              placeholder="Repeat your password"
            />
          </div>

          {#if form?.error}
            <div role="alert" class="alert alert-error">
              <span>{form.error}</span>
            </div>
          {/if}

          <button
            type="submit"
            class="btn btn-primary w-full"
          >
            Create Account
          </button>
        </form>

        <p class="mt-4 text-center text-sm opacity-70">
          Already have an account?
          <a href="/login" class="link link-primary">Sign in</a>
        </p>
      </div>
    </div>
  </div>
</div>
