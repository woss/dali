import { redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ cookies }) => {
  cookies.delete('dali_session', { path: '/' });
  redirect(303, '/login');
};
