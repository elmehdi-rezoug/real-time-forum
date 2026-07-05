import { renderNavbar } from '../navbar.js';
import { loadPosts, filterPosts, clearFilters } from '../posts.js';
import { renderChatSidebar, loadUsers } from '../listusers.js';
import { connectWS } from '../ws.js';

export function renderHome() {
  const app = document.getElementById('app');
  if (window.location.pathname !== '/') window.history.pushState({}, '', '/');

  app.innerHTML = `
    ${renderNavbar()}
    <div class="container">
      <aside class="sidebar">
        <h3>Filter Posts</h3>
        <div class="filter-group">
          <h4>By Category</h4>
          <label><input type="checkbox" value="General"     onchange="window._filterPosts()"> General</label>
          <label><input type="checkbox" value="Programming" onchange="window._filterPosts()"> Programming</label>
          <label><input type="checkbox" value="Gaming"      onchange="window._filterPosts()"> Gaming</label>
          <label><input type="checkbox" value="Movies"      onchange="window._filterPosts()"> Movies</label>
          <label><input type="checkbox" value="Sports"      onchange="window._filterPosts()"> Sports</label>
        </div>
        <button class="clear-btn" onclick="window._clearFilters()">Clear Filters</button>

        ${renderChatSidebar()}
      </aside>

      <main class="content">
        <div id="posts-container">Loading feed...</div>
      </main>

      <aside class="chat-panel-dock" id="chat-panel-dock"></aside>
    </div>`;

  loadPosts();
  loadUsers();
  connectWS();
}
