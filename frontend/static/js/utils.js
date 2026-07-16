import { renderReactionBar } from './reactions.js';
export function postCardHTML(p) {
  const categoriesHtml = (p.categories || [])
    .map((c) => `<span class="category-tag">${escapeHTML(c)}</span>`)
    .join(' ');
  return `
  <h3>author: ${escapeHTML(p.nickname)}</h3>
    <h3>${escapeHTML(p.title)}</h3>
    <p>${escapeHTML(p.content)}</p>
    <div class="post-categories">${categoriesHtml}</div>
    ${renderReactionBar(p)}
  `;
}

// Generates the HTML string for a single comment, formatting the date chronologically
export function commentHTML(c) {
  const date = new Date(c.created_at);
  return `
    <div class="comment">
      <p><strong>${escapeHTML(c.nickname)}</strong> - ${timeAgo(c.created_at)}</p>
      <p>${escapeHTML(c.content)}</p>
    </div>
  `;
}

// Generates the HTML string for the "Load More Comments" button if there are more comments to load
export function loadMoreCommentsBtnHTML(hasMore, postId) {
  if (!hasMore) return '<div id="comments-load-more-wrap"></div>';
  return `
    <div class="load-more-wrap" id="comments-load-more-wrap">
      <button class="btn load-more-btn" data-action="load-more-comments" data-post-id="${postId}">
        Load more comments
      </button>
    </div>
  `;
}

// Output example: "1s ago", "5m ago", "2h ago", "3d ago"
export function timeAgo(dateStr) {
  const now = new Date();
  const date = new Date(dateStr);
  const diffInSeconds = Math.floor((now - date) / 1000);

  if (diffInSeconds < 60) {
    return `${diffInSeconds}s ago`;
  } else if (diffInSeconds < 60 * 60) {
    const minutes = Math.floor(diffInSeconds / 60);
    return `${minutes}m ago`;
  } else if (diffInSeconds < 60 * 60 * 24) {
    const hours = Math.floor(diffInSeconds / 3600);
    return `${hours}h ago`;
  } else {
    const days = Math.floor(diffInSeconds / (60 * 60 * 24));
    return `${days}d ago`;
  }
}

export function escapeHTML(str) {
  if (typeof str !== 'string') return '';
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}
