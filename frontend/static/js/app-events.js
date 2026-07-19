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
import { handleLogout } from './auth.js';
import { login } from './pages/login.js';
import { register } from './pages/register.js';
import {
  fetchPostAndComments,
  loadMoreComments,
  submitComment,
} from './comments.js';
import {
  closeChatPanel,
  openChatPanel,
  sendActiveChatMessage,
  handleSocketChatEvent,
  handleSocketStatusEvent,
} from './chatpanel.js';

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
        handleLogout();
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
      case 'view-post': {
        const postId = btn.dataset.postId;
        if (postId) navigateTo(`/posts/${postId}`);
        break;
      }
      case 'submit-comment': {
        const postId = btn.dataset.postId;
        if (postId) submitComment(Number(postId));
        break;
      }
      case 'load-more-comments': {
        const postId = btn.dataset.postId;
        if (postId) loadMoreComments(Number(postId));
        break;
      }
      case 'open-chat': {
        const userId = btn.dataset.userId;
        if (userId) openChatPanel(userId);
        break;
      }
      case 'close-chat': {
        closeChatPanel();
        break;
      }
      case 'send-chat-message': {
        sendActiveChatMessage();
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

  // Keyboard interactions for chat controls rendered dynamically
  document.body.addEventListener('keydown', (e) => {
    const target = e.target;
    if (!(target instanceof HTMLElement)) return;

    if (
      target.matches('.chat-user-item') &&
      (e.key === 'Enter' || e.key === ' ')
    ) {
      e.preventDefault();
      const userId = target.dataset.userId;
      if (userId) openChatPanel(userId);
      return;
    }

    if (target.matches('.chat-input') && e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendActiveChatMessage();
    }
  });

  // Socket-driven custom events dispatched by chatpanel's WS handler
  document.addEventListener('chat:socket-chat', (e) => {
    handleSocketChatEvent(e.detail);
  });
  document.addEventListener('chat:socket-status', (e) => {
    handleSocketStatusEvent(e.detail);
  });
}
