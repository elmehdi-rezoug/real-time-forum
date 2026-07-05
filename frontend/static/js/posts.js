import { state } from './state.js';
import { navigateTo } from './routeer.js';
import { displayMessage } from './toast.js';
import { escapeHTML, postCardHTML } from './utils.js';

let allPosts = [];
let visibleCount = 10;
const PAGE_SIZE = 10;

// ---------------- LOAD POSTS ----------------
export async function loadPosts() {
  const container = document.getElementById('posts-container');
  if (!container) return;

  visibleCount = PAGE_SIZE;

  try {
    const res = await fetch('/api/posts');
    if (!res.ok) throw new Error('Failed to fetch posts');
    allPosts = await res.json();
    renderPosts(allPosts);
  } catch (err) {
    console.error('loadPosts error:', err);
    container.innerHTML = `<p class="error-text">Failed to load posts. Please try again.</p>`;
  }
}

// ---------------- LOAD MORE ----------------
export function loadMorePosts() {
  visibleCount += PAGE_SIZE;
  const source = getFilteredPosts();
  renderPosts(source);
}

// ---------------- FILTER ----------------
export function filterPosts() {
  visibleCount = PAGE_SIZE;
  renderPosts(getFilteredPosts());
}

export function clearFilters() {
  visibleCount = PAGE_SIZE;
  document
    .querySelectorAll('.sidebar input[type=checkbox]')
    .forEach((cb) => (cb.checked = false));
  renderPosts(allPosts);
}

function getFilteredPosts() {
  const checked = Array.from(
    document.querySelectorAll('.sidebar input[type=checkbox]:checked')
  ).map((cb) => cb.value);
  return checked.length === 0
    ? allPosts
    : allPosts.filter((p) => checked.includes(p.category_name));
}

// ---------------- RENDER POSTS ----------------
function renderPosts(posts) {
  const container = document.getElementById('posts-container');
  if (!container) return;

  const createBtn = state.auth.authenticated
    ? `<button class="btn primary create-post-btn" data-action="render-create-post">+ New Post</button>`
    : '';

  if (!posts || posts.length === 0) {
    container.innerHTML = `${createBtn}<p class="empty-feed">No posts found.</p>`;
    return;
  }

  const visible = posts.slice(0, visibleCount);
  const hasMore = posts.length > visibleCount;

  const cards = visible
    .map(
      (p) => `
    <article class="post">
      ${postCardHTML(p)}
    </article>
  `
    )
    .join('');

  const loadMoreBtn = hasMore
    ? `<div class="load-more-wrap">
        <button class="btn load-more-btn" data-action="load-more">
          Load more <span class="load-more-count">(${
            posts.length - visibleCount
          } remaining)</span>
        </button>
       </div>`
    : '';

  container.innerHTML = `${createBtn}<div class="posts-list">${cards}</div>${loadMoreBtn}`;
}

// ---------------- CREATE POST FORM ----------------
export async function renderCreatePostForm() {
  const container = document.getElementById('posts-container');
  if (!container) return;

  try {
    const res = await fetch('/api/categories');
    if (!res.ok) throw new Error('Failed to fetch categories');
    const categories = await res.json();
    console.log(categories);
    const options = categories
      .map((c) => `<option value="${c.id}">${c.name}</option>`)
      .join('');

    container.innerHTML = `
      <div class="create-post-form">
        <h3>Create a New Post</h3>
        <input id="post-title" placeholder="Post title" maxlength="200">
        <select id="post-category">
          <option value="">Select a category</option>
          ${options}
        </select>
        <textarea id="post-content" placeholder="Write your post..." rows="5"></textarea>
        <div class="form-actions">
          <button type="button" class="btn primary" data-action="submit-post">Publish</button>
          <button type="button" class="btn" data-action="load-posts">Cancel</button>
        </div>
      </div>`;
  } catch (err) {
    console.error('renderCreatePostForm error:', err);
    container.innerHTML = `<p class="error-text">Failed to load categories.</p>`;
  }
}

// ---------------- SUBMIT POST ----------------
export async function submitPost() {
  const title = document.getElementById('post-title')?.value.trim();
  const content = document.getElementById('post-content')?.value.trim();
  const categoryID = document.getElementById('post-category')?.value;

  if (!title || !content || !categoryID) {
    displayMessage('All fields are required', true);
    return;
  }

  try {
    const res = await fetch('/api/posts/create', {
      method: 'POST',
      body: new URLSearchParams({ title, content, categoryID }),
    });

    await loadPosts();
    displayMessage('Post created successfully', false);
  } catch (err) {
    console.error('submitPost error:', err);
    displayMessage('Network error. Please try again.', true);
  }
}
