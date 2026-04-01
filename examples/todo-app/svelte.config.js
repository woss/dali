import adapter from '@sveltejs/adapter-auto';
import { sveltekit } from '@sveltejs/kit/vite';

/** @type {import('@sveltejs/kit').Config} */
const config = {
  preprocess: sveltekit(),
  kit: {
    adapter: adapter(),
  },
};

export default config;
