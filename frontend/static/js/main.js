import { initAuth } from './state.js';
import { router, navigateTo } from './routeer.js';
import { handleLogout } from './auth.js';
import { login } from './pages/login.js';
import { register } from './pages/register.js';
import {
  loadPosts,
  loadMorePosts,
  filterPosts,
  clearFilters,
  renderCreatePostForm,
  submitPost,
} from './posts.js';
import { reactToPost } from './reactions.js';
import { initAppEvents } from './app-events.js';

document.addEventListener('DOMContentLoaded', async () => {
  const app = document.getElementById('app');
  if (!app) {
    console.error('#app not found');
    return;
  }
  await initAuth();
  initAppEvents();
  router();
});
