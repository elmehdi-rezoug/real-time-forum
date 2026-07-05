import { state } from './state.js';
import { escapeHTML } from './utils.js';

// ---- sidebar shell --------------------------------------------------

export function renderChatSidebar() {
  return `
    <aside class="chat-sidebar">
      <div class="chat-sidebar-head">
        <span class="chat-sidebar-title">Users</span>
        <span class="chat-online-count" id="chat-online-count">—</span>
      </div>
      <div class="chat-user-list" id="chat-user-list">
        <div class="chat-empty-list">Loading…</div>
      </div>
    </aside>`;
}

// ---- sort -----------------------------------------------------------

function getSorted(users) {
  const withMsg = users
    .filter((u) => u.last_message_time)
    .sort(
      (a, b) => new Date(b.last_message_time) - new Date(a.last_message_time)
    );

  const withoutMsg = users
    .filter((u) => !u.last_message_time)
    .sort((a, b) => a.nickname.localeCompare(b.nickname));

  return [...withMsg, ...withoutMsg];
}

// ---- render (exported so ws.js can call it on live updates) ---------

export function renderUserList(users) {
  const list = document.getElementById('chat-user-list');
  const countEl = document.getElementById('chat-online-count');
  if (!list) return;

  const sorted = getSorted(users);
  const online = sorted.filter((u) => u.online).length;

  if (countEl) {
    countEl.textContent = `${online} online`;
  }

  if (sorted.length === 0) {
    list.innerHTML = `<div class="chat-empty-list">No users yet</div>`;
    return;
  }

  list.innerHTML = sorted
    .map(
      (u) => `
      <div class="chat-user-item ${u.online ? '' : 'offline'}" data-user-id="${
        u.id
      }" data-user-nickname="${escapeHTML(u.nickname)}">
        <div class="chat-avatar">
          ${escapeHTML(u.nickname[0].toUpperCase())}
          <span class="chat-dot ${u.online ? 'dot-on' : 'dot-off'}"></span>
        </div>
        <span class="chat-username">${escapeHTML(u.nickname)}</span>
        <button class="chat-open-btn" onclick="window._openChat(${
          u.id
        })" title="Chat with ${escapeHTML(u.nickname)}">💬</button>
      </div>
    `
    )
    .join('');
}

export async function loadUsers() {
  try {
    const res = await fetch('/api/users');

    if (!res.ok) {
      throw new Error('Failed to load users');
    }

    const users = await res.json();

    // Filter out the currently logged-in user using state.auth.id
    renderUserList(users.filter((u) => u.id !== state.auth.id));
  } catch (err) {
    console.error('loadUsers error:', err);

    const list = document.getElementById('chat-user-list');
    if (list) {
      list.innerHTML = `<div class="chat-empty-list">Could not load users</div>`;
    }
  }
}
