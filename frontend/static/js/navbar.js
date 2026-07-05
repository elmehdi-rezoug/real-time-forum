import { state } from './state.js';
import { escapeHTML } from './utils.js';

export function renderNavbar() {
  return `
    <header class="navbar">
      <div class="logo" data-action="nav" data-target="/">01Forum</div>
      <div class="auth-buttons">
        ${
          state.auth.authenticated
            ? `<span class="nav-username">${escapeHTML(
                state.auth.nickname || ''
              )}</span>
               <button class="btn logout" data-action="logout">Logout</button>`
            : `<button class="btn login" data-action="nav" data-target="/login">Login</button>
               <button class="btn register" data-action="nav" data-target="/register">Register</button>`
        }
      </div>
    </header>`;
}
