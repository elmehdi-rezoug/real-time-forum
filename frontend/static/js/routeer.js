import { renderHome } from './pages/home.js';
import { renderLogin } from './pages/login.js';
import { renderRegister } from './pages/register.js';
import { renderError } from './pages/error.js';
import { state } from './state.js';

export function router() {
  const path = location.pathname;

  const publicPaths = ['/login', '/register'];
  const auth = state.auth.authenticated;
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
  } else {
    renderError(404);
  }
}

export function navigateTo(path) {
  history.pushState({}, '', path);
  router();
}
