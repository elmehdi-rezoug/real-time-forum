import { renderHome } from './pages/home.js';
import { renderLogin } from './pages/login.js';
import { renderRegister } from './pages/register.js';
import { renderError } from './pages/error.js';
import { state } from './state.js';
import { renderPostPage } from './pages/post.js';

export function router() {
  const path = location.pathname;

  const publicPaths = ['/login', '/register'];
  const knownPaths = ['/', ...publicPaths];
  const auth = state.auth.authenticated;

  const isPostRoute = path.startsWith('/posts/');
  const isknown = knownPaths.includes(path) || isPostRoute;

  if (!isknown) {
    renderError(404);
    return;
  }

  if (!auth && !publicPaths.includes(path)) {
    navigateTo('/login');
    return;
  }

  if (path === '/') {
    renderHome();
  } else if (path === '/login') {
    renderLogin();
  } else if (path === '/register') {
    renderRegister();
  } else if (isPostRoute) {
    const parts = path.split('/');
    const postId = parts[2]; //  the URL is in the format /posts/:id
    if (isNaN(postId)) {
      renderError(400);
      return;
    } else {
      renderPostPage(postId);
    }
  }
}

export function navigateTo(path) {
  history.pushState({}, '', path);
  router();
}
