import { renderNavbar } from '../navbar.js';

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

export function renderError(status) {
  const app = document.getElementById('app');
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
      <button class="btn primary" data-action="nav" data-target="/">Back to Home</button>
    </div>`;
}
