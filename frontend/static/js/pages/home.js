import { renderNavbar } from '../navbar.js';
import { loadPosts } from '../posts.js';
import { renderChatUsers, initWebSocket } from '../chatpanel.js';

// Function to fetch real chat users from the backend
async function fetchChatUsers() {
  try {
    const response = await fetch('/api/users');
    if (!response.ok) {
      throw new Error('Failed to fetch chat users');
    }
    const users = await response.json();
    return users;
  } catch (error) {
    console.error('Failed to fetch chat users:', error);
    return [];
  }
}

export function renderHome() {
  const app = document.getElementById('app');
  if (location.pathname !== '/') history.pushState({}, '', '/');

  app.innerHTML = `
    ${renderNavbar()}
    <div class="container">
      <div class="sidebar-col">
        <aside class="sidebar">
          <h3>Filter Posts</h3>
          <div class="filter-group">
            <h4>By Category</h4>
            <label><input type="checkbox" value="General"> General</label>
            <label><input type="checkbox" value="Programming"> Programming</label>
            <label><input type="checkbox" value="Gaming"> Gaming</label>
            <label><input type="checkbox" value="Movies"> Movies</label>
            <label><input type="checkbox" value="Sports"> Sports</label>
            <label><input type="checkbox" value="Anime"> Anime</label>
          </div>
          <button class="clear-btn" data-action="clear-filters">Clear Filters</button>
        </aside>

      </div>

      <main class="content">
        <div id="posts-container">Loading feed...</div>
      </main>

    </div>`;

  // Initialize WebSocket connection
  initWebSocket();

  // Load initial chat users (will be updated via WebSocket)
  fetchChatUsers().then((users) => {
    renderChatUsers(users);
  });

  loadPosts();
}
