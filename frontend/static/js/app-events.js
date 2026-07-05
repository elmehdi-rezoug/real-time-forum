import { router, navigateTo } from './routeer.js';
import {
  loadPosts,
  loadMorePosts,
  filterPosts,
  clearFilters,
  renderCreatePostForm,
  submitPost,
} from './posts.js';
import { reactToPost } from './reactions.js';
import { openChatPanel, closeChatPanel } from './chatpanel.js';
import { disconnectWS } from './ws.js';
import { handleLogout } from './auth.js';
import { login } from './pages/login.js';
import { register } from './pages/register.js';

export function initAppEvents() {
  // Delegated click handler for declarative `data-action` wiring
  document.body.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-action]');
    if (!btn) return;
    const action = btn.dataset.action;
    if (!action) return;
    e.preventDefault();

    switch (action) {
      case 'nav': {
        const target = btn.dataset.target;
        if (target) navigateTo(target);
        break;
      }
      case 'logout': {
        disconnectWS();
        handleLogout();
        break;
      }
      case 'open-chat': {
        const userId =
          btn.dataset.userId || btn.closest('[data-user-id]')?.dataset.userId;
        if (userId) openChatPanel(Number(userId));
        break;
      }
      case 'close-chat': {
        closeChatPanel();
        break;
      }
      case 'render-create-post': {
        renderCreatePostForm();
        break;
      }
      case 'load-more': {
        loadMorePosts();
        break;
      }
      case 'submit-post': {
        submitPost();
        break;
      }
      case 'login': {
        login();
        break;
      }
      case 'register': {
        register();
        break;
      }
      case 'load-posts': {
        loadPosts();
        break;
      }
      case 'clear-filters': {
        clearFilters();
        break;
      }
      case 'react': {
        const postId = btn.dataset.postId;
        const type = btn.dataset.reactionType;
        if (postId && type) reactToPost(Number(postId), type);
        break;
      }
      default:
        break;
    }
  });

  // Delegated change handler for filter checkboxes
  document.body.addEventListener('change', (e) => {
    const el = e.target;
    if (el && el.matches('.sidebar input[type="checkbox"]')) {
      filterPosts();
    }
  });

  // Keep history navigation centralized
  addEventListener('popstate', () => router());
}
