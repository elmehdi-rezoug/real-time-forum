import { renderNavbar } from '../navbar.js';
import { loadPosts } from '../posts.js';

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

  loadPosts();
}
