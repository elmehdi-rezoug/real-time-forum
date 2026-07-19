import { initAuth } from './state.js';
import { router } from './routeer.js';
import { initAuthSync } from './auth.js';
import { initAppEvents } from './app-events.js';

document.addEventListener('DOMContentLoaded', async () => {
  const app = document.getElementById('app');
  if (!app) {
    console.error('#app not found');
    return;
  }
  initAuthSync();
  await initAuth();
  initAppEvents();
  router();
});
