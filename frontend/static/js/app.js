// =====================================================================
//  app.js  —  Router + Auth + Layout
// =====================================================================

const app = document.getElementById('app');

// ---------------- AUTH STATE ----------------
// Single source of truth — populated by /api/me on every page load.
// Never read document.cookie to determine login status.
let authState = { authenticated: false, user: null };

async function initAuth() {
  try {
    const res = await fetch('/api/me');
    if (!res.ok) throw new Error('auth check failed');
    authState = await res.json();
  } catch (err) {
    console.error('initAuth error:', err);
    authState = { authenticated: false, user: null };
  }
}

document.addEventListener('DOMContentLoaded', async () => {
  if (!app) {
    console.error('App container not found');
    return;
  }
  await initAuth();
  router();
});

window.addEventListener('popstate', () => router());

// ---------------- ROUTER ----------------
function router() {
  const path = window.location.pathname;

  if (path === '/register') {
    renderRegister();
  } else if (path === '/login') {
    renderLogin();
  } else if (path === '/') {
    renderHome();
  } else {
    renderError(404);
  }
}

function navigateTo(path) {
  window.history.pushState({}, '', path);
  router();
}

// ---------------- MESSAGE ----------------
function displayMessage(message, isError = true) {
  const existing = document.getElementById('form-message');
  if (existing) existing.remove();

  const div = document.createElement('div');
  div.id = 'form-message';
  div.classList.add(isError ? 'is-error' : 'is-success');
  div.innerText = message;

  const heading = document.querySelector('#app h2');
  if (heading) heading.insertAdjacentElement('afterend', div);
  else app.prepend(div);
}

// ---------------- NAVBAR ----------------
function renderNavbar() {
  return `
    <header class="navbar">
      <div class="logo" onclick="navigateTo('/')">01Forum</div>
      <div class="auth-buttons">
        ${
          authState.authenticated
            ? `<span class="nav-username">${escapeHTML(authState.user?.nickname || '')}</span>
               <button class="btn logout" onclick="handleLogout()">Logout</button>`
            : `<button class="btn login"    onclick="navigateTo('/login')">Login</button>
               <button class="btn register" onclick="navigateTo('/register')">Register</button>`
        }
      </div>
    </header>`;
}

// ---------------- HOME LAYOUT ----------------
function renderHome() {
  if (window.location.pathname !== '/') window.history.pushState({}, '', '/');

  app.innerHTML = `
    ${renderNavbar()}
    <div class="container">
      <aside class="sidebar">
        <h3>Filter Posts</h3>
        <div class="filter-group">
          <h4>By Category</h4>
          <label><input type="checkbox" value="General"        onchange="filterPosts()"> General</label>
          <label><input type="checkbox" value="Programming"    onchange="filterPosts()"> Programming</label>
          <label><input type="checkbox" value="Gaming"         onchange="filterPosts()"> Gaming</label>
          <label><input type="checkbox" value="Movies"         onchange="filterPosts()"> Movies</label>
          <label><input type="checkbox" value="Sports"         onchange="filterPosts()"> Sports</label>
        </div>
        <button class="clear-btn" onclick="clearFilters()">Clear Filters</button>
      </aside>

      <main class="content">
        <div id="posts-container">Loading feed...</div>
      </main>
    </div>`;

  loadPosts();
}

// ---------------- LOGIN UI ----------------
function renderLogin() {
  if (authState.authenticated) {
    navigateTo('/');
    return;
  }
  if (window.location.pathname !== '/login')
    window.history.pushState({}, '', '/login');

  app.innerHTML = `
    ${renderNavbar()}
    <div class="auth-shell">
      <h2>Login</h2>
      <input id="login-id"   placeholder="Email or Nickname">
      <input id="login-pass" type="password" placeholder="Password">
      <button type="button" onclick="login()">Login</button>
    </div>`;
}

// ---------------- REGISTER UI ----------------
function renderRegister() {
  if (authState.authenticated) {
    navigateTo('/');
    return;
  }
  if (window.location.pathname !== '/register')
    window.history.pushState({}, '', '/register');

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
      <button type="button" onclick="register()">Register</button>
    </div>`;
}

// ---------------- REGISTER ACTION ----------------
async function register() {
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
  for (let id of required) {
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

// ---------------- LOGIN ACTION ----------------
async function login() {
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
    // Re-verify with the server — never trust client-side state for auth
    await initAuth();
    navigateTo('/');
  } catch (err) {
    console.error('Login error:', err);
    displayMessage('Network error, please try again', true);
  }
}

// ---------------- LOGOUT ACTION ----------------
async function handleLogout() {
  try {
    await fetch('/logout', { method: 'POST' });
  } catch (err) {
    console.error(err);
  }
  // Reset local state and re-render — server already cleared the cookie
  authState = { authenticated: false, user: null };
  navigateTo('/');
}

// ---------------- ERROR PAGE ----------------
const ERROR_META = {
  400: {
    title: 'Bad Request',
    desc: 'The server could not understand your request.',
  },
  401: {
    title: 'Unauthorized',
    desc: 'You need to be logged in to access this page.',
  },
  403: {
    title: 'Forbidden',
    desc: "You don't have permission to access this page.",
  },
  404: {
    title: 'Page Not Found',
    desc: "The page you're looking for doesn't exist or has been moved.",
  },
  500: {
    title: 'Internal Server Error',
    desc: 'Something went wrong on our end. Please try again later.',
  },
  503: {
    title: 'Service Unavailable',
    desc: 'The server is temporarily unavailable. Please try again later.',
  },
};

function renderError(status) {
  const meta = ERROR_META[status] || {
    title: 'Unexpected Error',
    desc: 'Something went wrong.',
  };

  app.innerHTML = `
    ${renderNavbar()}
    <div class="error-page">
      <div class="error-code">${status}</div>
      <h2 class="error-title">${meta.title}</h2>
      <p class="error-desc">${meta.desc}</p>
      <button class="btn primary" onclick="navigateTo('/')">Back to Home</button>
    </div>`;
}
