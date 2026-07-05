import { state } from '../state.js';
import { navigateTo } from '../routeer.js';
import { renderNavbar } from '../navbar.js';
import { displayMessage } from '../toast.js';

export function renderRegister() {
  const app = document.getElementById('app');

  if (state.auth.authenticated) {
    navigateTo('/');
    return;
  }
  if (location.pathname !== '/register') history.pushState({}, '', '/register');

  app.innerHTML = `
    ${renderNavbar()}
    <div class="auth-shell">
      <h2>Register</h2>
      <input id="nickname"         placeholder="Nickname">
      <input id="first_name"       placeholder="First name">
      <input id="last_name"        placeholder="Last name">
      <input id="age" type="number" placeholder="Age">
      <select id="gender">
        <option value="">Select gender</option>
        <option value="male">Male</option>
        <option value="female">Female</option>
      </select>
      <input id="email"            placeholder="Email">
      <input id="password"         type="password" placeholder="Password">
      <input id="confirm_password" type="password" placeholder="Confirm password">
      <button type="button" data-action="register">Register</button>
    </div>`;
}

export async function register() {
  const required = [
    'nickname',
    'first_name',
    'last_name',
    'age',
    'gender',
    'email',
    'password',
    'confirm_password',
  ];

  const data = {};
  for (const id of required) {
    const el = document.getElementById(id);
    if (!el || el.value.trim() === '') {
      displayMessage('All fields are required', true);
      return;
    }
    data[id] = el.value;
  }

  try {
    const res = await fetch('/register', {
      method: 'POST',
      body: new URLSearchParams(data),
    });
    const result = await res.json();

    if (!res.ok) {
      displayMessage(result.error || 'Registration failed', true);
      return;
    }

    localStorage.setItem(
      'flash_message',
      result.message || 'Account created successfully!'
    );
    navigateTo('/login');
  } catch (err) {
    console.error('Register error:', err);
    displayMessage('Network error, please try again', true);
  }
}
