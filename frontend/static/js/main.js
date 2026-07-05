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
import { disconnectWS } from './ws.js';
import { reactToPost } from './reactions.js';
import { openChatPanel, closeChatPanel } from './chatpanel.js';

window._react = reactToPost;
window._openChat = openChatPanel;
window._closeChat = closeChatPanel;
window._nav = navigateTo;
window._logout = async () => {
  disconnectWS();
  await handleLogout();
};
window._login = login;
window._register = register;
window._loadPosts = loadPosts;
window._loadMorePosts = loadMorePosts;
window._filterPosts = filterPosts;
window._clearFilters = clearFilters;
window._renderCreatePostForm = renderCreatePostForm;
window._submitPost = submitPost;

document.addEventListener('DOMContentLoaded', async () => {
  const app = document.getElementById('app');
  if (!app) {
    console.error('#app not found');
    return;
  }
  await initAuth();
  router();
});

window.addEventListener('popstate', () => router());
