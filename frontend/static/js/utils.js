import { renderReactionBar } from './reactions.js';
export function postCardHTML(p) {
  return `
  <h3>author: ${escapeHTML(p.nickname)}</h3>
    <h3>${escapeHTML(p.title)}</h3>
    <p>${escapeHTML(p.content)}</p>
    <span class="category-tag">${escapeHTML(p.category_name)}</span>
    ${renderReactionBar(p)}
  `;
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
