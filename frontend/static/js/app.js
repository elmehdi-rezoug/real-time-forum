const app = document.getElementById('app');

document.addEventListener('DOMContentLoaded', () => {
  if (!app) {
    console.error('App container not found');
    return;
  }

  renderLogin();
});

// ---------------- LOGIN UI ----------------
function renderLogin() {
  app.innerHTML = `
    <h2>Login</h2>

    <input id="login-id" placeholder="Email or Nickname">
    <input id="login-pass" type="password" placeholder="Password">

    <button type="button" onclick="login()">Login</button>
    <p onclick="renderRegister()">Create account</p>
  `;
}

// ---------------- REGISTER UI ----------------
function renderRegister() {
  app.innerHTML = `
    <h2>Register</h2>

    <input id="nickname" placeholder="nickname" >
    <input id="first_name" placeholder="first name">
    <input id="last_name" placeholder="last name">
    <input id="age" type="number" placeholder="age">

    <select id="gender">
      <option value="">Select gender</option>
      <option value="male">male</option>
      <option value="female">female</option>
    </select>

    <input id="email" placeholder="email">
    <input id="password" type="password" placeholder="password">
    <input id="confirm_password" type="password" placeholder="confirm password">

    <button type="button" onclick="register()">Register</button>
    <p onclick="renderLogin()">Login</p>
  `;
}

// ---------------- REGISTER ----------------
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
    if (!el) {
      alert('Missing field: ' + id);
      return;
    }
    data[id] = el.value;
  }

  // Remove any old error message if it exists
  const existingError = document.getElementById('form-error');
  if (existingError) existingError.remove();

  try {
    const res = await fetch('/register', {
      method: 'POST',
      body: new URLSearchParams(data),
    });

    const result = await res.json();

    if (!res.ok) {
      // Create a nice red message block on top of the form instead of just an alert
      const errorDiv = document.createElement('div');
      errorDiv.id = 'form-error';
      errorDiv.style.color = '#e74c3c';
      errorDiv.style.marginBottom = '15px';
      errorDiv.style.fontWeight = '600';
      errorDiv.innerText = result.error || 'Registration failed';

      // Insert it right under the "Register" heading
      const heading = document.querySelector('#app h2');
      heading.insertAdjacentElement('afterend', errorDiv);
      return;
    }

    alert(result.message || 'Success!');
    renderLogin();
  } catch (err) {
    console.error('Register network error:', err);
  }
}

// ---------------- LOGIN (placeholder) ----------------
async function login() {
  const data = {
    login: document.getElementById('login-id').value,
    password: document.getElementById('login-pass').value,
  };

  try {
    const res = await fetch('/login', {
      method: 'POST',
      body: new URLSearchParams(data),
    });

    const result = await res.json();
    if (!res.ok) {
      // Use result.error since HandleError sends {"error": "..."}
      alert(result.error || 'Registration failed');
      return;
    }

    alert(result.message || 'Success!');
    renderLogin();
  } catch (err) {
    console.error('Login error:', err);
  }
}
