export function escapeHTML(str) {
  if (typeof str !== 'string') return '';
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

/**
 * Returns the inner HTML for a single post card.
 * Shared by posts.js (renderPosts) and ws.js (prependPost).
 */
export function postCardHTML(post) {
  return `
    <div class="post-header">
      <h3>${escapeHTML(post.title)}</h3>
      <div class="post-categories">
        <span class="category">${escapeHTML(post.category_name)}</span>
      </div>
    </div>
    <div class="post-body">
      <p>${escapeHTML(post.content)}</p>
    </div>`;
}
