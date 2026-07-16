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
