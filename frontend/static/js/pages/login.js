import { state, initAuth } from '../state.js';
import { navigateTo } from '../routeer.js';
import { renderNavbar } from '../navbar.js';
import { displayMessage } from '../toast.js';

export function renderLogin() {
  const app = document.getElementById('app');

  if (state.auth.authenticated) {
    navigateTo('/');
    return;
  }
  if (location.pathname !== '/login') history.pushState({}, '', '/login');

  app.innerHTML = `
    ${renderNavbar()}
    <div class="auth-shell">
      <h2>Login</h2>
      <input id="login-id"   placeholder="Email or Nickname">
      <input id="login-pass" type="password" placeholder="Password">
      <button type="button" data-action="login">Login</button>
    </div>`;
}

export async function login() {
  const loginInput = document.getElementById('login-id');
  const passInput = document.getElementById('login-pass');

  if (!loginInput?.value.trim() || !passInput?.value.trim()) {
    displayMessage('Email/username and password are required', true);
    return;
  }

  try {
    const res = await fetch('/login', {
      method: 'POST',
      body: new URLSearchParams({
        login: loginInput.value,
        password: passInput.value,
      }),
    });
    const result = await res.json();

    if (!res.ok) {
      displayMessage(result.error || 'Login failed', true);
      return;
    }

    await initAuth();
    navigateTo('/');
  } catch (err) {
    console.error('Login error:', err);
    displayMessage('Network error, please try again', true);
  }
}
