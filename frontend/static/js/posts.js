import { state } from './state.js';
import { navigateTo } from './routeer.js';
import { displayMessage } from './toast.js';
import { escapeHTML, postCardHTML } from './utils.js';

let allPosts = [];
const PAGE_SIZE = 10;
let offset = 0;
let hasMore = true;
let isLoading = false;
let activeCategories = [];
let snapshotMaxId = null;

//  LOAD POSTS (first page)
export async function loadPosts() {
  const container = document.getElementById('posts-container');
  if (!container) return;

  allPosts = [];
  offset = 0;
  hasMore = true;
  snapshotMaxId = null; // fresh load -> recompute the snapshot from scratch
  activeCategories = getCheckedCategories();

  try {
    const page = await fetchPostsPage(0);
    allPosts = page;
    offset = page.length;
    hasMore = page.length === PAGE_SIZE;
    renderPosts(allPosts);
  } catch (err) {
    console.error('loadPosts error:', err);
    container.innerHTML = `<p class="error-text">Failed to load posts. Please try again.</p>`;
  }
}

//  LOAD MORE
export async function loadMorePosts() {
  if (isLoading || !hasMore) return;
  isLoading = true;

  try {
    const page = await fetchPostsPage(offset);
    allPosts.push(...page);
    offset += page.length;
    hasMore = page.length === PAGE_SIZE;
    renderPosts(allPosts);
  } catch (err) {
    console.error('loadMorePosts error:', err);
    displayMessage('Failed to load more posts', true);
  } finally {
    isLoading = false;
  }
}

//  FETCH ONE PAGE
async function fetchPostsPage(pageOffset) {
  const params = new URLSearchParams({ limit: PAGE_SIZE, offset: pageOffset });
  activeCategories.forEach((cat) => params.append('category', cat));
  if (snapshotMaxId !== null) params.set('before', snapshotMaxId);

  const res = await fetch(`/api/posts?${params.toString()}`);
  if (!res.ok) throw new Error('Failed to fetch posts');

  if (snapshotMaxId === null) {
    const headerMaxId = res.headers.get('X-Max-Post-Id');
    if (headerMaxId !== null) snapshotMaxId = parseInt(headerMaxId);
  }

  return res.json();
}

function getCheckedCategories() {
  return Array.from(
    document.querySelectorAll('.sidebar input[type=checkbox]:checked')
  ).map((cb) => cb.value);
}

//FILTER
export async function filterPosts() {
  await loadPosts();
}

export async function clearFilters() {
  document
    .querySelectorAll('.sidebar input[type=checkbox]')
    .forEach((cb) => (cb.checked = false));
  await loadPosts();
}

//  RENDER POSTS
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

  const cards = posts
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
          Load more
        </button>
       </div>`
    : '';

  container.innerHTML = `${createBtn}<div class="posts-list">${cards}</div>${loadMoreBtn}`;
}

//  CREATE POST FORM
export async function renderCreatePostForm() {
  const container = document.getElementById('posts-container');
  if (!container) return;

  try {
    const res = await fetch('/api/categories');
    if (!res.ok) throw new Error('Failed to fetch categories');
    const categories = await res.json();
    const options = categories
      .map(
        (c) =>
          `<label><input type="checkbox" name="categories" value="${c.id}" /> ${c.name}</label>`
      )
      .join('');

    container.innerHTML = `
      <div class="create-post-form">
        <h3>Create a New Post</h3>
        <input id="post-title" placeholder="Post title" maxlength="200">
        <div id="post-category">
          <a>Select categories</a>
          ${options}
        </div>
        <textarea id="post-content" placeholder="Write your post..." maxlength="2000" rows="5"></textarea>
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

//  SUBMIT POST
export async function submitPost() {
  const title = document.getElementById('post-title')?.value.trim();
  const content = document.getElementById('post-content')?.value.trim();
  const categories = Array.from(
    document.querySelectorAll('#post-category input[name="categories"]:checked')
  ).map((cb) => cb.value);
  if (!title || !content || categories.length === 0) {
    displayMessage('All fields are required', true);
    return;
  }
  const data = new URLSearchParams();
  data.append('title', title);
  data.append('content', content);
  categories.forEach((cat) => {
    data.append('categories', cat);
  });

  try {
    const res = await fetch('/api/posts/create', {
      method: 'POST',
      body: data,
    });
    if (!res.ok) {
      const error = await res.json();
      displayMessage(error.error, true);
      return;
    }
    await loadPosts();
    displayMessage('Post created successfully', false);
  } catch (err) {
    console.error('submitPost error:', err);
    displayMessage('Network error. Please try again.', true);
  }
}
