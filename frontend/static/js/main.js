import { initAuth, state } from './state.js';
import { router } from './routeer.js';
import { initAuthSync } from './auth.js';
import { initAppEvents } from './app-events.js';
import { initWebSocket } from './chatpanel.js';

document.addEventListener('DOMContentLoaded', async () => {
  const app = document.getElementById('app');
  if (!app) {
    console.error('#app not found');
    return;
  }
  initAuthSync();
  await initAuth();
  initAppEvents();

  // Initialize WebSocket if user is authenticated
  if (state.auth && state.auth.authenticated) {
    initWebSocket();
  }

  router();
});
